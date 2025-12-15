import type { Octokit } from "@octokit/rest";
import { createGitHubClient } from "./github.js";
import { searchNextJsRepos, RepoRef } from "./search.js";
import { getDefaultBranch } from "./repos";
import {
  readPackageJson,
  readPackageJsonWithSha,
  getFrameworkVersions,
} from "./package-json";
import { loadRscSecurityConfig } from "./config/load-config.js";
import { analyzeRepo, AnalysisResult } from "./security/analyze-repo.js";
import { applyNextPatch } from "./apply-patch.js";

type CliArgs = {
  dryRun: boolean;
  limit: number;
  owner?: string;
  repo?: string;
};

function parseTarget(value: string): { owner: string; repo: string } {
  const [owner, repo] = value.split("/");
  if (!owner || !repo) {
    throw new Error("--target must be in format owner/repo");
  }
  return { owner, repo };
}

function parseArgs(argv: string[]): CliArgs {
  let dryRun = true;
  let limit = 10;
  let owner: string | undefined;
  let repo: string | undefined;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--apply") {
      dryRun = false;
    } else if (arg === "--limit") {
      limit = Number(argv[++i]);
    } else if (arg.startsWith("--limit=")) {
      limit = Number(arg.split("=")[1]);
    } else if (arg === "--target") {
      ({ owner, repo } = parseTarget(argv[++i]));
    } else if (arg.startsWith("--target=")) {
      ({ owner, repo } = parseTarget(arg.split("=")[1]));
    }
  }

  if (!Number.isInteger(limit) || limit <= 0) {
    throw new Error("--limit must be a positive integer");
  }

  if (!dryRun && (!owner || !repo)) {
    throw new Error("--apply requires --target=owner/repo");
  }

  return { dryRun, limit, owner, repo };
}

async function ensureFork(
  octokit: Octokit,
  owner: string,
  repo: string,
  myLogin: string
): Promise<{ forkOwner: string; forkRepo: string }> {
  try {
    await octokit.rest.repos.get({ owner: myLogin, repo });
    console.log(`  ↳ using existing fork: ${myLogin}/${repo}`);
    return { forkOwner: myLogin, forkRepo: repo };
  } catch {
    // fork doesn't exist
  }

  console.log(`  ↳ creating fork of ${owner}/${repo}...`);
  await octokit.rest.repos.createFork({ owner, repo });

  let attempts = 0;
  while (attempts < 10) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    try {
      await octokit.rest.repos.get({ owner: myLogin, repo });
      console.log(`  ↳ fork ready: ${myLogin}/${repo}`);
      return { forkOwner: myLogin, forkRepo: repo };
    } catch {
      attempts++;
    }
  }

  throw new Error(`Fork creation timed out for ${owner}/${repo}`);
}

async function applyPatchFlow(
  octokit: Octokit,
  r: RepoRef,
  analysis: AnalysisResult
): Promise<void> {
  const me = await octokit.rest.users.getAuthenticated();

  const { forkOwner, forkRepo } = await ensureFork(
    octokit,
    r.owner,
    r.repo,
    me.data.login
  );

  const { pkg, sha } = await readPackageJsonWithSha(
    octokit,
    forkOwner,
    forkRepo,
    r.defaultBranch!
  );

  if (!pkg || !sha || !analysis.recommendedNext) {
    throw new Error("Missing package.json or recommended version");
  }

  await applyNextPatch({
    octokit,
    owner: forkOwner,
    repo: forkRepo,
    baseOwner: r.owner,
    baseRepo: r.repo,
    baseBranch: r.defaultBranch!,
    targetNext: analysis.recommendedNext,
    pkg,
    pkgSha: sha,
  });
}

async function analyzeAndLog(
  octokit: Octokit,
  r: RepoRef,
  securityConfig: ReturnType<typeof loadRscSecurityConfig>
): Promise<AnalysisResult> {
  const defaultBranch = await getDefaultBranch(octokit, r.owner, r.repo);
  r.defaultBranch = defaultBranch;

  const pkg = await readPackageJson(octokit, r.owner, r.repo, defaultBranch);
  const { next = null, react = null } = pkg ? getFrameworkVersions(pkg) : {};
  const analysis = analyzeRepo(
    { nextVersion: next, reactVersion: react },
    securityConfig
  );

  console.log(
    `- ${r.owner}/${r.repo} → ${
      analysis.vulnerable ? "❌ VULNERABLE" : "✅ SAFE"
    } (${analysis.reason})`
  );

  if (analysis.recommendedNext) {
    console.log(`  ↳ recommended Next.js: ${analysis.recommendedNext}`);
  }

  return analysis;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  console.log("next-rsc-guardian started");
  console.log("mode:", args.dryRun ? "DRY-RUN" : "APPLY");

  const octokit = createGitHubClient();
  const securityConfig = loadRscSecurityConfig();

  if (!args.dryRun && args.owner && args.repo) {
    console.log("target repo:", `${args.owner}/${args.repo}`);

    const r: RepoRef = { owner: args.owner, repo: args.repo };
    const analysis = await analyzeAndLog(octokit, r, securityConfig);

    if (!analysis.vulnerable) {
      console.log("Repo is not vulnerable, nothing to patch.");
      return;
    }

    console.log(`  ↳ applying patch...`);
    await applyPatchFlow(octokit, r, analysis);
    return;
  }

  console.log("limit:", args.limit);
  const repos = await searchNextJsRepos(octokit, args.limit);

  for (const r of repos) {
    await analyzeAndLog(octokit, r, securityConfig);
  }
}

main().catch((e) => {
  console.error("Fatal error:", e.message);
  process.exit(1);
});

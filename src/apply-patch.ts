import type { Octokit } from "@octokit/rest";
import type { PackageJson } from "./package-json.js";

export async function applyNextPatch(params: {
  octokit: Octokit;
  owner: string;
  repo: string;
  baseOwner: string;
  baseRepo: string;
  baseBranch: string;
  targetNext: string;
  pkgSha: string;
  pkg: PackageJson;
}) {
  const {
    octokit,
    owner,
    repo,
    baseOwner,
    baseRepo,
    baseBranch,
    targetNext,
    pkg,
  } = params;

  const branch = `security/next-rsc-${targetNext}`;

  const { data: existingPRs } = await octokit.rest.pulls.list({
    owner: baseOwner,
    repo: baseRepo,
    head: `${owner}:${branch}`,
    state: "open",
  });

  if (existingPRs.length > 0) {
    console.log(`  ↳ PR already exists: ${existingPRs[0].html_url}`);
    return;
  }

  const { data: base } = await octokit.rest.repos.getBranch({
    owner,
    repo,
    branch: baseBranch,
  });

  let branchExists = false;
  await octokit.rest.git
    .createRef({
      owner,
      repo,
      ref: `refs/heads/${branch}`,
      sha: base.commit.sha,
    })
    .catch(() => {
      branchExists = true;
    });

  const { data: fileData } = await octokit.rest.repos.getContent({
    owner,
    repo,
    path: "package.json",
    ref: branch,
  });

  if (Array.isArray(fileData) || fileData.type !== "file") {
    throw new Error("package.json is not a file");
  }

  const currentSha = fileData.sha;

  const updated = { ...pkg };
  if (updated.dependencies?.next) updated.dependencies.next = targetNext;
  if (updated.devDependencies?.next) updated.devDependencies.next = targetNext;

  const content = Buffer.from(JSON.stringify(updated, null, 2)).toString(
    "base64"
  );

  if (!branchExists) {
    await octokit.rest.repos.createOrUpdateFileContents({
      owner,
      repo,
      path: "package.json",
      message: `chore(security): bump next to ${targetNext} (RSC patch)`,
      content,
      sha: currentSha,
      branch,
    });
  }

  const { data: pr } = await octokit.rest.pulls.create({
    owner: baseOwner,
    repo: baseRepo,
    head: `${owner}:${branch}`,
    base: baseBranch,
    title: `chore(security): upgrade Next.js to ${targetNext}`,
    body: `This PR upgrades Next.js to ${targetNext} to address RSC-related security issues.

- Patch-level update within the same minor
- No behavior changes expected

If you prefer a different patch line, feel free to adjust.`,
  });

  console.log(`  ↳ PR opened: ${pr.html_url}`);
}

import type { Octokit } from "@octokit/rest";

export type PackageJson = {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

type PackageJsonResult = {
  pkg: PackageJson | null;
  sha: string | null;
};

async function fetchPackageJson(
  octokit: Octokit,
  owner: string,
  repo: string,
  ref: string
): Promise<PackageJsonResult> {
  try {
    const { data } = await octokit.rest.repos.getContent({
      owner,
      repo,
      path: "package.json",
      ref,
    });

    if (!("content" in data) || !("sha" in data)) {
      return { pkg: null, sha: null };
    }

    const decoded = Buffer.from(data.content, "base64").toString("utf8");

    return {
      pkg: JSON.parse(decoded) as PackageJson,
      sha: data.sha,
    };
  } catch (e: unknown) {
    if (e && typeof e === "object" && "status" in e && e.status === 404) {
      return { pkg: null, sha: null };
    }
    throw e;
  }
}

export async function readPackageJson(
  octokit: Octokit,
  owner: string,
  repo: string,
  ref: string
): Promise<PackageJson | null> {
  const { pkg } = await fetchPackageJson(octokit, owner, repo, ref);
  return pkg;
}

export async function readPackageJsonWithSha(
  octokit: Octokit,
  owner: string,
  repo: string,
  ref: string
): Promise<PackageJsonResult> {
  return fetchPackageJson(octokit, owner, repo, ref);
}

export function getFrameworkVersions(pkg: PackageJson): {
  next: string | null;
  react: string | null;
} {
  const next =
    pkg.dependencies?.["next"] ?? pkg.devDependencies?.["next"] ?? null;

  const react =
    pkg.dependencies?.["react"] ?? pkg.devDependencies?.["react"] ?? null;

  return { next, react };
}

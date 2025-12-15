import type { Octokit } from "@octokit/rest";

export async function getDefaultBranch(
  octokit: Octokit,
  owner: string,
  repo: string
): Promise<string> {
  const { data } = await octokit.rest.repos.get({
    owner,
    repo,
  });

  return data.default_branch;
}

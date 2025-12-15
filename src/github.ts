import { Octokit } from "@octokit/rest";
import "dotenv/config";

export function createGitHubClient(): Octokit {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error("GITHUB_TOKEN is required (set it in .env)");
  return new Octokit({ auth: token });
}

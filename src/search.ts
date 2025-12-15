import type { Octokit } from "@octokit/rest";

export type RepoRef = {
  owner: string;
  repo: string;
  defaultBranch?: string;
};

const SEARCH_DELAY_MS = 2500;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function searchNextJsRepos(
  octokit: Octokit,
  limit: number
): Promise<RepoRef[]> {
  const seen = new Set<string>();
  const results: RepoRef[] = [];
  const query = `"react": "19" OR "react": "^19" in:file filename:package.json`;
  const perPage = Math.min(limit, 100);

  let page = 1;
  const maxPages = Math.min(Math.ceil(limit / perPage), 10);

  while (results.length < limit && page <= maxPages) {
    if (page > 1) {
      console.log(`  (waiting ${SEARCH_DELAY_MS}ms for rate limit...)`);
      await sleep(SEARCH_DELAY_MS);
    }

    console.log(`Fetching search results page ${page}/${maxPages}...`);

    const res = await octokit.rest.search.code({
      q: query,
      per_page: perPage,
      page,
    });

    if (res.data.items.length === 0) break;

    for (const item of res.data.items) {
      const full = item.repository.full_name;
      if (seen.has(full)) continue;
      seen.add(full);

      const [owner, repo] = full.split("/");
      results.push({ owner, repo });

      if (results.length >= limit) break;
    }

    page++;
  }

  console.log(`Found ${results.length} unique repos`);
  return results;
}

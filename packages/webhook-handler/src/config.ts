export interface Env {
  NOTION_WEBHOOK_VERIFICATION_TOKEN: string;
  NOTION_TOKEN: string;
  GITHUB_TOKEN: string;
  NOTION_TO_GITHUB_REPO: string;
  NOTION_RELEASE_STATUS_PROPERTY: string;
  NOTION_RELEASE_APPROVED_VALUE: string;
  NOTION_WATCHED_DATABASE_IDS: string;
}

export function parseRepo(env: Env): { owner: string; repo: string } {
  const parts = env.NOTION_TO_GITHUB_REPO.split("/");
  if (parts.length !== 2) {
    throw new Error(`Invalid NOTION_TO_GITHUB_REPO: ${env.NOTION_TO_GITHUB_REPO}`);
  }
  return { owner: parts[0], repo: parts[1] };
}

export function watchedDatabaseIds(env: Env): Set<string> {
  return new Set(
    env.NOTION_WATCHED_DATABASE_IDS.split(",")
      .map((s) => s.replace(/-/g, "").trim())
      .filter(Boolean)
  );
}

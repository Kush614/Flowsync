export interface Env {
  NOTION_TOKEN: string;
  GITHUB_TOKEN: string;
  NOTION_CHANGELOG_DB_ID: string;
  NOTION_API_REFERENCE_DB_ID: string;
}

export function requireEnv(env: Env, key: keyof Env): string {
  const value = env[key];
  if (!value) throw new Error(`Missing required secret: ${key}`);
  return value;
}

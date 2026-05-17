export interface EnvStatus {
  notionToken: { set: boolean; preview?: string };
  changelogDb: { set: boolean; value?: string };
  apiRefDb: { set: boolean; value?: string };
  dataDictDb: { set: boolean; value?: string };
}

export function readEnvStatus(): EnvStatus {
  const token = process.env.NOTION_TOKEN ?? "";
  return {
    notionToken: {
      set: Boolean(token),
      preview: token ? `${token.slice(0, 7)}…${token.slice(-4)}` : undefined
    },
    changelogDb: {
      set: Boolean(process.env.NOTION_CHANGELOG_DB_ID),
      value: process.env.NOTION_CHANGELOG_DB_ID
    },
    apiRefDb: {
      set: Boolean(process.env.NOTION_API_REFERENCE_DB_ID),
      value: process.env.NOTION_API_REFERENCE_DB_ID
    },
    dataDictDb: {
      set: Boolean(process.env.NOTION_DATA_DICTIONARY_DB_ID),
      value: process.env.NOTION_DATA_DICTIONARY_DB_ID
    }
  };
}

export function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set. Add it to E:\\notion\\.env`);
  return v;
}

import { FlowSyncClient, normalizeId } from "@flowsync/core";
import type { Env } from "../env.js";
import { requireEnv } from "../env.js";

export interface QueryReleaseArgs {
  tag: string;
}

export async function queryRelease(env: Env, args: QueryReleaseArgs): Promise<string> {
  const notion = new FlowSyncClient({ token: requireEnv(env, "NOTION_TOKEN") });
  const dbId = normalizeId(requireEnv(env, "NOTION_CHANGELOG_DB_ID"));

  const res = await notion.withRetry(() =>
    notion.notion.databases.query({
      database_id: dbId,
      filter: { property: "Name", title: { equals: args.tag } },
      page_size: 1
    })
  );

  const page = res.results[0] as { id: string; url: string; properties: Record<string, unknown> } | undefined;
  if (!page) return `No release found for ${args.tag}.`;

  const props = page.properties;
  const features = readNumber(props.Features);
  const fixes = readNumber(props.Fixes);
  const breaking = readNumber(props.Breaking);
  const releaseDate = readDate(props["Release Date"]);

  return [
    `Release ${args.tag} (${releaseDate ?? "no date"})`,
    `${breaking} breaking, ${features} features, ${fixes} fixes.`,
    `Notion page: ${page.url}`
  ].join("\n");
}

function readNumber(prop: unknown): number {
  const p = prop as { number?: number | null } | undefined;
  return p?.number ?? 0;
}

function readDate(prop: unknown): string | null {
  const p = prop as { date?: { start: string } | null } | undefined;
  return p?.date?.start ?? null;
}

"use server";

import {
  ApiReferenceUpserter,
  ChangelogUpserter,
  DataDictionaryUpserter,
  FlowSyncClient
} from "@flowsync/core";
import { requireEnv } from "@/lib/env";
import {
  bucketCommits,
  extractLinearTickets,
  parseCommitsText,
  parseOpenApiText,
  parsePrismaText
} from "@/lib/parsers";

export interface ActionResult {
  ok: boolean;
  message: string;
  details?: Record<string, unknown>;
}

export async function testConnection(): Promise<ActionResult> {
  try {
    const token = requireEnv("NOTION_TOKEN");
    const client = new FlowSyncClient({ token });
    const me = await client.withRetry(() => client.notion.users.me({}));
    const name = (me as { name?: string; bot?: { owner?: { type?: string } } }).name ?? "(unnamed)";
    return {
      ok: true,
      message: `Connected as ${name}`,
      details: { id: (me as { id: string }).id, type: (me as { type?: string }).type }
    };
  } catch (e) {
    return { ok: false, message: errMessage(e) };
  }
}

export async function pushChangelog(input: {
  tag: string;
  commitsText: string;
  database?: string;
}): Promise<ActionResult> {
  try {
    if (!input.tag.trim()) throw new Error("Release tag is required");
    const token = requireEnv("NOTION_TOKEN");
    const dbId = input.database?.trim() || requireEnv("NOTION_CHANGELOG_DB_ID");

    const commits = parseCommitsText(input.commitsText);
    if (!commits.length) throw new Error("No commits provided");
    const grouped = bucketCommits(commits);
    const linearTickets = extractLinearTickets(commits);

    const entry = {
      releaseTag: input.tag.trim(),
      releaseDate: new Date().toISOString().slice(0, 10),
      ...grouped,
      linearTickets
    };

    const client = new FlowSyncClient({ token });
    const upserter = new ChangelogUpserter(client, dbId, {
      linearRelationProperty: linearTickets.length ? "Linear Tickets" : undefined
    });
    const result = await upserter.upsert(entry);
    return {
      ok: true,
      message: `${result.created ? "Created" : "Updated"} ${entry.releaseTag}`,
      details: {
        url: result.url,
        commits: commits.length,
        features: grouped.features.length,
        fixes: grouped.fixes.length,
        chores: grouped.chores.length,
        breaking: grouped.breaking.length,
        linearTickets
      }
    };
  } catch (e) {
    return { ok: false, message: errMessage(e) };
  }
}

export async function syncOpenApi(input: {
  specText: string;
  database?: string;
}): Promise<ActionResult> {
  try {
    const token = requireEnv("NOTION_TOKEN");
    const dbId = input.database?.trim() || requireEnv("NOTION_API_REFERENCE_DB_ID");
    if (!input.specText.trim()) throw new Error("Paste an OpenAPI JSON spec");

    const records = parseOpenApiText(input.specText);
    if (!records.length) throw new Error("No endpoints found in spec");

    const client = new FlowSyncClient({ token });
    const upserter = new ApiReferenceUpserter(client, dbId);
    const { created, updated } = await upserter.upsertMany(records);

    return {
      ok: true,
      message: `Synced ${records.length} endpoints (${created} created, ${updated} updated)`,
      details: { created, updated, total: records.length }
    };
  } catch (e) {
    return { ok: false, message: errMessage(e) };
  }
}

export async function syncMigrations(input: {
  schemaText: string;
  database?: string;
}): Promise<ActionResult> {
  try {
    const token = requireEnv("NOTION_TOKEN");
    const dbId = input.database?.trim() || requireEnv("NOTION_DATA_DICTIONARY_DB_ID");
    if (!input.schemaText.trim()) throw new Error("Paste a Prisma schema");

    const tables = parsePrismaText(input.schemaText);
    if (!tables.length) throw new Error("No models found in schema");

    const client = new FlowSyncClient({ token });
    const upserter = new DataDictionaryUpserter(client, dbId);

    let created = 0;
    let updated = 0;
    for (const t of tables) {
      const r = await upserter.upsertTable(t);
      if (r.created) created++;
      else updated++;
    }

    return {
      ok: true,
      message: `Synced ${tables.length} tables (${created} created, ${updated} updated)`,
      details: {
        created,
        updated,
        tables: tables.map((t) => ({ name: t.name, columns: t.columns.length }))
      }
    };
  } catch (e) {
    return { ok: false, message: errMessage(e) };
  }
}

function errMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  return String(e);
}

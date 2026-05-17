import { Command } from "commander";
import { appendFileSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import kleur from "kleur";
import { FlowSyncClient, normalizeId } from "@flowsync/core";
import { requireEnv } from "../env.js";

interface InitOptions {
  parent: string;
  envFile?: string;
  skipChangelog?: boolean;
  skipApi?: boolean;
  skipDictionary?: boolean;
}

export function registerInit(program: Command): void {
  program
    .command("init")
    .description("Create the three Notion databases (Changelog, API Reference, Data Dictionary) under a parent page and write IDs to .env")
    .requiredOption("--parent <pageId>", "Parent Notion page ID (32-char UUID, with or without dashes). The integration must be shared with this page.")
    .option("--env-file <path>", "Path to .env file to update", ".env")
    .option("--skip-changelog", "Don't create the Changelog DB", false)
    .option("--skip-api", "Don't create the API Reference DB", false)
    .option("--skip-dictionary", "Don't create the Data Dictionary DB", false)
    .action(async (opts: InitOptions) => {
      const token = requireEnv("NOTION_TOKEN");
      const client = new FlowSyncClient({ token });
      const parentId = normalizeId(opts.parent);

      const updates: Record<string, string> = {};

      if (!opts.skipChangelog) {
        console.log(kleur.cyan("Creating Changelog DB..."));
        const db = await createChangelogDb(client, parentId);
        console.log(kleur.green(`  -> ${db.id}`));
        updates.NOTION_CHANGELOG_DB_ID = db.id;
      }

      if (!opts.skipApi) {
        console.log(kleur.cyan("Creating API Reference DB..."));
        const db = await createApiReferenceDb(client, parentId);
        console.log(kleur.green(`  -> ${db.id}`));
        updates.NOTION_API_REFERENCE_DB_ID = db.id;
      }

      if (!opts.skipDictionary) {
        console.log(kleur.cyan("Creating Data Dictionary DB..."));
        const db = await createDataDictionaryDb(client, parentId);
        console.log(kleur.green(`  -> ${db.id}`));
        updates.NOTION_DATA_DICTIONARY_DB_ID = db.id;
      }

      const envPath = resolve(opts.envFile ?? ".env");
      writeEnvUpdates(envPath, updates);
      console.log(kleur.green(`\nWrote ${Object.keys(updates).length} DB IDs to ${envPath}`));
      console.log(kleur.dim("Next: try `notion-sync push --tag v0.1.0 --dry-run` in any git repo."));
    });
}

async function createChangelogDb(client: FlowSyncClient, parentId: string) {
  return client.withRetry(() =>
    client.notion.databases.create({
      parent: { type: "page_id", page_id: parentId },
      title: [{ type: "text", text: { content: "FlowSync Changelog" } }],
      properties: {
        Name: { title: {} },
        "Release Date": { date: {} },
        Features: { number: {} },
        Fixes: { number: {} },
        Breaking: { number: {} },
        Status: {
          select: {
            options: [
              { name: "Draft", color: "gray" },
              { name: "Ready for review", color: "yellow" },
              { name: "Approved for release", color: "green" },
              { name: "Shipped", color: "blue" }
            ]
          }
        },
        Authors: { people: {} },
        "Linear Tickets": { rich_text: {} },
        "Release Notes": { rich_text: {} },
        "PR Number": { number: {} }
      }
    })
  );
}

async function createApiReferenceDb(client: FlowSyncClient, parentId: string) {
  return client.withRetry(() =>
    client.notion.databases.create({
      parent: { type: "page_id", page_id: parentId },
      title: [{ type: "text", text: { content: "FlowSync API Reference" } }],
      properties: {
        Name: { title: {} },
        Operation: { rich_text: {} },
        Method: {
          select: {
            options: [
              { name: "GET", color: "blue" },
              { name: "POST", color: "green" },
              { name: "PUT", color: "yellow" },
              { name: "PATCH", color: "orange" },
              { name: "DELETE", color: "red" },
              { name: "OPTIONS", color: "gray" },
              { name: "HEAD", color: "gray" }
            ]
          }
        },
        Path: { rich_text: {} },
        Tags: { multi_select: { options: [] } },
        Deprecated: { checkbox: {} },
        Description: { rich_text: {} }
      }
    })
  );
}

async function createDataDictionaryDb(client: FlowSyncClient, parentId: string) {
  return client.withRetry(() =>
    client.notion.databases.create({
      parent: { type: "page_id", page_id: parentId },
      title: [{ type: "text", text: { content: "FlowSync Data Dictionary" } }],
      properties: {
        Name: { title: {} },
        Schema: { rich_text: {} },
        Columns: { number: {} },
        "Has FK": { checkbox: {} }
      }
    })
  );
}

function writeEnvUpdates(envPath: string, updates: Record<string, string>): void {
  const lines = existsSync(envPath) ? readFileSync(envPath, "utf8").split(/\r?\n/) : [];
  const seen = new Set<string>();
  const next = lines.map((line) => {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line);
    if (!m) return line;
    if (updates[m[1]] !== undefined) {
      seen.add(m[1]);
      return `${m[1]}=${updates[m[1]]}`;
    }
    return line;
  });
  for (const [key, value] of Object.entries(updates)) {
    if (!seen.has(key)) next.push(`${key}=${value}`);
  }
  writeFileSync(envPath, next.join("\n"));
}

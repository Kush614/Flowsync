import { Command } from "commander";
import kleur from "kleur";
import { ApiReferenceUpserter, FlowSyncClient } from "@flowsync/core";
import { parseOpenApi } from "../parsers/openapi.js";
import { requireEnv } from "../env.js";

interface Options {
  spec: string;
  database?: string;
  dryRun?: boolean;
}

export function registerOpenapi(program: Command): void {
  program
    .command("openapi")
    .description("Sync an OpenAPI JSON spec into the Notion API Reference database")
    .requiredOption("--spec <path>", "Path to OpenAPI JSON file")
    .option("--database <id>", "Notion database ID. Defaults to NOTION_API_REFERENCE_DB_ID env.")
    .option("--dry-run", "Print parsed endpoints without writing to Notion", false)
    .action(async (opts: Options) => {
      const records = parseOpenApi(opts.spec);
      console.log(kleur.cyan(`Parsed ${records.length} endpoints from ${opts.spec}`));

      if (opts.dryRun) {
        console.log(JSON.stringify(records, null, 2));
        return;
      }

      const token = requireEnv("NOTION_TOKEN");
      const dbId = opts.database ?? requireEnv("NOTION_API_REFERENCE_DB_ID");
      const client = new FlowSyncClient({ token });
      const upserter = new ApiReferenceUpserter(client, dbId);
      const { created, updated } = await upserter.upsertMany(records);
      console.log(kleur.green(`Created ${created}, updated ${updated}`));
    });
}

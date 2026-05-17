import { Command } from "commander";
import kleur from "kleur";
import { DataDictionaryUpserter, FlowSyncClient } from "@flowsync/core";
import { parsePrismaSchema } from "../parsers/prisma.js";
import { requireEnv } from "../env.js";

interface Options {
  schema: string;
  database?: string;
  dryRun?: boolean;
}

export function registerMigrations(program: Command): void {
  program
    .command("migrations")
    .description("Parse a Prisma schema and upsert tables into the Notion Data Dictionary database")
    .requiredOption("--schema <path>", "Path to schema.prisma")
    .option("--database <id>", "Notion database ID. Defaults to NOTION_DATA_DICTIONARY_DB_ID env.")
    .option("--dry-run", "Print parsed tables without writing to Notion", false)
    .action(async (opts: Options) => {
      const tables = parsePrismaSchema(opts.schema);
      console.log(kleur.cyan(`Parsed ${tables.length} tables from ${opts.schema}`));

      if (opts.dryRun) {
        console.log(JSON.stringify(tables, null, 2));
        return;
      }

      const token = requireEnv("NOTION_TOKEN");
      const dbId = opts.database ?? requireEnv("NOTION_DATA_DICTIONARY_DB_ID");
      const client = new FlowSyncClient({ token });
      const upserter = new DataDictionaryUpserter(client, dbId);

      let created = 0;
      let updated = 0;
      for (const table of tables) {
        const r = await upserter.upsertTable(table);
        if (r.created) created++;
        else updated++;
      }
      console.log(kleur.green(`Created ${created}, updated ${updated}`));
    });
}

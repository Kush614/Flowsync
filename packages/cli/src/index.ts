#!/usr/bin/env node
import "dotenv/config";
import { Command } from "commander";
import { registerInit } from "./commands/init.js";
import { registerPush } from "./commands/push.js";
import { registerOpenapi } from "./commands/openapi.js";
import { registerMigrations } from "./commands/migrations.js";

const program = new Command();

program
  .name("notion-sync")
  .description("FlowSync CLI — sync engineering artifacts into Notion")
  .version("0.1.0");

registerInit(program);
registerPush(program);
registerOpenapi(program);
registerMigrations(program);

program.parseAsync(process.argv).catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});

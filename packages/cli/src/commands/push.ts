import { Command } from "commander";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import kleur from "kleur";
import {
  ChangelogUpserter,
  FlowSyncClient,
  parsePeopleMap,
  type ChangeItem
} from "@flowsync/core";
import { requireEnv } from "../env.js";
import { extractLinearTicketsFromCommits } from "../parsers/linear.js";

interface PushOptions {
  tag: string;
  from?: string;
  database?: string;
  peopleMap?: string;
  authorsProperty?: string;
  linearProperty?: string;
  dryRun?: boolean;
}

export function registerPush(program: Command): void {
  program
    .command("push")
    .description("Generate a changelog entry from local git history and upsert into Notion")
    .requiredOption("--tag <tag>", "Release tag for this entry (e.g., v1.4.0)")
    .option("--from <ref>", "Compare from this git ref (defaults to previous tag)")
    .option("--database <id>", "Notion database ID. Defaults to NOTION_CHANGELOG_DB_ID env.")
    .option("--people-map <path>", "Path to people-map.json. Defaults to ./flowsync/people-map.json if present.")
    .option("--authors-property <name>", "Notion People property name for commit authors", "Authors")
    .option("--linear-property <name>", "Notion text property name for Linear tickets", "Linear Tickets")
    .option("--dry-run", "Print payload without calling Notion", false)
    .action(async (opts: PushOptions) => {
      const token = requireEnv("NOTION_TOKEN");
      const dbId = opts.database ?? requireEnv("NOTION_CHANGELOG_DB_ID");

      const from = opts.from ?? previousTag(opts.tag);
      const commits = gitLog(from, opts.tag);
      console.log(kleur.cyan(`Parsed ${commits.length} commits between ${from ?? "(init)"}..${opts.tag}`));

      const grouped = bucketCommits(commits);
      const linearTickets = extractLinearTicketsFromCommits(commits);
      if (linearTickets.length) {
        console.log(kleur.cyan(`Found Linear tickets: ${linearTickets.join(", ")}`));
      }

      const peopleMapPath = opts.peopleMap ?? defaultPeopleMapPath();
      const peopleMap = peopleMapPath ? parsePeopleMap(readFileSync(peopleMapPath, "utf8")) : undefined;

      const entry = {
        releaseTag: opts.tag,
        releaseDate: new Date().toISOString().slice(0, 10),
        ...grouped,
        linearTickets,
        commitRange: from ? { from, to: opts.tag } : undefined
      };

      if (opts.dryRun) {
        console.log(JSON.stringify(entry, null, 2));
        return;
      }

      const client = new FlowSyncClient({ token });
      const upserter = new ChangelogUpserter(client, dbId, {
        peopleMap,
        authorsPeopleProperty: peopleMap ? opts.authorsProperty : undefined,
        linearRelationProperty: linearTickets.length ? opts.linearProperty : undefined
      });
      const result = await upserter.upsert(entry);
      console.log(
        kleur.green(`${result.created ? "Created" : "Updated"} `) + kleur.underline(result.url)
      );
    });
}

function defaultPeopleMapPath(): string | undefined {
  const candidates = ["flowsync/people-map.json", ".flowsync/people-map.json"];
  return candidates.find(existsSync);
}

function previousTag(currentTag: string): string | undefined {
  try {
    const out = execFileSync("git", ["describe", "--tags", "--abbrev=0", `${currentTag}^`], {
      encoding: "utf8"
    });
    return out.trim();
  } catch {
    return undefined;
  }
}

interface GitCommit {
  sha: string;
  subject: string;
  author: string;
}

function gitLog(from: string | undefined, to: string): GitCommit[] {
  const range = from ? `${from}..${to}` : to;
  const fmt = "%H%x09%an%x09%s";
  const raw = execFileSync("git", ["log", "--no-merges", `--pretty=format:${fmt}`, range], {
    encoding: "utf8"
  });
  return raw
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const [sha, author, ...subjectParts] = line.split("\t");
      return { sha, author, subject: subjectParts.join("\t") };
    });
}

function bucketCommits(commits: GitCommit[]) {
  const features: ChangeItem[] = [];
  const fixes: ChangeItem[] = [];
  const chores: ChangeItem[] = [];
  const breaking: ChangeItem[] = [];

  for (const c of commits) {
    const m = /^(feat|fix|chore|docs|refactor|perf|test|build|ci|style|revert)(\([^)]+\))?(!)?:\s*(.+)$/i.exec(c.subject);
    const item: ChangeItem = {
      summary: m ? m[4].trim() : c.subject,
      author: c.author,
      sha: c.sha
    };
    if (m?.[3] === "!") breaking.push(item);
    else if (m?.[1].toLowerCase() === "feat") features.push(item);
    else if (m?.[1].toLowerCase() === "fix") fixes.push(item);
    else chores.push(item);
  }

  return { features, fixes, chores, breaking };
}

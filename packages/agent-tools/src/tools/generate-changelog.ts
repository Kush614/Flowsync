import { ChangelogUpserter, FlowSyncClient, type ChangeItem } from "@flowsync/core";
import type { Env } from "../env.js";
import { requireEnv } from "../env.js";
import { Gh, type GhCommit } from "../github.js";

export interface GenerateChangelogArgs {
  repo: string;
  tag: string;
  fromTag?: string;
}

export async function generateChangelog(env: Env, args: GenerateChangelogArgs): Promise<string> {
  const [owner, repo] = args.repo.split("/");
  if (!owner || !repo) throw new Error(`Invalid repo: ${args.repo}. Expected owner/repo.`);

  const gh = new Gh(requireEnv(env, "GITHUB_TOKEN"));
  const fromTag = args.fromTag ?? (await gh.previousTag(owner, repo, args.tag));
  if (!fromTag) {
    return `No previous tag found before ${args.tag}. Pass fromTag explicitly to override.`;
  }

  const commits = await gh.compareCommits(owner, repo, fromTag, args.tag);
  const grouped = bucket(commits, owner, repo);

  const notion = new FlowSyncClient({ token: requireEnv(env, "NOTION_TOKEN") });
  const upserter = new ChangelogUpserter(notion, requireEnv(env, "NOTION_CHANGELOG_DB_ID"));

  const result = await upserter.upsert({
    releaseTag: args.tag,
    releaseDate: new Date().toISOString().slice(0, 10),
    breaking: grouped.breaking,
    features: grouped.features,
    fixes: grouped.fixes,
    chores: grouped.chores,
    commitRange: { from: fromTag, to: args.tag }
  });

  const verb = result.created ? "Created" : "Updated";
  return [
    `${verb} Notion changelog for ${args.tag}.`,
    `${grouped.breaking.length} breaking, ${grouped.features.length} features, ${grouped.fixes.length} fixes, ${grouped.chores.length} chores.`,
    `Range: ${fromTag}..${args.tag}.`,
    `Page: ${result.url}`
  ].join("\n");
}

const CONVENTIONAL_RE = /^(feat|fix|chore|docs|refactor|perf|test|build|ci|style|revert)(\([^)]+\))?(!)?:\s*(.+)$/i;

function bucket(commits: GhCommit[], owner: string, repo: string) {
  const breaking: ChangeItem[] = [];
  const features: ChangeItem[] = [];
  const fixes: ChangeItem[] = [];
  const chores: ChangeItem[] = [];

  for (const c of commits) {
    const firstLine = c.commit.message.split("\n", 1)[0] ?? c.commit.message;
    const m = CONVENTIONAL_RE.exec(firstLine);
    const item: ChangeItem = {
      summary: m ? m[4].trim() : firstLine,
      author: c.author?.login ?? c.commit.author?.name,
      sha: c.sha,
      prUrl: extractPrUrl(firstLine, owner, repo)
    };
    if (m?.[3] === "!") breaking.push(item);
    else if (m?.[1].toLowerCase() === "feat") features.push(item);
    else if (m?.[1].toLowerCase() === "fix") fixes.push(item);
    else chores.push(item);
  }

  return { breaking, features, fixes, chores };
}

function extractPrUrl(message: string, owner: string, repo: string): string | undefined {
  const m = /\(#(\d+)\)/.exec(message);
  if (!m) return undefined;
  return `https://github.com/${owner}/${repo}/pull/${m[1]}`;
}

import * as core from "@actions/core";
import * as github from "@actions/github";
import { ChangelogUpserter, FlowSyncClient } from "@flowsync/core";
import { categorize, bucket, type ParsedCommit } from "./pr-parser.js";

async function run(): Promise<void> {
  try {
    const token = core.getInput("notion-token", { required: true });
    const databaseId = core.getInput("database-id", { required: true });
    const releaseTagInput = core.getInput("release-tag");
    const baseRefInput = core.getInput("base-ref");
    const dryRun = core.getInput("dry-run") === "true";

    const ctx = github.context;
    const releaseTag = releaseTagInput || resolveTagFromContext(ctx);
    if (!releaseTag) {
      core.setFailed("release-tag input is empty and could not infer a tag from the event payload.");
      return;
    }

    const ghToken = process.env.GITHUB_TOKEN ?? "";
    if (!ghToken) {
      core.setFailed("GITHUB_TOKEN env var is required (pass via env in the workflow step).");
      return;
    }
    const octokit = github.getOctokit(ghToken);
    const { owner, repo } = ctx.repo;

    const baseRef = baseRefInput || (await previousTag(octokit, owner, repo, releaseTag));
    core.info(`Comparing ${baseRef ?? "(initial)"}..${releaseTag} for ${owner}/${repo}`);

    const commits = await listCommits(octokit, owner, repo, baseRef, releaseTag);
    core.info(`Found ${commits.length} commits`);

    const parsed: ParsedCommit[] = commits.map((c) => {
      const { category, isBreaking, cleaned } = categorize(c.commit.message, false);
      return {
        sha: c.sha,
        summary: cleaned,
        author: c.author?.login ?? c.commit.author?.name,
        prUrl: extractPrUrl(c.commit.message, owner, repo),
        category,
        isBreaking
      };
    });

    const grouped = bucket(parsed);
    const entry = {
      releaseTag,
      releaseDate: new Date().toISOString().slice(0, 10),
      breaking: grouped.breaking,
      features: grouped.features,
      fixes: grouped.fixes,
      chores: grouped.chores,
      commitRange: baseRef ? { from: baseRef, to: releaseTag } : undefined
    };

    if (dryRun) {
      core.info("Dry run — payload:");
      core.info(JSON.stringify(entry, null, 2));
      return;
    }

    const client = new FlowSyncClient({ token });
    const upserter = new ChangelogUpserter(client, databaseId);
    const result = await upserter.upsert(entry);

    core.setOutput("page-id", result.pageId);
    core.setOutput("page-url", result.url);
    core.info(`${result.created ? "Created" : "Updated"} Notion page: ${result.url}`);
  } catch (err) {
    core.setFailed(err instanceof Error ? err.message : String(err));
  }
}

function resolveTagFromContext(ctx: typeof github.context): string | null {
  if (ctx.eventName === "push" && ctx.ref.startsWith("refs/tags/")) {
    return ctx.ref.replace("refs/tags/", "");
  }
  if (ctx.eventName === "release") {
    const release = (ctx.payload as { release?: { tag_name?: string } }).release;
    return release?.tag_name ?? null;
  }
  return null;
}

async function previousTag(
  octokit: ReturnType<typeof github.getOctokit>,
  owner: string,
  repo: string,
  currentTag: string
): Promise<string | undefined> {
  const tags = await octokit.rest.repos.listTags({ owner, repo, per_page: 50 });
  const names = tags.data.map((t) => t.name);
  const idx = names.indexOf(currentTag);
  if (idx === -1) return undefined;
  return names[idx + 1];
}

async function listCommits(
  octokit: ReturnType<typeof github.getOctokit>,
  owner: string,
  repo: string,
  base: string | undefined,
  head: string
): Promise<Array<{ sha: string; commit: { message: string; author?: { name?: string } | null }; author: { login?: string } | null }>> {
  if (!base) {
    const res = await octokit.rest.repos.listCommits({ owner, repo, sha: head, per_page: 100 });
    return res.data as never;
  }
  const cmp = await octokit.rest.repos.compareCommitsWithBasehead({
    owner,
    repo,
    basehead: `${base}...${head}`
  });
  return cmp.data.commits as never;
}

function extractPrUrl(message: string, owner: string, repo: string): string | undefined {
  const m = /\(#(\d+)\)/.exec(message);
  if (!m) return undefined;
  return `https://github.com/${owner}/${repo}/pull/${m[1]}`;
}

run();

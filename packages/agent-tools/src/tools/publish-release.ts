import { FlowSyncClient } from "@flowsync/core";
import type { Env } from "../env.js";
import { requireEnv } from "../env.js";
import { Gh } from "../github.js";

export interface PublishReleaseArgs {
  pageId: string;
  repo: string;
  draft?: boolean;
}

export async function publishRelease(env: Env, args: PublishReleaseArgs): Promise<string> {
  const [owner, repo] = args.repo.split("/");
  if (!owner || !repo) throw new Error(`Invalid repo: ${args.repo}. Expected owner/repo.`);

  const notion = new FlowSyncClient({ token: requireEnv(env, "NOTION_TOKEN") });
  const page = await notion.withRetry(() => notion.notion.pages.retrieve({ page_id: args.pageId }));

  const props = (page as { properties: Record<string, unknown>; url: string }).properties;
  const title = readTitle(props.Name);
  const notes = readRichText(props["Release Notes"]);

  if (!title) throw new Error(`Page ${args.pageId} has no title.`);

  const gh = new Gh(requireEnv(env, "GITHUB_TOKEN"));
  const release = await gh.createRelease(owner, repo, {
    tag_name: title,
    name: title,
    body: notes || `Published from Notion: ${(page as { url: string }).url}`,
    draft: args.draft ?? false
  });

  return `Published GitHub release ${title}: ${release.html_url}`;
}

function readTitle(prop: unknown): string {
  const t = prop as { title?: Array<{ plain_text: string }> } | undefined;
  return (t?.title ?? []).map((x) => x.plain_text).join("");
}

function readRichText(prop: unknown): string {
  const t = prop as { rich_text?: Array<{ plain_text: string }> } | undefined;
  return (t?.rich_text ?? []).map((x) => x.plain_text).join("");
}

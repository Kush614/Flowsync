import type { Env } from "../config.js";
import { parseRepo } from "../config.js";
import { GithubClient } from "../github.js";
import { NotionClient, readTitle } from "../notion.js";

export interface CommentEvent {
  type: string;
  data?: { parent?: { page_id?: string }; id?: string };
  entity?: { id: string; type: "comment" };
}

const PR_URL_RE = /github\.com\/[\w.-]+\/[\w.-]+\/pull\/(\d+)/;
const PR_REF_RE = /\(#(\d+)\)/;

export async function handleCommentForwarded(env: Env, event: CommentEvent): Promise<Response> {
  const commentId = event.entity?.id ?? event.data?.id;
  const pageId = event.data?.parent?.page_id;
  if (!commentId || !pageId) return json({ ok: true, skipped: "missing ids" });

  const notion = new NotionClient(env.NOTION_TOKEN);
  const [comment, page] = await Promise.all([notion.getComment(commentId), notion.getPage(pageId)]);
  const commentText = comment.rich_text.map((t) => t.plain_text).join("");

  const tag = readTitle(page.properties.Name);
  const prNumber = findPrNumber(commentText) ?? findPrNumber(page.url) ?? findPrInPageProps(page);
  if (!prNumber) return json({ ok: true, skipped: `no PR ref in comment or page; tag=${tag}` });

  const { owner, repo } = parseRepo(env);
  const github = new GithubClient(env.GITHUB_TOKEN);
  const body = [
    `> Forwarded from Notion changelog "${tag}":`,
    "",
    commentText,
    "",
    `_Source: ${page.url}_`
  ].join("\n");

  const result = await github.createIssueComment(owner, repo, prNumber, body);
  return json({ ok: true, action: "comment_forwarded", url: result.html_url });
}

function findPrNumber(text: string): number | null {
  const a = PR_URL_RE.exec(text);
  if (a) return Number(a[1]);
  const b = PR_REF_RE.exec(text);
  if (b) return Number(b[1]);
  return null;
}

function findPrInPageProps(page: { properties: Record<string, unknown> }): number | null {
  const prProp = page.properties["PR Number"] as { number?: number | null } | undefined;
  if (typeof prProp?.number === "number") return prProp.number;
  return null;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  });
}

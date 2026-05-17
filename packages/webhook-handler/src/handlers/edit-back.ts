import type { Env } from "../config.js";
import { parseRepo } from "../config.js";
import { GithubClient } from "../github.js";
import { NotionClient, readRichText, readTitle } from "../notion.js";

export interface PageUpdatedEvent {
  type: string;
  page?: { id: string };
  entity?: { id: string };
  data?: { updated_properties?: string[] };
}

const TRACKED_PROPERTIES = new Set(["Description", "Summary", "Notes"]);

export async function handleEditBack(env: Env, event: PageUpdatedEvent): Promise<Response> {
  const pageId = event.page?.id ?? event.entity?.id;
  if (!pageId) return json({ ok: true, skipped: "no page id" });

  const changed = event.data?.updated_properties ?? [];
  const relevant = changed.filter((p) => TRACKED_PROPERTIES.has(p));
  if (!relevant.length) {
    return json({ ok: true, skipped: `no tracked properties changed (${changed.join(",")})` });
  }

  const notion = new NotionClient(env.NOTION_TOKEN);
  const page = await notion.getPage(pageId);
  const title = readTitle(page.properties.Name);

  const sections = relevant.map((prop) => `### ${prop}\n${readRichText(page.properties[prop])}`).join("\n\n");

  const { owner, repo } = parseRepo(env);
  const github = new GithubClient(env.GITHUB_TOKEN);
  const issue = await github.createIssue(owner, repo, {
    title: `[FlowSync] Sync Notion edit for "${title}"`,
    body: [
      `A user edited Notion page **${title}** in the following properties:`,
      "",
      sections,
      "",
      `Notion source: ${page.url}`,
      "",
      "_This issue was opened automatically by FlowSync. Update the corresponding source (JSDoc/OpenAPI/migration comment) and close._"
    ].join("\n"),
    labels: ["flowsync:edit-back", "docs"]
  });

  return json({ ok: true, action: "issue_opened", url: issue.html_url });
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  });
}

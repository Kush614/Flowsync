import type { Env } from "../config.js";
import { parseRepo } from "../config.js";
import { GithubClient } from "../github.js";
import { NotionClient, readRichText, readSelectOrStatus, readTitle } from "../notion.js";

export interface PageEvent {
  type: string;
  page?: { id: string };
  data?: { parent?: { database_id?: string } };
}

export async function handleReleaseApproval(env: Env, event: PageEvent): Promise<Response> {
  const pageId =
    event.page?.id ??
    (event as { entity?: { id: string } }).entity?.id ??
    (event as { data?: { id?: string } }).data?.id;
  if (!pageId) return json({ ok: true, skipped: "no page id" });

  const notion = new NotionClient(env.NOTION_TOKEN);
  const page = await notion.getPage(pageId);

  const status = readSelectOrStatus(page.properties[env.NOTION_RELEASE_STATUS_PROPERTY]);
  console.log(`[RELEASE] page=${pageId.slice(0, 8)} status="${status}" want="${env.NOTION_RELEASE_APPROVED_VALUE}"`);
  if (status !== env.NOTION_RELEASE_APPROVED_VALUE) {
    return json({ ok: true, skipped: `status is "${status}", not "${env.NOTION_RELEASE_APPROVED_VALUE}"` });
  }

  const tag = readTitle(page.properties.Name);
  if (!tag) return json({ ok: true, skipped: "no tag in title" });

  const notes = readRichText(page.properties["Release Notes"]) || `See ${page.url}`;
  const { owner, repo } = parseRepo(env);
  const github = new GithubClient(env.GITHUB_TOKEN);

  try {
    const release = await github.createRelease(owner, repo, {
      tag_name: tag,
      name: tag,
      body: `${notes}\n\nApproved via Notion: ${page.url}`,
      draft: false
    });
    console.log(`[RELEASE] published: ${release.html_url}`);
    return json({ ok: true, action: "release_created", url: release.html_url });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("already_exists") || msg.includes("422")) {
      console.log(`[RELEASE] tag ${tag} already released, skipping`);
      return json({ ok: true, skipped: "release already exists" });
    }
    throw err;
  }
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  });
}

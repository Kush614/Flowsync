import { type Env, watchedDatabaseIds } from "./config.js";
import { verifyNotionSignature } from "./signature.js";
import { handleReleaseApproval } from "./handlers/release-approval.js";
import { handleCommentForwarded } from "./handlers/comment-forwarder.js";
import { handleEditBack } from "./handlers/edit-back.js";

interface NotionEvent {
  type: string;
  verification_token?: string;
  challenge?: string;
  data?: {
    parent?: { database_id?: string; page_id?: string };
    updated_properties?: string[];
    id?: string;
  };
  page?: { id: string };
  entity?: { id: string; type?: string };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "GET") {
      return new Response("FlowSync webhook OK\n", { status: 200 });
    }
    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    const rawBody = await request.text();

    let body: NotionEvent;
    try {
      body = JSON.parse(rawBody) as NotionEvent;
    } catch {
      return new Response("invalid json", { status: 400 });
    }

    if (body.challenge) {
      return Response.json({ challenge: body.challenge });
    }

    const valid = await verifyNotionSignature(
      env.NOTION_WEBHOOK_VERIFICATION_TOKEN,
      rawBody,
      request.headers.get("X-Notion-Signature")
    );
    if (!valid) return new Response("invalid signature", { status: 401 });

    if (!isWatchedDatabase(env, body)) {
      return Response.json({ ok: true, skipped: "database not watched" });
    }

    try {
      switch (body.type) {
        case "page.properties_updated":
        case "page.content_updated":
        case "page.updated":
          if (await statusFlippedToApproved(env, body)) {
            return await handleReleaseApproval(env, body);
          }
          return await handleEditBack(env, body);

        case "comment.created":
          return await handleCommentForwarded(env, body as never);

        default:
          return Response.json({ ok: true, skipped: `unhandled event ${body.type}` });
      }
    } catch (err) {
      console.error(err);
      return Response.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
    }
  }
};

async function statusFlippedToApproved(env: Env, body: NotionEvent): Promise<boolean> {
  const updated = (body.data as { updated_properties?: string[] } | undefined)?.updated_properties ?? [];
  return updated.includes(env.NOTION_RELEASE_STATUS_PROPERTY);
}

function isWatchedDatabase(env: Env, body: NotionEvent): boolean {
  const ids = watchedDatabaseIds(env);
  if (ids.size === 0) return true;
  const dbId = body.data?.parent?.database_id?.replace(/-/g, "");
  if (!dbId) return true;
  return ids.has(dbId);
}

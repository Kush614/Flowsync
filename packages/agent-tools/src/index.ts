import type { Env } from "./env.js";
import { describeManifest } from "./manifest.js";
import { generateChangelog } from "./tools/generate-changelog.js";
import { publishRelease } from "./tools/publish-release.js";
import { syncApiReference } from "./tools/sync-api-reference.js";
import { queryRelease } from "./tools/query-release.js";

interface ToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/healthz") {
      return Response.json({ ok: true, service: "flowsync-agent-tools", tools: describeManifest().tools.length });
    }
    if (request.method === "GET" && url.pathname === "/tools") {
      return Response.json(describeManifest());
    }
    if (request.method === "GET") {
      return new Response("FlowSync agent tools OK. GET /tools for manifest.\n", { status: 200 });
    }
    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    let call: ToolCall;
    try {
      call = (await request.json()) as ToolCall;
    } catch {
      return jsonErr(400, "invalid json");
    }
    if (!call.name) return jsonErr(400, "missing tool name");

    try {
      const text = await dispatch(env, call);
      return Response.json({
        content: [{ type: "text", text }]
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(message);
      return Response.json({
        isError: true,
        content: [{ type: "text", text: message }]
      });
    }
  }
};

async function dispatch(env: Env, call: ToolCall): Promise<string> {
  switch (call.name) {
    case "generate_changelog":
      return generateChangelog(env, call.arguments as never);
    case "publish_release":
      return publishRelease(env, call.arguments as never);
    case "sync_api_reference":
      return syncApiReference(env, call.arguments as never);
    case "query_release":
      return queryRelease(env, call.arguments as never);
    default:
      throw new Error(`Unknown tool: ${call.name}`);
  }
}

function jsonErr(status: number, message: string): Response {
  return new Response(JSON.stringify({ isError: true, error: message }), {
    status,
    headers: { "content-type": "application/json" }
  });
}

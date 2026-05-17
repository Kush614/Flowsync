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

const SERVER_INFO = { name: "flowsync-agent-tools", version: "0.1.0" };
const DEFAULT_PROTOCOL = "2025-06-18";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, mcp-session-id, mcp-protocol-version"
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS });
    }

    if (request.method === "GET" && url.pathname === "/healthz") {
      return Response.json({
        ok: true,
        service: SERVER_INFO.name,
        tools: describeManifest().tools.length,
        mcp: "/mcp"
      });
    }
    if (request.method === "GET" && url.pathname === "/tools") {
      return Response.json(describeManifest());
    }
    if (request.method === "GET") {
      return new Response(
        "FlowSync agent tools OK.\n  GET  /tools  — manifest\n  POST /mcp    — MCP (JSON-RPC 2.0)\n  POST /       — legacy {name,arguments}\n",
        { status: 200 }
      );
    }
    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    // ---- MCP endpoint: spec-compliant JSON-RPC 2.0 (Streamable HTTP) ----
    if (url.pathname === "/mcp") {
      return handleMcp(request, env);
    }

    // ---- Legacy simple protocol: {name, arguments} ----
    let call: ToolCall;
    try {
      call = (await request.json()) as ToolCall;
    } catch {
      return jsonErr(400, "invalid json");
    }
    if (!call.name) return jsonErr(400, "missing tool name");

    try {
      const text = await dispatch(env, call);
      return Response.json({ content: [{ type: "text", text }] });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(message);
      return Response.json({ isError: true, content: [{ type: "text", text: message }] });
    }
  }
};

interface JsonRpcReq {
  jsonrpc: "2.0";
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown>;
}

async function handleMcp(request: Request, env: Env): Promise<Response> {
  let body: JsonRpcReq;
  try {
    body = (await request.json()) as JsonRpcReq;
  } catch {
    return rpcError(null, -32700, "Parse error");
  }

  const { id, method, params } = body;
  const isNotification = id === undefined || id === null;

  try {
    switch (method) {
      case "initialize": {
        const requested = (params?.protocolVersion as string) || DEFAULT_PROTOCOL;
        return rpcOk(id, {
          protocolVersion: requested,
          capabilities: { tools: { listChanged: false } },
          serverInfo: SERVER_INFO,
          instructions:
            "FlowSync tools: generate a changelog from a GitHub repo, publish a release from a Notion page, sync an OpenAPI spec, or query a release. All write into the connected Notion workspace."
        });
      }

      case "notifications/initialized":
      case "notifications/cancelled":
        return new Response(null, { status: 202, headers: CORS });

      case "ping":
        return rpcOk(id, {});

      case "tools/list":
        return rpcOk(id, {
          tools: describeManifest().tools.map((t) => ({
            name: t.name,
            description: t.description,
            inputSchema: t.inputSchema
          }))
        });

      case "tools/call": {
        const name = params?.name as string;
        const args = (params?.arguments as Record<string, unknown>) ?? {};
        if (!name) return rpcError(id, -32602, "Missing params.name");
        try {
          const text = await dispatch(env, { name, arguments: args });
          return rpcOk(id, { content: [{ type: "text", text }], isError: false });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          return rpcOk(id, { content: [{ type: "text", text: message }], isError: true });
        }
      }

      default:
        if (isNotification) return new Response(null, { status: 202, headers: CORS });
        return rpcError(id, -32601, `Method not found: ${method}`);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[mcp]", message);
    return rpcError(id ?? null, -32603, message);
  }
}

function rpcOk(id: JsonRpcReq["id"], result: unknown): Response {
  return new Response(JSON.stringify({ jsonrpc: "2.0", id, result }), {
    status: 200,
    headers: { "content-type": "application/json", ...CORS }
  });
}

function rpcError(id: JsonRpcReq["id"] | null, code: number, message: string): Response {
  return new Response(JSON.stringify({ jsonrpc: "2.0", id: id ?? null, error: { code, message } }), {
    status: 200,
    headers: { "content-type": "application/json", ...CORS }
  });
}

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
    headers: { "content-type": "application/json", ...CORS }
  });
}

import { ApiReferenceUpserter, FlowSyncClient, type ApiEndpointRecord } from "@flowsync/core";
import type { Env } from "../env.js";
import { requireEnv } from "../env.js";

export interface SyncApiReferenceArgs {
  specUrl: string;
}

const METHODS = ["get", "post", "put", "patch", "delete", "options", "head"] as const;
type Json = Record<string, unknown>;

export async function syncApiReference(env: Env, args: SyncApiReferenceArgs): Promise<string> {
  const res = await fetch(args.specUrl, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`Failed to fetch spec: ${res.status} ${args.specUrl}`);
  const spec = (await res.json()) as Json;

  const records = parseOpenApi(spec);
  if (records.length === 0) return `Spec has no endpoints.`;

  const notion = new FlowSyncClient({ token: requireEnv(env, "NOTION_TOKEN") });
  const upserter = new ApiReferenceUpserter(notion, requireEnv(env, "NOTION_API_REFERENCE_DB_ID"));
  const { created, updated } = await upserter.upsertMany(records);

  return `Synced ${records.length} endpoints from ${args.specUrl}. Created ${created}, updated ${updated}.`;
}

function parseOpenApi(spec: Json): ApiEndpointRecord[] {
  const paths = (spec.paths ?? {}) as Record<string, Json>;
  const out: ApiEndpointRecord[] = [];
  for (const [route, methods] of Object.entries(paths)) {
    for (const method of METHODS) {
      const op = methods[method] as Json | undefined;
      if (!op) continue;
      out.push({
        operationId: (op.operationId as string) ?? `${method.toUpperCase()} ${route}`,
        method: method.toUpperCase() as ApiEndpointRecord["method"],
        path: route,
        summary: op.summary as string | undefined,
        description: op.description as string | undefined,
        tags: ((op.tags as string[]) ?? []).slice(0, 20),
        deprecated: Boolean(op.deprecated),
        requestBodySchema: extractBody(op),
        responses: extractResponses(op)
      });
    }
  }
  return out;
}

function extractBody(op: Json): string | undefined {
  const body = op.requestBody as Json | undefined;
  const json = (body?.content as Json | undefined)?.["application/json"] as Json | undefined;
  if (!json?.schema) return undefined;
  return JSON.stringify(json.schema, null, 2);
}

function extractResponses(op: Json) {
  const responses = (op.responses as Json | undefined) ?? {};
  return Object.entries(responses).map(([status, value]) => {
    const v = value as Json;
    const json = ((v.content as Json | undefined)?.["application/json"] as Json | undefined)?.schema;
    return {
      status,
      description: v.description as string | undefined,
      schema: json ? JSON.stringify(json, null, 2) : undefined
    };
  });
}

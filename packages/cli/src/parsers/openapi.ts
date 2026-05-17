import { readFileSync } from "node:fs";
import type { ApiEndpointRecord } from "@flowsync/core";

type Json = Record<string, unknown>;
const METHODS = ["get", "post", "put", "patch", "delete", "options", "head"] as const;

export function parseOpenApi(path: string): ApiEndpointRecord[] {
  const raw = readFileSync(path, "utf8");
  const spec = parseSpec(raw, path);
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
        requestBodySchema: extractRequestBody(op),
        responses: extractResponses(op)
      });
    }
  }
  return out;
}

function parseSpec(raw: string, path: string): Json {
  if (path.endsWith(".json")) return JSON.parse(raw) as Json;
  throw new Error("Only OpenAPI .json input is supported in the MVP. Convert YAML with `swagger-cli bundle -t json`.");
}

function extractRequestBody(op: Json): string | undefined {
  const body = op.requestBody as Json | undefined;
  if (!body) return undefined;
  const content = body.content as Json | undefined;
  const json = content?.["application/json"] as Json | undefined;
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

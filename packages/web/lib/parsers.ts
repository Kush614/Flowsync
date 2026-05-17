import type { ApiEndpointRecord, ChangeItem, TableRecord, ColumnRecord } from "@flowsync/core";

type Json = Record<string, unknown>;
const METHODS = ["get", "post", "put", "patch", "delete", "options", "head"] as const;

export function parseOpenApiText(raw: string): ApiEndpointRecord[] {
  const spec = JSON.parse(raw) as Json;
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

const MODEL_RE = /^model\s+(\w+)\s*\{([\s\S]*?)\n\}/gm;
const FIELD_RE = /^\s*(\w+)\s+([\w?\[\]]+)([^\n]*)$/gm;

export function parsePrismaText(raw: string): TableRecord[] {
  const tables: TableRecord[] = [];

  for (const modelMatch of raw.matchAll(MODEL_RE)) {
    const name = modelMatch[1];
    const body = modelMatch[2];
    const columns: ColumnRecord[] = [];

    for (const fieldMatch of body.matchAll(FIELD_RE)) {
      const [, fieldName, fieldType, rest] = fieldMatch;
      if (fieldName.startsWith("@@")) continue;
      if (fieldType === "") continue;
      const nullable = fieldType.endsWith("?");
      const isList = fieldType.endsWith("[]");
      const baseType = fieldType.replace(/[?\[\]]/g, "");
      const isPrimaryKey = /@id\b/.test(rest);
      const fk = /@relation\([^)]*references:\s*\[(\w+)\][^)]*\)/.exec(rest);
      const referencesTable = fk ? baseType : undefined;
      const defaultMatch = /@default\(([^)]+)\)/.exec(rest);

      columns.push({
        name: fieldName,
        type: isList ? `${baseType}[]` : baseType,
        nullable,
        isPrimaryKey,
        isForeignKey: Boolean(fk),
        referencesTable,
        default: defaultMatch?.[1]
      });
    }

    tables.push({ name, columns });
  }

  return tables;
}

export interface ParsedCommit {
  sha?: string;
  author?: string;
  subject: string;
}

export function parseCommitsText(raw: string): ParsedCommit[] {
  return raw
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split("\t");
      if (parts.length >= 3) return { sha: parts[0], author: parts[1], subject: parts.slice(2).join("\t") };
      if (parts.length === 2) return { author: parts[0], subject: parts[1] };
      return { subject: line };
    });
}

export interface BucketedCommits {
  features: ChangeItem[];
  fixes: ChangeItem[];
  chores: ChangeItem[];
  breaking: ChangeItem[];
}

export function bucketCommits(commits: ParsedCommit[]): BucketedCommits {
  const features: ChangeItem[] = [];
  const fixes: ChangeItem[] = [];
  const chores: ChangeItem[] = [];
  const breaking: ChangeItem[] = [];

  for (const c of commits) {
    const m = /^(feat|fix|chore|docs|refactor|perf|test|build|ci|style|revert)(\([^)]+\))?(!)?:\s*(.+)$/i.exec(c.subject);
    const item: ChangeItem = {
      summary: m ? m[4].trim() : c.subject,
      author: c.author,
      sha: c.sha
    };
    if (m?.[3] === "!") breaking.push(item);
    else if (m?.[1]?.toLowerCase() === "feat") features.push(item);
    else if (m?.[1]?.toLowerCase() === "fix") fixes.push(item);
    else chores.push(item);
  }

  return { features, fixes, chores, breaking };
}

const LINEAR_RE = /\b([A-Z]{2,10}-\d+)\b/g;

export function extractLinearTickets(commits: ParsedCommit[]): string[] {
  const seen = new Set<string>();
  for (const c of commits) {
    for (const m of c.subject.matchAll(LINEAR_RE)) seen.add(m[1]);
  }
  return [...seen];
}

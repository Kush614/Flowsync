import { readFileSync } from "node:fs";
import type { ColumnRecord, TableRecord } from "@flowsync/core";

const MODEL_RE = /^model\s+(\w+)\s*\{([\s\S]*?)\n\}/gm;
const FIELD_RE = /^\s*(\w+)\s+([\w?\[\]]+)([^\n]*)$/gm;

export function parsePrismaSchema(path: string): TableRecord[] {
  const raw = readFileSync(path, "utf8");
  const tables: TableRecord[] = [];

  for (const modelMatch of raw.matchAll(MODEL_RE)) {
    const name = modelMatch[1];
    const body = modelMatch[2];
    const columns: ColumnRecord[] = [];

    for (const fieldMatch of body.matchAll(FIELD_RE)) {
      const [, fieldName, fieldType, rest] = fieldMatch;
      if (fieldName === "@@id" || fieldName === "@@index" || fieldName === "@@unique" || fieldName.startsWith("@@")) continue;
      if (fieldType === "") continue;
      const nullable = fieldType.endsWith("?");
      const isList = fieldType.endsWith("[]");
      const baseType = fieldType.replace(/[?\[\]]/g, "");
      const isPrimaryKey = /@id\b/.test(rest);
      const fk = /@relation\([^)]*references:\s*\[(\w+)\][^)]*\)/.exec(rest);
      const referencesTable = fk ? baseType : undefined;
      const defaultMatch = /@default\((.+?)\)(?=\s|$|@)/.exec(rest);

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

import { FlowSyncClient } from "../notion-client.js";
import { blocks } from "../block-builder.js";
import { normalizeId } from "../util.js";
import { replacePageChildren } from "./common.js";
import type { BlockObjectRequest } from "@notionhq/client/build/src/api-endpoints.js";

export interface ColumnRecord {
  name: string;
  type: string;
  nullable: boolean;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  referencesTable?: string;
  default?: string;
  comment?: string;
}

export interface TableRecord {
  name: string;
  schema?: string;
  description?: string;
  columns: ColumnRecord[];
}

export class DataDictionaryUpserter {
  private readonly databaseId: string;

  constructor(private readonly client: FlowSyncClient, databaseId: string) {
    this.databaseId = normalizeId(databaseId);
  }

  async upsertTable(table: TableRecord): Promise<{ pageId: string; created: boolean }> {
    const existing = await this.findByName(table.name);
    const properties = this.props(table);
    const body = this.body(table);

    if (existing) {
      await this.client.withRetry(() =>
        this.client.notion.pages.update({ page_id: existing, properties: properties as never })
      );
      await replacePageChildren(this.client, existing, body);
      return { pageId: existing, created: false };
    }

    const created = await this.client.withRetry(() =>
      this.client.notion.pages.create({
        parent: { database_id: this.databaseId },
        properties: properties as never,
        children: body
      })
    );
    return { pageId: created.id, created: true };
  }

  private async findByName(name: string): Promise<string | null> {
    const res = await this.client.withRetry(() =>
      this.client.notion.databases.query({
        database_id: this.databaseId,
        filter: { property: "Name", title: { equals: name } },
        page_size: 1
      })
    );
    return res.results[0]?.id ?? null;
  }

  private props(table: TableRecord): Record<string, unknown> {
    return {
      Name: { title: [{ type: "text", text: { content: table.name } }] },
      Schema: { rich_text: [{ type: "text", text: { content: table.schema ?? "public" } }] },
      Columns: { number: table.columns.length },
      "Has FK": { checkbox: table.columns.some((c) => c.isForeignKey) }
    };
  }

  private body(table: TableRecord): BlockObjectRequest[] {
    const out: BlockObjectRequest[] = [];
    if (table.description) out.push(blocks.p(table.description));

    out.push(blocks.h3("Columns"));
    for (const col of table.columns) {
      const flags = [
        col.isPrimaryKey ? "PK" : null,
        col.isForeignKey ? `FK → ${col.referencesTable ?? "?"}` : null,
        col.nullable ? "nullable" : "not null",
        col.default ? `default ${col.default}` : null
      ]
        .filter(Boolean)
        .join(", ");
      out.push(blocks.bullet(`${col.name} : ${col.type} — ${flags}`));
    }

    const fks = table.columns.filter((c) => c.isForeignKey && c.referencesTable);
    if (fks.length) {
      out.push(blocks.h3("Relations"));
      for (const fk of fks) {
        out.push(blocks.bullet(`${fk.name} → ${fk.referencesTable}`));
      }
    }

    return out;
  }
}

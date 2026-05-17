import { FlowSyncClient } from "../notion-client.js";
import { blocks } from "../block-builder.js";
import { normalizeId, truncate } from "../util.js";
import { replacePageChildren } from "./common.js";
import type { BlockObjectRequest } from "@notionhq/client/build/src/api-endpoints.js";

export interface ApiEndpointRecord {
  operationId: string;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "OPTIONS" | "HEAD";
  path: string;
  summary?: string;
  description?: string;
  tags: string[];
  deprecated: boolean;
  requestBodySchema?: string;
  responses: Array<{ status: string; description?: string; schema?: string }>;
}

export class ApiReferenceUpserter {
  private readonly databaseId: string;

  constructor(private readonly client: FlowSyncClient, databaseId: string) {
    this.databaseId = normalizeId(databaseId);
  }

  async upsertMany(records: ApiEndpointRecord[]): Promise<{ created: number; updated: number }> {
    let created = 0;
    let updated = 0;
    for (const record of records) {
      const existing = await this.findByOperationId(record.operationId);
      if (existing) {
        await this.update(existing, record);
        updated++;
      } else {
        await this.create(record);
        created++;
      }
    }
    return { created, updated };
  }

  private async findByOperationId(operationId: string): Promise<string | null> {
    const res = await this.client.withRetry(() =>
      this.client.notion.databases.query({
        database_id: this.databaseId,
        filter: { property: "Operation", rich_text: { equals: operationId } },
        page_size: 1
      })
    );
    return res.results[0]?.id ?? null;
  }

  private async create(record: ApiEndpointRecord): Promise<void> {
    await this.client.withRetry(() =>
      this.client.notion.pages.create({
        parent: { database_id: this.databaseId },
        properties: this.props(record) as never,
        children: this.body(record)
      })
    );
  }

  private async update(pageId: string, record: ApiEndpointRecord): Promise<void> {
    await this.client.withRetry(() =>
      this.client.notion.pages.update({ page_id: pageId, properties: this.props(record) as never })
    );
    await replacePageChildren(this.client, pageId, this.body(record));
  }

  private props(record: ApiEndpointRecord): Record<string, unknown> {
    return {
      Name: {
        title: [{ type: "text", text: { content: `${record.method} ${record.path}` } }]
      },
      Operation: {
        rich_text: [{ type: "text", text: { content: record.operationId } }]
      },
      Method: { select: { name: record.method } },
      Path: { rich_text: [{ type: "text", text: { content: record.path } }] },
      Tags: { multi_select: record.tags.map((name) => ({ name })) },
      Deprecated: { checkbox: record.deprecated }
    };
  }

  private body(record: ApiEndpointRecord): BlockObjectRequest[] {
    const out: BlockObjectRequest[] = [];
    if (record.summary) out.push(blocks.h2(record.summary));
    if (record.description) out.push(blocks.p(truncate(record.description)));

    if (record.requestBodySchema) {
      out.push(blocks.h3("Request body"));
      out.push(blocks.code(record.requestBodySchema, "json"));
    }

    if (record.responses.length) {
      out.push(blocks.h3("Responses"));
      for (const r of record.responses) {
        out.push(blocks.bullet(`${r.status} — ${r.description ?? ""}`));
        if (r.schema) out.push(blocks.code(r.schema, "json"));
      }
    }

    return out;
  }
}

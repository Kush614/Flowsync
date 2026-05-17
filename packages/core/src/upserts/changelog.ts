import type { BlockObjectRequest } from "@notionhq/client/build/src/api-endpoints.js";
import { FlowSyncClient } from "../notion-client.js";
import { blocks } from "../block-builder.js";
import { normalizeId, truncate } from "../util.js";
import { replacePageChildren } from "./common.js";
import { notionUsersFor, type PeopleMap } from "../people-map.js";

export interface ChangelogEntry {
  releaseTag: string;
  releaseDate: string;
  features: ChangeItem[];
  fixes: ChangeItem[];
  chores: ChangeItem[];
  breaking: ChangeItem[];
  commitRange?: { from: string; to: string };
  linearTickets?: string[];
  customerRelationIds?: string[];
}

export interface ChangeItem {
  summary: string;
  prUrl?: string;
  author?: string;
  sha?: string;
}

export interface UpsertResult {
  pageId: string;
  created: boolean;
  url: string;
}

export interface ChangelogUpserterOptions {
  peopleMap?: PeopleMap;
  linearRelationProperty?: string;
  authorsPeopleProperty?: string;
  customerRelationProperty?: string;
}

export class ChangelogUpserter {
  private readonly databaseId: string;
  private readonly opts: ChangelogUpserterOptions;

  constructor(
    private readonly client: FlowSyncClient,
    databaseId: string,
    opts: ChangelogUpserterOptions = {}
  ) {
    this.databaseId = normalizeId(databaseId);
    this.opts = opts;
  }

  async upsert(entry: ChangelogEntry): Promise<UpsertResult> {
    const existing = await this.findByTag(entry.releaseTag);
    const properties = this.buildProperties(entry);
    const children = this.buildBody(entry);

    if (existing) {
      const updated = await this.client.withRetry(() =>
        this.client.notion.pages.update({ page_id: existing, properties: properties as never })
      );
      await replacePageChildren(this.client, existing, children);
      return { pageId: existing, created: false, url: (updated as { url: string }).url };
    }

    const created = await this.client.withRetry(() =>
      this.client.notion.pages.create({
        parent: { database_id: this.databaseId },
        properties: properties as never,
        children
      })
    );
    return { pageId: created.id, created: true, url: (created as { url: string }).url };
  }

  private async findByTag(tag: string): Promise<string | null> {
    const res = await this.client.withRetry(() =>
      this.client.notion.databases.query({
        database_id: this.databaseId,
        filter: { property: "Name", title: { equals: tag } },
        page_size: 1
      })
    );
    return res.results[0]?.id ?? null;
  }

  private buildProperties(entry: ChangelogEntry): Record<string, unknown> {
    const props: Record<string, unknown> = {
      Name: { title: [{ type: "text", text: { content: entry.releaseTag } }] },
      "Release Date": { date: { start: entry.releaseDate } },
      Features: { number: entry.features.length },
      Fixes: { number: entry.fixes.length },
      Breaking: { number: entry.breaking.length }
    };

    if (this.opts.peopleMap && this.opts.authorsPeopleProperty) {
      const all = [...entry.features, ...entry.fixes, ...entry.chores, ...entry.breaking];
      const userIds = notionUsersFor(this.opts.peopleMap, all.map((c) => c.author));
      props[this.opts.authorsPeopleProperty] = {
        people: userIds.map((id) => ({ id }))
      };
    }

    if (entry.linearTickets?.length && this.opts.linearRelationProperty) {
      props[this.opts.linearRelationProperty] = {
        rich_text: [{ type: "text", text: { content: entry.linearTickets.join(", ") } }]
      };
    }

    if (entry.customerRelationIds?.length && this.opts.customerRelationProperty) {
      props[this.opts.customerRelationProperty] = {
        relation: entry.customerRelationIds.map((id) => ({ id }))
      };
    }

    return props;
  }

  private buildBody(entry: ChangelogEntry): BlockObjectRequest[] {
    const out: BlockObjectRequest[] = [];

    if (entry.commitRange) {
      out.push(
        blocks.callout(
          `Range ${entry.commitRange.from.slice(0, 7)}..${entry.commitRange.to.slice(0, 7)} on ${entry.releaseDate}`,
          "rocket"
        )
      );
    }

    if (entry.breaking.length) {
      out.push(this.breakingChangeBanner(entry.breaking.length));
      out.push(this.section("Breaking changes", entry.breaking));
    }
    if (entry.features.length) out.push(this.section("Features", entry.features));
    if (entry.fixes.length) out.push(this.section("Fixes", entry.fixes));
    if (entry.chores.length) out.push(this.section("Chores", entry.chores));

    if (entry.linearTickets?.length) {
      out.push(blocks.h3("Linear tickets"));
      for (const ticket of entry.linearTickets) {
        out.push(blocks.bullet(ticket));
      }
    }

    return out;
  }

  private section(title: string, items: ChangeItem[]): BlockObjectRequest {
    return blocks.toggle(
      `${title} (${items.length})`,
      items.map((item) => blocks.bullet(this.formatItem(item), item.prUrl))
    );
  }

  private formatItem(item: ChangeItem): string {
    const author = item.author ? ` — @${item.author}` : "";
    const sha = item.sha ? ` (${item.sha.slice(0, 7)})` : "";
    return `${truncate(item.summary, 1800)}${sha}${author}`;
  }

  private breakingChangeBanner(count: number): BlockObjectRequest {
    const lead = this.opts.peopleMap?.breakingChangeLead;
    if (!lead) {
      return blocks.callout(`${count} breaking change(s) in this release. Review carefully.`, "warning");
    }
    return {
      object: "block",
      type: "callout",
      callout: {
        rich_text: [
          { type: "text", text: { content: `${count} breaking change(s) — review with ` } },
          { type: "mention", mention: { type: "user", user: { id: lead } } } as never,
          { type: "text", text: { content: " before release." } }
        ],
        icon: { type: "emoji", emoji: "⚠️" as never }
      }
    };
  }
}

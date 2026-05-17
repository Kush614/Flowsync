import type { BlockObjectRequest } from "@notionhq/client/build/src/api-endpoints.js";
import { FlowSyncClient } from "../notion-client.js";
import { chunk } from "../util.js";

export async function replacePageChildren(
  client: FlowSyncClient,
  pageId: string,
  children: BlockObjectRequest[]
): Promise<void> {
  let cursor: string | undefined;
  do {
    const page = await client.withRetry(() =>
      client.notion.blocks.children.list({ block_id: pageId, page_size: 100, start_cursor: cursor })
    );
    for (const block of page.results) {
      const id = (block as { id: string }).id;
      await client.withRetry(() => client.notion.blocks.delete({ block_id: id }));
    }
    cursor = page.has_more ? page.next_cursor ?? undefined : undefined;
  } while (cursor);

  for (const batch of chunk(children, 100)) {
    await client.withRetry(() =>
      client.notion.blocks.children.append({ block_id: pageId, children: batch })
    );
  }
}

export async function appendPageChildren(
  client: FlowSyncClient,
  pageId: string,
  children: BlockObjectRequest[]
): Promise<void> {
  for (const batch of chunk(children, 100)) {
    await client.withRetry(() =>
      client.notion.blocks.children.append({ block_id: pageId, children: batch })
    );
  }
}

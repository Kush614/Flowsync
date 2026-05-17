import type { BlockObjectRequest } from "@notionhq/client/build/src/api-endpoints.js";
import { FlowSyncClient } from "./notion-client.js";

export async function createSyncedSource(
  client: FlowSyncClient,
  parentPageId: string,
  children: BlockObjectRequest[]
): Promise<string> {
  const synced: BlockObjectRequest = {
    object: "block",
    type: "synced_block",
    synced_block: {
      synced_from: null,
      children: children as never
    }
  };

  const res = await client.withRetry(() =>
    client.notion.blocks.children.append({
      block_id: parentPageId,
      children: [synced]
    })
  );

  const block = res.results[0];
  if (!block || !("id" in block)) {
    throw new Error("Failed to create synced source block");
  }
  return block.id as string;
}

export async function referenceSynced(
  client: FlowSyncClient,
  targetPageId: string,
  sourceBlockId: string
): Promise<void> {
  const reference: BlockObjectRequest = {
    object: "block",
    type: "synced_block",
    synced_block: {
      synced_from: { type: "block_id", block_id: sourceBlockId }
    }
  };
  await client.withRetry(() =>
    client.notion.blocks.children.append({
      block_id: targetPageId,
      children: [reference]
    })
  );
}

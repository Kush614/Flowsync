export interface NotionPage {
  id: string;
  url: string;
  parent: { database_id?: string; page_id?: string };
  properties: Record<string, NotionProperty>;
}

export type NotionProperty = { type: string; [k: string]: unknown };

export class NotionClient {
  constructor(private readonly token: string) {}

  private async req<T>(path: string, init: RequestInit = {}): Promise<T> {
    const res = await fetch(`https://api.notion.com/v1${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Notion-Version": "2022-06-28",
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...(init.headers ?? {})
      }
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Notion ${res.status} ${path}: ${body}`);
    }
    return (await res.json()) as T;
  }

  getPage(pageId: string): Promise<NotionPage> {
    return this.req(`/pages/${pageId}`);
  }

  getComment(commentId: string): Promise<{ id: string; rich_text: Array<{ plain_text: string }>; created_by: { id: string } }> {
    return this.req(`/comments/${commentId}`);
  }
}

interface RichTextItem { plain_text: string }

export function readTitle(prop: NotionProperty | undefined): string {
  if (!prop || prop.type !== "title") return "";
  const items = (prop.title as RichTextItem[] | undefined) ?? [];
  return items.map((t) => t.plain_text).join("");
}

export function readSelectOrStatus(prop: NotionProperty | undefined): string | null {
  if (!prop) return null;
  if (prop.type === "select") {
    const sel = prop.select as { name: string } | null | undefined;
    return sel?.name ?? null;
  }
  if (prop.type === "status") {
    const sel = prop.status as { name: string } | null | undefined;
    return sel?.name ?? null;
  }
  return null;
}

export function readRichText(prop: NotionProperty | undefined): string {
  if (!prop || prop.type !== "rich_text") return "";
  const items = (prop.rich_text as RichTextItem[] | undefined) ?? [];
  return items.map((t) => t.plain_text).join("");
}

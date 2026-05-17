import type { BlockObjectRequest } from "@notionhq/client/build/src/api-endpoints.js";
import { truncate } from "./util.js";

type RT = { type: "text"; text: { content: string; link?: { url: string } } };

function rt(text: string, link?: string): RT[] {
  const safe = truncate(text);
  return [{ type: "text", text: link ? { content: safe, link: { url: link } } : { content: safe } }];
}

export const blocks = {
  h1: (text: string): BlockObjectRequest => ({
    object: "block",
    type: "heading_1",
    heading_1: { rich_text: rt(text) }
  }),
  h2: (text: string): BlockObjectRequest => ({
    object: "block",
    type: "heading_2",
    heading_2: { rich_text: rt(text) }
  }),
  h3: (text: string): BlockObjectRequest => ({
    object: "block",
    type: "heading_3",
    heading_3: { rich_text: rt(text) }
  }),
  p: (text: string): BlockObjectRequest => ({
    object: "block",
    type: "paragraph",
    paragraph: { rich_text: rt(text) }
  }),
  bullet: (text: string, link?: string): BlockObjectRequest => ({
    object: "block",
    type: "bulleted_list_item",
    bulleted_list_item: { rich_text: rt(text, link) }
  }),
  toggle: (text: string, children: BlockObjectRequest[]): BlockObjectRequest => ({
    object: "block",
    type: "toggle",
    toggle: { rich_text: rt(text), children: children as never }
  }),
  code: (text: string, language: string = "typescript"): BlockObjectRequest => ({
    object: "block",
    type: "code",
    code: { rich_text: rt(text), language: language as never }
  }),
  callout: (text: string, emoji: string = "info"): BlockObjectRequest => {
    const EMOJI: Record<string, string> = {
      info: "ℹ️",
      rocket: "🚀",
      warning: "⚠️",
      check: "✅",
      bug: "🐛",
      sparkles: "✨"
    };
    const icon = EMOJI[emoji] ?? (emoji.length <= 4 ? emoji : "ℹ️");
    return {
      object: "block",
      type: "callout",
      callout: { rich_text: rt(text), icon: { type: "emoji", emoji: icon as never } }
    };
  },
  divider: (): BlockObjectRequest => ({
    object: "block",
    type: "divider",
    divider: {}
  })
};

# FlowSync architecture

```
[ Developer action ]
        |
        v
[ Trigger: GitHub Action / CLI / pre-commit hook ]
        |
        v
[ Parser: PR/commit | OpenAPI | Prisma schema ]
        |
        v
[ FlowSync core: diff + block builder + upserter ]
        |
        v
[ Notion API ]
        |
        v
[ Notion workspace: Changelog DB | API Reference DB | Data Dictionary DB ]
```

## Package layout

- `packages/core` — `@flowsync/core`. Shared Notion client (retry/backoff), block builders, and three upserters: changelog, API reference, data dictionary. No I/O outside of Notion.
- `packages/github-action` — `@flowsync/github-action`. Single-file Node 20 action. Reads PR/commit data via `@actions/github`, drives `ChangelogUpserter`.
- `packages/cli` — `@flowsync/cli`. Commander-based TypeScript CLI with three subcommands: `push` (changelog), `openapi`, `migrations`.
- `cli-py/` — `notion-flowsync` (Python). Sibling CLI for Python-heavy repos. Mirrors `push`.

## The diff / upsert model

Every upserter follows the same pattern:

1. **Find by unique key.** Title (changelog tag, table name) or a dedicated `rich_text` property (`Operation` for OpenAPI).
2. **Build properties.** Database properties are the structured surface — they drive Notion views, sorts, and rollups.
3. **Build body blocks.** Notion blocks are the rich surface — toggles, code, bullets.
4. **Upsert.**
   - **Properties:** `pages.update` is a merge — Notion accepts a partial map.
   - **Body:** `pages.update` cannot replace children, so we list, delete, and re-append. Batched in chunks of 100 (Notion's hard limit per `children.append`).

## Why we don't do block-level diffing

Block-level diffing (only patching the bullet that changed) sounds elegant but is a swamp:
- Notion block IDs are not stable across re-creates.
- Rich-text equality is non-trivial (annotations, mentions, links).
- For changelog and API ref, full body replacement is fast enough and idempotent.

If a later milestone needs partial diffs (e.g., preserving user-added notes), the right approach is "respect annotated sections" — wrap user content in a sentinel block FlowSync skips during replace.

## Auth and secrets

- Notion: integration token, shared as `secrets.NOTION_TOKEN` in GitHub Actions or `.env` locally.
- GitHub: action uses the workflow's `GITHUB_TOKEN`; CLI optionally uses a PAT via `GITHUB_TOKEN` env.

## Failure modes worth knowing

- **Rate limits.** Notion is 3 RPS per integration. `FlowSyncClient.withRetry` handles 429 with exponential backoff.
- **DB schema drift.** If properties named in `props()` don't exist on the Notion DB, the API returns a validation error. The README lists the required schema for each DB.
- **OpenAPI YAML.** MVP only parses JSON. Convert YAML up-front (`swagger-cli bundle -t json`).

# @flowsync/agent-tools

Custom Agent tool surface for FlowSync. Deploy this as a Notion Worker, and any Custom Agent in your workspace (or any external agent that speaks the same protocol — Claude Code, Cursor, Codex) can invoke FlowSync operations via natural language.

## Tools

| Tool | What it does |
|---|---|
| `generate_changelog` | Fetch commits between two tags from GitHub, parse with conventional-commits rules, upsert a Notion Changelog row with toggle sections per category. |
| `publish_release` | Read a Notion changelog page, publish the corresponding GitHub release with the page's notes. |
| `sync_api_reference` | Fetch an OpenAPI 3.x JSON spec, upsert each endpoint into the Notion API Reference DB. |
| `query_release` | Look up a release by tag and return counts of breaking/features/fixes. |

Tool manifest (MCP-style) is served at `GET /tools`. Tool calls go to `POST /` with body `{ "name": "<tool>", "arguments": { ... } }` and return `{ "content": [{ "type": "text", "text": "..." }] }`.

## Why this exists

Notion's Custom Agents handle FAQ, status updates, and workflow automation. With FlowSync's tools attached, a non-engineer can chat with their Notion agent:

- "Ship v1.5"  → agent calls `generate_changelog`, then `publish_release`.
- "What was in v1.4?" → agent calls `query_release`.
- "Sync the staging API spec from staging.example.com/openapi.json" → agent calls `sync_api_reference`.

Result: releases and doc-sync become conversational, not CLI rituals.

## Deploy

> Notion's CLI is `ntn`. Install: `curl -fsSL https://ntn.dev | bash` on macOS/Linux, or `npm install -g ntn`. Windows isn't supported yet — use WSL+Ubuntu or a Mac.

```bash
cd packages/agent-tools
npm install
ntn login
ntn workers deploy
# Set secrets after first deploy (exact secret subcommand may differ —
# check `ntn workers --help`):
#   ntn workers secrets set NOTION_TOKEN
#   ntn workers secrets set GITHUB_TOKEN
#   ntn workers secrets set NOTION_CHANGELOG_DB_ID
#   ntn workers secrets set NOTION_API_REFERENCE_DB_ID
```

Then attach the worker as a tool source in your Custom Agent's settings.

## Smoke test (HTTP)

```bash
curl -X POST https://<worker-url>/ \
  -H "content-type: application/json" \
  -d '{
    "name": "query_release",
    "arguments": { "tag": "v0.1.0" }
  }'
```

## External agents

Per the May 14 announcement, Claude Code, Cursor, Codex, and Decagon are supported as external agents. Each can attach this worker's `/tools` manifest as an MCP-style tool source. So:

- Claude Code in your terminal can call `generate_changelog` mid-conversation.
- Cursor can call `sync_api_reference` when you save an OpenAPI file.
- A Decagon support agent can call `query_release` when a customer asks "is the bug fix out yet?"

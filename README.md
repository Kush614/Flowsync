# Notion FlowSync

> Engineering-specific documentation sync for Notion. Built on the Notion Developer Platform (Workers, Custom Agents, External Agent API, CLI) that shipped May 14, 2026.

## The pitch in one paragraph

Notion's new database sync handles "pull any API into a Notion DB." Useful — but it doesn't know what a *git commit* is, can't parse OpenAPI schemas, doesn't understand semantic-commit categories, and doesn't speak Prisma migrations. FlowSync fills exactly that gap: an opinionated, engineering-native sync layer that turns commits, API specs, and migrations into structured Notion docs — and exposes those operations as Custom Agent tools so "ship v1.5" becomes a chat message, not a CLI ritual.

Built for the **Notion Developer Platform Hackathon**, May 16–17, 2026.

## How FlowSync uses the Notion Developer Platform

| Platform primitive (May 14 announcement) | FlowSync surface | What it does |
|---|---|---|
| **Notion Workers** (sandboxed code, no infra) | `packages/webhook-handler`, `packages/agent-tools` | Deploys via `notion workers deploy`. No external infra. |
| **Database sync** (generic) | `packages/core` | Engineering-specific layer on top: commit parsing, AST-based schema reading, OpenAPI introspection. |
| **Custom Agent tools** | `packages/agent-tools` | Exposes `generate_changelog`, `publish_release`, `sync_api_reference`, `query_release` as MCP-style tools any Notion agent can call. |
| **External Agent API** (Claude Code, Cursor, Codex, Decagon) | `packages/agent-tools` | Same tool surface — external agents attach the manifest and call FlowSync from any IDE or chat. |
| **Webhooks** | `packages/webhook-handler` | Signature-verified HTTP handler; routes status flips, comments, and edits back to GitHub. |
| **Notion CLI** | `packages/cli`, `cli-py/` | Local equivalents for engineers who'd rather run `notion-sync push` than wait for an agent. |

## What's in the box

| Package | What it does |
|---|---|
| `@flowsync/core` | Notion client, block builders, upserters (changelog, API reference, data dictionary), people-map, synced blocks. |
| `@flowsync/github-action` | On `v*` tag push, parses commits and upserts a Changelog row. |
| `@flowsync/cli` (TS) | `notion-sync push` / `openapi` / `migrations`. |
| `notion-flowsync` (Python) | Sibling CLI mirroring `push` for Python-heavy repos. |
| `@flowsync/webhook-handler` | Notion Worker for bidirectional flows: release approval, comment forwarding, edit-back. |
| `@flowsync/agent-tools` | Notion Worker exposing FlowSync as Custom Agent tools. |

## What FlowSync does that native Notion sync does not

| Capability | Native Notion DB sync | FlowSync |
|---|---|---|
| Pull rows from Postgres/Salesforce/Zendesk | yes | — |
| Categorize commits by conventional-commits + breaking | — | yes |
| Parse an OpenAPI spec into per-endpoint Notion rows | — | yes |
| Parse a Prisma schema → data dictionary | — | yes |
| `@mention` the breaking-change lead automatically | — | yes |
| Extract Linear ticket IDs from commit messages | — | yes |
| Forward Notion comments to the matching GitHub PR | — | yes |
| Publish a GitHub release from a Notion status flip | — | yes |
| Expose all of the above as Custom Agent tools | — | yes |

FlowSync is built **on top of** the platform, not against it. Where the native sync makes sense (e.g., pulling customer data from Salesforce into a Customers DB so FlowSync can relate releases to customers), FlowSync depends on it.

## Quick start

```powershell
npm install
npm run build
Copy-Item .env.example .env
# edit .env with NOTION_TOKEN and DB IDs
```

Set up the three Notion databases per `docs/DATABASE-SETUP.md`. Then:

### Local CLI
```powershell
node packages/cli/dist/index.js push --tag v0.1.0 --dry-run
node packages/cli/dist/index.js openapi --spec examples/sample-openapi.json --dry-run
node packages/cli/dist/index.js migrations --schema examples/sample.prisma --dry-run
```

### GitHub Action
See `examples/changelog-workflow.yml`. Add a `NOTION_TOKEN` secret and `NOTION_CHANGELOG_DB_ID` variable.

### Notion Worker (bidirectional)
```bash
cd packages/webhook-handler
ntn workers deploy   # requires the Notion CLI (`ntn`), macOS/Linux only as of v0.14.0
```
See `packages/webhook-handler/README.md` for the full secret/config setup, and `docs/CLI-SETUP.md` for installing `ntn` (including the Windows + WSL workaround).

### Custom Agent tools
```bash
cd packages/agent-tools
ntn workers deploy
```
Then attach the worker as a tool source on your Custom Agent. See `packages/agent-tools/README.md`.

## Collaboration features

FlowSync is two-way. Highlights below; full list in `docs/COLLAB-FEATURES.md`.

- **Release approval from Notion** — PMs flip a Status property, FlowSync publishes the GitHub release.
- **Comment forwarding** — Notion comments on changelog rows appear as PR comments with backlinks.
- **Edit-back to source** — editing `Description` / `Summary` / `Notes` on a synced row opens a labeled GitHub issue.
- **Authors as Notion People** — `flowsync/people-map.json` maps GitHub logins to Notion user IDs.
- **Auto-@mention on breaking changes** — a configured lead gets notified.
- **Per-persona views** — Engineering / Product / Support read the same DB through three views.
- **Synced blocks** — write once, surface in three places.
- **Notion AI Q&A** — once the docs are in Notion, ask "what shipped in v1.4?" instead of pinging engineers.
- **Linear ticket relations** — `ENG-1234` in commit messages flows to a Linear Tickets property.
- **Custom Agent tools** — `generate_changelog`, `publish_release`, `sync_api_reference`, `query_release` callable from any agent.

## Demo arc (Sunday 3:30 PM)

1. Merge a PR with `feat!:` (breaking) and `(closes ENG-1234)` → push tag `v1.5.0`.
2. GitHub Action fires → Notion Changelog row appears with toggles, PR links, breaking-change banner that **@mentions** the release lead, and a Linear Tickets cell.
3. Co-founder opens the row, flips Status to `Approved for release`. The Notion Worker fires → real GitHub release appears 4 seconds later.
4. Co-founder comments "this is great" on the row. PR #42 instantly gets a comment with backlink.
5. Open your Notion Custom Agent, say "what's in v1.5?" → agent calls `query_release` → answers in chat.
6. Ask: "sync the staging API spec" → agent calls `sync_api_reference` with the staging URL → API Reference DB updates live on screen.

That's six platform primitives in one demo: Workers, webhooks, Custom Agents, external tools, database manipulation, AI Q&A.

## Architecture

- `docs/ARCHITECTURE.md` — trigger → parse → diff → upsert flow.
- `docs/DATABASE-SETUP.md` — required Notion DB schemas, per-persona views, Notion AI setup.
- `docs/COLLAB-FEATURES.md` — the ten collaboration primitives.
- `docs/CLI-SETUP.md` — installing `ntn`, Windows/WSL situation, and how `ntn` and FlowSync's own CLI relate.
- `packages/webhook-handler/README.md` — deploying the Notion Worker.
- `packages/agent-tools/README.md` — Custom Agent tool manifest.

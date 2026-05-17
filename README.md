# 🔁 FlowSync

**Code writes the docs. The docs ship the code. Both directions, automatically — on the Notion Developer Platform.**

Built for the Notion Developer Platform Hackathon, May 2026.

---

## TL;DR for judges

- **Genuinely deployed on Notion Workers.** Worker `flowsync-agent-tools` (`019e373b-265f-7394-837f-f458f6f3fa2c`), 4 agent tools, **remote `ntn workers exec` verified** (not `--local`) — runs in Notion's cloud sandbox.
- **Bidirectional, proven on real data.** An agent tool reads Google's Angular releases from GitHub and writes structured changelogs into Notion; a Notion **Status flip publishes a real GitHub release** (v0.1.0 via webhook, v0.2.0 via the agent's `publish_release`).
- **We didn't just use the platform — we hardened it.** We found, root-caused, and filed **four real issues** in the day-one CLI/platform while building this. See [Platform feedback](#platform-feedback--four-issues-we-found-and-filed).

---

## What it is

Engineering docs rot because humans maintain them by hand, next to code that never stops. FlowSync makes the **code the source of truth** and **Notion a two-way control surface**:

- **Code → Notion** — conventional-commit changelogs, OpenAPI → API Reference DB, Prisma schema → Data Dictionary, package graph → a rendered architecture diagram.
- **Notion → code** — flip a release `Status` and a GitHub release publishes; an agent calls a tool and ships.
- **Any agent** — exposed as a deployed Notion Worker *and* a spec-compliant MCP server, so a Notion Custom Agent, Claude Code, Cursor, or Codex can drive the workspace.

## How it uses the Notion Developer Platform

| Platform capability | How FlowSync uses it | Status |
|---|---|---|
| **Notion Workers** | `packages/ntn-agent-tools` — `@notionhq/workers` SDK, 4 `worker.tool()` capabilities, deployed via `ntn workers deploy`, secrets via `ntn workers env push`. | ✅ Deployed, remote-exec verified |
| **Webhooks** | `packages/webhook-handler` — HMAC-verified handler; a Notion `page.properties_updated` event (Status → "Approved for release") publishes a GitHub release. | ✅ Working (published v0.1.0) |
| **MCP server** | `packages/agent-tools` — spec-compliant JSON-RPC 2.0 (`initialize` / `tools/list` / `tools/call`); same protocol Claude Code / Cursor speak. | ✅ Working |
| **Notion API** | Databases, blocks, **rendered Mermaid diagrams**, page hierarchy for the changelog / API-reference / data-dictionary / hub / architecture surfaces. | ✅ Working |
| **`ntn` CLI** | `login`, `workers new/deploy/env/exec`, `doctor` — the full deploy + remote-exec loop. | ✅ Working (1 Windows bug filed) |

### Live proof

- **Overview (start here):** https://www.notion.so/FlowSync-Project-Overview-363b98e7d08181758251f2a7ba3a71c7
- **Real Angular v21.2.0 changelog** (19 features / 29 fixes, real engineers + PRs): https://www.notion.so/v21-2-0-363b98e7d08181bfa89cd3981f8d72ec
- **Engineering Hub:** https://www.notion.so/Platform-Engineering-Hub-363b98e7d08181f8a305e382748a8e97
- **Rendered architecture diagram:** https://www.notion.so/FlowSync-Architecture-363b98e7d08181159a26c8e44a40fbe7
- **GitHub releases published from Notion:** https://github.com/Kush614/Flowsync/releases (`v0.1.0`, `v0.2.0`)

---

## Platform feedback — four issues we found and filed

Building on the day-one platform surfaced four concrete defects. Each is reported with a root cause and a suggested fix — this is real platform feedback, not bug-hunting for its own sake.

### 1. `ntn workers exec --local` is broken on Windows
`os error 193: %1 is not a valid Win32 application`. The CLI spawns `tsx` by bare name; on Windows the npm shim is `tsx.cmd` (not a PE binary), so `CreateProcess` returns `ERROR_BAD_EXE_FORMAT`.
**Fix:** on Windows, invoke via `cmd.exe /C`, resolve the `.cmd` shim, or run tsx's JS entry with `node`. **Impact:** blocks the entire documented local dev/test loop on Windows. Cloud deploy + remote exec are unaffected.

### 2. `ntn login` 403 is opaque under workspace governance
`403 Forbidden — "Personal access token capabilities exceed what workspace governance allows."` A governance policy silently blocks the Workers token. The error gives no hint which setting or how to resolve it.
**Fix:** surface the specific governance policy and the admin action needed; document that Workers require token capabilities a governed workspace may restrict.

### 3. `NOTION_` is a reserved env-var prefix — discovered only by failure
`ntn workers env push` → `400 InvalidSecretError: Environment variable name must not start with "NOTION_"`. Cost a full deploy cycle. (`NOTION_API_TOKEN` is the one allowed exception.)
**Fix:** document the reserved prefix in the `workers env` help/output and validate names client-side before the round trip.

### 4. Injected `context.notion` doesn't match the documented client
The scaffold docs state `context.notion` is a `@notionhq/client` instance, but in a deployed tool it lacks `databases.query` (`notion.databases.query is not a function`). The runtime client appears data-source-based.
**Fix / workaround:** align the injected client with the documented SDK shape, or document the data-source API. FlowSync works around it with raw REST + `NOTION_API_TOKEN`.

---

## Repo layout

```
packages/
  core/            @flowsync/core — Notion client, block builders, upserters, arch (mermaid gen/parse)
  github-action/   on v* tag push → upsert a Changelog row
  cli/             notion-sync: push | openapi | migrations | arch | init
  webhook-handler/ Notion webhook → GitHub (release approval, comment forward, edit-back)
  agent-tools/     spec-compliant MCP server (JSON-RPC) — 4 tools
  ntn-agent-tools/ DEPLOYED Notion Worker (@notionhq/workers) — same 4 tools
cli-py/            Python sibling CLI
demo/              offline demo mode (zero-internet) + DEMO.md runbook + snapshots
docs/              ARCHITECTURE / DATABASE-SETUP / COLLAB-FEATURES / CLI-SETUP
```

## Quick start

```bash
npm install && npm run build
cp .env.example .env          # add NOTION_TOKEN + DB IDs
node packages/cli/dist/index.js init --parent <notion-page-id>   # creates the 3 DBs
node packages/cli/dist/index.js push --tag v0.1.0 --dry-run
```

### Deploy the Notion Worker

```bash
cd packages/ntn-agent-tools
ntn login                                  # interactive (workspace governance must allow Worker tokens)
ntn workers deploy --name flowsync-agent-tools
ntn workers env push --yes                 # FLOWSYNC_* + GITHUB_TOKEN + NOTION_API_TOKEN
ntn workers exec query_release -d '{"tag":"v21.2.0"}'                       # remote, runs on Notion's cloud
ntn workers exec generate_changelog -d '{"repo":"angular/angular","tag":"v21.2.13","fromTag":"v21.2.12"}'
```

> Env vars use the `FLOWSYNC_` prefix because `NOTION_` is reserved (see issue #3). Notion calls use raw REST with `NOTION_API_TOKEN` because the injected client lacks `databases.query` (see issue #4).

### Offline demo mode (zero internet)

```bash
node demo/offline-replay.mjs   # → http://localhost:9090
```
Mirrors the full demo arc from real captured responses and answers MCP at `POST /mcp` — the live demo command works offline by swapping the host.

## Architecture

See `docs/ARCHITECTURE.md`. Trigger → parse → diff → upsert, bidirectional. The architecture diagram in Notion is generated from the package graph and renders natively as Mermaid; editing it scaffolds a code skeleton back (`notion-sync arch scaffold`).

---

*FlowSync · Notion Developer Platform Hackathon 2026 · `github.com/Kush614/Flowsync`*

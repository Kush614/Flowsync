# Notion CLI (`ntn`) setup

The Notion CLI binary is **`ntn`** (verified against docs as of May 17, 2026, package version `0.14.0`). FlowSync uses it for two things:

1. **Deploying Workers** — `packages/webhook-handler` and `packages/agent-tools` both deploy via `ntn workers deploy`.
2. **Authentication** — `ntn login` opens a browser, stores credentials in your OS keychain. The CLI then reads them for `ntn api` and `ntn workers` commands.

For everything else (creating databases, upserting pages, etc.), FlowSync's own SDK-based code paths work without `ntn`.

## Install

### macOS / Linux (recommended)
```bash
curl -fsSL https://ntn.dev | bash
```

### npm fallback (macOS / Linux only)
```bash
npm install -g ntn
```
Requires Node.js 22+ and npm 10+.

### Windows
**Not supported as of CLI v0.14.0.** Two workarounds:

- **WSL + Ubuntu** (recommended on Windows):
  ```powershell
  wsl --install Ubuntu
  # reboot, then inside WSL:
  curl -fsSL https://ntn.dev | bash
  ```
  Mount the project: `cd /mnt/e/notion` from inside WSL.

- **Cloudflare Worker fallback** for the webhook-handler only:
  ```powershell
  cd packages\webhook-handler
  npm run deploy:cf
  ```
  This deploys to Cloudflare Workers instead of Notion Workers — different URL, slightly different deploy story, but the handler logic is identical. Doesn't help with `agent-tools` since those need to be registered as Custom Agent tools inside Notion.

## Verify

```bash
ntn --version
ntn login
ntn api v1/users/me
```

The last command should return your bot user, confirming auth works.

## Token environment variables

There are two env vars in play. Don't confuse them:

| Var | Used by | What it is |
|---|---|---|
| `NOTION_TOKEN` | FlowSync's own code (CLI, agent-tools, webhook-handler) | The integration secret. Reused as the Notion SDK auth. |
| `NOTION_API_TOKEN` | `ntn api` only | Overrides `ntn login` for headless/CI usage. Same shape as `NOTION_TOKEN`. |

If you want a single source of truth, point both at the same secret:
```bash
export NOTION_API_TOKEN="$NOTION_TOKEN"
```

## What `ntn` replaces in FlowSync

| FlowSync command | What `ntn` could do instead |
|---|---|
| `notion-sync init --parent <id>` (creates 3 DBs via SDK) | Three `ntn api v1/databases parent[page_id]=... properties[...]=...` calls. SDK-based init is simpler for the three-DB case. |
| `notion-sync push --tag v1.4.0` (uses git + SDK) | Can't replace — `ntn` doesn't know about git or conventional commits. |
| `notion-sync openapi --spec ...` | Can't replace — `ntn` doesn't parse OpenAPI. |

The point: `ntn` is a thin, generic API client + Worker deployer. FlowSync adds the engineering-specific intelligence on top.

## Useful `ntn` commands during the hackathon

```bash
ntn api v1/users/me                              # verify auth
ntn api v1/search query=Changelog                # find your DBs by title
ntn api v1/databases/$DB_ID                      # inspect a DB schema
ntn workers list                                 # see deployed Workers
ntn workers logs <worker-name>                   # tail Worker logs
ntn workers deploy                               # redeploy current dir
ntn --verbose api v1/pages/$PAGE_ID              # debug failing requests
```

# @flowsync/webhook-handler

A serverless handler that receives Notion webhook events and dispatches three bidirectional flows:

| Event | Trigger | Action |
|---|---|---|
| `page.properties_updated` with `Status` flip → "Approved for release" | PM marks a changelog row approved | Publishes a GitHub release with the page's release notes |
| `page.properties_updated` on `Description` / `Summary` / `Notes` | Anyone edits a synced doc field | Opens a GitHub issue labeled `flowsync:edit-back` so an engineer can update source |
| `comment.created` on a watched page | Anyone comments on a changelog row | Forwards the comment to the referenced PR as a PR comment, with backlink |

The handler is a standard Web Fetch handler (`{ async fetch(request, env) { ... } }`), so it runs on **Notion Workers** (primary target) and **Cloudflare Workers** (fallback) without code changes.

## Deploy to Notion Workers (primary)

> Notion's CLI is `ntn`. Install with `curl -fsSL https://ntn.dev | bash` (macOS/Linux) or `npm install -g ntn`. Windows is not supported yet — use WSL+Ubuntu or a Mac.

```bash
cd packages/webhook-handler
npm install
ntn login
ntn workers deploy
# Set secrets after first deploy (exact secret subcommand may differ —
# check `ntn workers --help` if these names changed since v0.14.0):
#   ntn workers secrets set NOTION_WEBHOOK_VERIFICATION_TOKEN
#   ntn workers secrets set NOTION_TOKEN
#   ntn workers secrets set GITHUB_TOKEN
```

Notion will register the worker against the events listed in `notion.toml` and assign it a URL. The verification handshake (challenge/response) is handled automatically by the `index.ts` entry.

## Deploy to Cloudflare Workers (fallback)

```powershell
cd packages/webhook-handler
npm install
npx wrangler login
npx wrangler secret put NOTION_WEBHOOK_VERIFICATION_TOKEN
npx wrangler secret put NOTION_TOKEN
npx wrangler secret put GITHUB_TOKEN
npx wrangler deploy
```

Then take the worker URL and register it manually in your Notion integration's Webhook settings.

## Configure

Edit `notion.toml` (or `wrangler.toml` if using Cloudflare):

- `NOTION_TO_GITHUB_REPO` — `owner/repo` to dispatch GitHub actions against.
- `NOTION_RELEASE_STATUS_PROPERTY` — name of the Status property on the Changelog DB. Default `Status`.
- `NOTION_RELEASE_APPROVED_VALUE` — the value that triggers a release. Default `Approved for release`.
- `NOTION_WATCHED_DATABASE_IDS` — comma-separated DB IDs (without dashes). Empty = all DBs.

## Notion DB requirements

For release-approval:
- `Status` (Status property)
- `Release Notes` (Text — optional; falls back to a link if empty)
- `Name` (Title — must be the git tag, e.g., `v1.4.0`)

For comment-forwarder:
- Either the comment text or the page URL must contain a PR reference (`#123` or `github.com/.../pull/123`), OR
- A `PR Number` (Number) property on the page

For edit-back:
- One or more of `Description`, `Summary`, `Notes` (Text properties)

## Local dev

```bash
npm run dev:notion    # Notion Workers (preferred — requires ntn, macOS/Linux)
npm run dev:cf        # Cloudflare Workers fallback (works on Windows)
```

For Cloudflare, expose the local server with a tunnel (e.g., `cloudflared tunnel`) and point Notion at the public URL.

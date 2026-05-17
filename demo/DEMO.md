# FlowSync — demo runbook & fallback ladder

The demo has **3 tiers**. Tier 1 needs nothing but a browser. Tier 3 needs
nothing at all (no internet). Always have Tier 2 + 3 ready before you present.

---

## Permanent URLs (these live on Notion/GitHub servers — they do NOT depend on your laptop)

| What | URL |
|---|---|
| Notion workspace page | https://www.notion.so/Flowsync-363b98e7d08180ffa42ff53fe0a09ee7 |
| Changelog row v0.2.0 (rich: 2 feat / 2 fix) | https://www.notion.so/v0-2-0-363b98e7d0818193913eedb3ce4885a9 |
| Changelog row v0.1.0 | https://www.notion.so/v0-1-0-363b98e7d08181a29edcceca5dc23b37 |
| **Architecture diagram (rendered Mermaid)** | https://www.notion.so/FlowSync-Architecture-363b98e7d08181159a26c8e44a40fbe7 |
| GitHub repo | https://github.com/Kush614/Flowsync |
| GitHub Actions history (green runs) | https://github.com/Kush614/Flowsync/actions |
| **Published release (from a Notion Status flip)** | https://github.com/Kush614/Flowsync/releases/tag/v0.1.0 |

Bookmark all of these. They are the demo's payoff and they persist forever.

---

## TIER 1 — Browser only (no local servers, no tunnels)

Use this if the venue wifi works but tunnels/wrangler are flaky. This is the
**recommended default** — lowest risk, still fully live-looking.

Story (3 min):

1. "Notion's new platform syncs data *into* Notion. We made it bidirectional."
2. Open the **v0.2.0 Changelog row**. Walk the toggles: Features (2), Fixes (2),
   the commit-range callout. "No human wrote this. The git tag wrote it,
   through the GitHub Action." Show the **Actions tab** — green runs.
3. The turn: "Now I'm a PM. No repo access. I just approve the release."
   Open the row, change **Status → Approved for release**.
4. Open **github.com/Kush614/Flowsync/releases** — the v0.1.0 release is
   already there as proof the loop fires. (If you flipped a fresh one and the
   webhook tunnel is up, a new release appears live — bonus. If not, the
   existing release *is* the proof; speak to it in past tense.)
5. Close: "Code writes the docs. The docs ship the code. Every piece runs on
   the Notion Developer Platform."

**Architecture-diagram beat (strong visual):** open the Architecture page —
the Mermaid block renders as a styled, color-coded system diagram. "FlowSync
drew this from the real package graph." Then: `notion-sync arch scaffold
--page <id> --out ./prototype` → "and it reads a diagram back into a code
skeleton." Design ⇄ code, both ways.

To generate a *fresh* live changelog row on stage (optional flex):
```
cd E:\notion
git tag v0.3.0 ; git push origin v0.3.0
# watch github.com/Kush614/Flowsync/actions → new Notion row in ~30s
```
(Push uses the classic PAT; if prompted, the helper is in
`.tools` history. The Action itself has its own secrets.)

---

## TIER 2 — Live bidirectional (tunnels up)

Only if you want the webhook reveal live. Fragile (free tunnels drop ~30 min).

```
powershell -ExecutionPolicy Bypass -File E:\notion\.tools\start-local.ps1
```
Starts both Wranglers + both localtunnels. Then:
```
curl https://tasty-cats-stay.loca.lt/healthz      # {"ok":true,...}
```
If the subdomain was taken, read the localtunnel window for the assigned URL
and update the Notion integration's webhook subscription endpoint to match.

Then in Notion flip a Changelog row's Status to **Approved for release** and
watch `github.com/Kush614/Flowsync/releases` — new release in ~10s.

Recovery if a tunnel dies mid-demo: just rerun
```
npx localtunnel --port 8787 --subdomain tasty-cats-stay
```
Same URL → Notion subscription stays valid. Don't re-register.

**If localtunnel keeps failing:** fall back to Tier 1. Do not debug on stage.

---

## TIER 3 — Fully offline (NO internet at all)

The nuclear fallback. Wifi dead, venue network blocking everything. Runs
entirely from captured **real** API responses.

```
node E:\notion\demo\offline-replay.mjs
```
Open **http://localhost:9090**. One page tells the whole story with real
captured data:
- Changelog DB rows (v0.2.0 rich, v0.1.0)
- The published GitHub release + the webhook log proving the bidirectional flow
- 19+ API Reference endpoints (from the OpenAPI sync)
- Data Dictionary tables with FK detection
- A live agent-tool surface — the replay server answers the agent protocol:
  ```
  curl -s localhost:9090/tools
  curl -s -X POST localhost:9090/ -d '{"name":"query_release","arguments":{"tag":"v0.1.0"}}'
  ```

Everything in `demo/snapshots/` is a genuine recorded response, not mocked.
Refresh them anytime there's connectivity:
see the snapshot commands in this file's git history / the chat transcript.

---

## Pre-flight checklist (run the night before AND morning of)

- [ ] `cd E:\notion && npm run build` → clean
- [ ] `node demo/offline-replay.mjs` → http://localhost:9090 renders
- [ ] All 6 permanent URLs open in a browser
- [ ] `start-local.ps1` brings both Workers up; `/healthz` returns ok
- [ ] Rotate the GitHub PAT + Notion token AFTER the hackathon (they were
      pasted in chat). Update `.env` and both `.dev.vars` if you rotate early.

## One-line panic recovery

Tunnels/servers dead, presenting in 60s → **Tier 1**: open the 6 URLs.
No internet → **Tier 3**: `node demo/offline-replay.mjs`.

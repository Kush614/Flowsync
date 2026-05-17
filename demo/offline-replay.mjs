// FlowSync offline demo replay — ZERO internet, ZERO external deps.
//   node demo/offline-replay.mjs
// Then open http://localhost:9090
//
// Serves the real captured API responses so the entire FlowSync story can
// be demoed with no wifi, no tunnels, no Notion/GitHub reachability.

import { createServer } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const SNAP = join(HERE, "snapshots");
const PORT = 9090;

const read = (f) => (existsSync(join(SNAP, f)) ? readFileSync(join(SNAP, f), "utf8") : "{}");
const json = (f) => JSON.parse(read(f));

function titleOf(r) {
  return r.properties?.Name?.title?.[0]?.plain_text ?? "(untitled)";
}
function numOf(r, k) {
  return r.properties?.[k]?.number ?? 0;
}

function changelogRows() {
  const j = json("notion-changelog.json");
  return (j.results ?? [])
    .map((r) => ({
      name: titleOf(r),
      features: numOf(r, "Features"),
      fixes: numOf(r, "Fixes"),
      breaking: numOf(r, "Breaking"),
      status:
        r.properties?.Status?.select?.name ??
        r.properties?.Status?.status?.name ??
        "—",
      url: r.url
    }))
    .filter((r) => r.name !== "(untitled)");
}

function apiRows() {
  const j = json("notion-api-reference.json");
  return (j.results ?? []).map((r) => titleOf(r)).filter(Boolean);
}

function dictRows() {
  const j = json("notion-data-dictionary.json");
  return (j.results ?? []).map((r) => ({
    name: titleOf(r),
    cols: numOf(r, "Columns"),
    fk: r.properties?.["Has FK"]?.checkbox ?? false
  }));
}

function releases() {
  const j = json("github-releases.json");
  const arr = Array.isArray(j) ? j : [];
  return arr.map((r) => ({ tag: r.tag_name, name: r.name, url: r.html_url }));
}

function page(html) {
  return `<!doctype html><html><head><meta charset="utf-8">
<title>FlowSync — offline demo replay</title>
<style>
 body{font:15px/1.6 -apple-system,Segoe UI,Roboto,sans-serif;background:#0d0d10;color:#e8e8ea;margin:0;padding:40px;max-width:1000px;margin:0 auto}
 h1{font-size:28px;margin:0 0 4px} .sub{color:#8a8a92;margin-bottom:32px}
 .card{background:#16161a;border:1px solid #26262c;border-radius:12px;padding:20px 24px;margin:16px 0}
 .card h2{font-size:16px;margin:0 0 14px;color:#9ad}
 table{width:100%;border-collapse:collapse} td,th{text-align:left;padding:7px 10px;border-bottom:1px solid #222}
 th{color:#8a8a92;font-weight:600;font-size:13px} .pill{display:inline-block;background:#1f3a2a;color:#7ee0a2;border-radius:99px;padding:2px 10px;font-size:12px}
 .pill.draft{background:#3a2f1f;color:#e0c47e} a{color:#7ab8ff;text-decoration:none} a:hover{text-decoration:underline}
 code,pre{font-family:ui-monospace,Menlo,Consolas,monospace} pre{background:#0a0a0c;border:1px solid #222;border-radius:8px;padding:14px;overflow:auto;font-size:13px;color:#9fd}
 .ok{color:#7ee0a2;font-weight:600} .flow{font-size:13px;color:#aaa;line-height:2}
 .badge{background:#26262c;border-radius:6px;padding:2px 8px;font-size:12px;color:#9ad;margin-right:6px}
</style></head><body>${html}</body></html>`;
}

const server = createServer((req, res) => {
  const u = new URL(req.url, `http://localhost:${PORT}`);

  if (u.pathname === "/tools") {
    res.setHeader("content-type", "application/json");
    return res.end(read("agent-tools-manifest.json"));
  }

  if (req.method === "POST" && u.pathname === "/") {
    let b = "";
    req.on("data", (c) => (b += c));
    req.on("end", () => {
      let name = "";
      try {
        name = JSON.parse(b).name;
      } catch {}
      res.setHeader("content-type", "application/json");
      if (name === "query_release") return res.end(read("agent-call-query_release.json"));
      return res.end(
        JSON.stringify({
          content: [
            {
              type: "text",
              text: `[offline replay] tool "${name}" — live network disabled. Captured responses available for: query_release.`
            }
          ]
        })
      );
    });
    return;
  }

  const cl = changelogRows();
  const rel = releases();
  const api = apiRows();
  const dict = dictRows();
  const proof = read("webhook-bidirectional-proof.log");

  const html = `
  <h1>FlowSync — offline demo replay</h1>
  <div class="sub">Every panel below is a <b>real captured API response</b>. No network required.</div>

  <div class="card">
    <h2>1 · Code → Notion · Changelog database</h2>
    <table><tr><th>Release</th><th>Features</th><th>Fixes</th><th>Breaking</th><th>Status</th><th></th></tr>
    ${cl
      .map(
        (r) =>
          `<tr><td><b>${r.name}</b></td><td>${r.features}</td><td>${r.fixes}</td><td>${r.breaking}</td>
       <td><span class="pill ${r.status === "Draft" ? "draft" : ""}">${r.status}</span></td>
       <td><a href="${r.url}" target="_blank">open ↗</a></td></tr>`
      )
      .join("")}
    </table>
    <p class="sub" style="margin:12px 0 0">Generated by the GitHub Action parsing conventional commits — no human wrote these rows.</p>
  </div>

  <div class="card">
    <h2>2 · Notion → Code · GitHub releases published from a Notion Status flip</h2>
    ${rel
      .map((r) => `<div><span class="badge">${r.tag}</span><a href="${r.url}" target="_blank">${r.url}</a></div>`)
      .join("") || "<div class='sub'>(snapshot empty)</div>"}
    <p class="sub" style="margin:12px 0 0">Webhook-handler log proving the bidirectional loop:</p>
    <pre>${proof.replace(/</g, "&lt;")}</pre>
  </div>

  <div class="card">
    <h2>3 · OpenAPI → Notion · API Reference (${api.length} endpoints)</h2>
    <div class="flow">${api.slice(0, 24).map((a) => `<span class="badge">${a}</span>`).join(" ")}</div>
  </div>

  <div class="card">
    <h2>4 · Prisma schema → Notion · Data Dictionary</h2>
    <table><tr><th>Table</th><th>Columns</th><th>Has FK</th></tr>
    ${dict
      .map((d) => `<tr><td><b>${d.name}</b></td><td>${d.cols}</td><td>${d.fk ? "✅" : "—"}</td></tr>`)
      .join("")}
    </table>
  </div>

  <div class="card">
    <h2>5 · Custom Agent tool surface (served live, offline)</h2>
    <p class="flow">This replay server itself answers the agent protocol:</p>
    <pre>GET  http://localhost:${PORT}/tools          → manifest (${(JSON.parse(read("agent-tools-manifest.json")).tools || []).length} tools)
POST http://localhost:${PORT}/  {"name":"query_release","arguments":{"tag":"v0.1.0"}}</pre>
    <p class="ok">Try it: curl -s localhost:${PORT}/tools | jq .</p>
  </div>

  <div class="sub" style="margin-top:32px">FlowSync · Notion Developer Platform Hackathon · offline fallback bundle</div>`;

  res.setHeader("content-type", "text/html; charset=utf-8");
  res.end(page(html));
});

server.listen(PORT, () => {
  console.log(`\n  FlowSync offline replay → http://localhost:${PORT}`);
  console.log(`  Snapshots: ${SNAP}`);
  console.log(`  No internet required. Ctrl+C to stop.\n`);
});

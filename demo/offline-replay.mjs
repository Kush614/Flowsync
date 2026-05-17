// FlowSync DEMO MODE — ZERO internet, ZERO external deps, ZERO live servers.
//   node demo/offline-replay.mjs   →   http://localhost:9090
//
// Mirrors the full demo arc from REAL captured responses. Also answers the
// MCP protocol at POST /mcp, so the demo curl works offline by changing
// only the host:  flowsync-agent-tools.loca.lt  →  localhost:9090

import { createServer } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const SNAP = join(HERE, "snapshots");
const PORT = 9090;

const read = (f) => (existsSync(join(SNAP, f)) ? readFileSync(join(SNAP, f), "utf8") : "");
const json = (f) => {
  try {
    return JSON.parse(read(f) || "{}");
  } catch {
    return {};
  }
};
const esc = (s) => String(s).replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]));

const titleOf = (r) => r.properties?.Name?.title?.[0]?.plain_text ?? "";
const numOf = (r, k) => r.properties?.[k]?.number ?? 0;

function changelogRows() {
  return (json("notion-changelog.json").results ?? [])
    .map((r) => ({
      name: titleOf(r),
      f: numOf(r, "Features"),
      fix: numOf(r, "Fixes"),
      br: numOf(r, "Breaking"),
      url: r.url
    }))
    .filter((r) => r.name);
}
function releases() {
  const j = json("github-releases.json");
  return (Array.isArray(j) ? j : []).map((r) => ({ tag: r.tag_name, url: r.html_url }));
}
function apiCount() {
  return (json("notion-api-reference.json").results ?? []).length;
}
function dictRows() {
  return (json("notion-data-dictionary.json").results ?? []).map((r) => ({
    name: titleOf(r),
    cols: numOf(r, "Columns"),
    fk: r.properties?.["Has FK"]?.checkbox ?? false
  }));
}
function mcpText(file) {
  const r = json(file).result;
  return r?.content?.[0]?.text ?? "(no captured response)";
}

// ---- MCP replay: return the captured JSON-RPC response, echo request id ----
function mcpReply(body) {
  const id = body?.id ?? null;
  const method = body?.method;
  const wrap = (result) => JSON.stringify({ jsonrpc: "2.0", id, result });
  if (method === "initialize") return wrap(json("mcp-initialize.json").result ?? {});
  if (method === "tools/list") return wrap(json("mcp-tools-list.json").result ?? { tools: [] });
  if (method === "ping") return wrap({});
  if (method === "tools/call") {
    const name = body?.params?.name;
    if (name === "generate_changelog") return wrap(json("mcp-generate_changelog.json").result);
    if (name === "query_release") return wrap(json("mcp-query_release.json").result);
    return wrap({
      content: [{ type: "text", text: `[demo mode] captured replay available for generate_changelog and query_release. Tool "${name}" acknowledged.` }],
      isError: false
    });
  }
  if (id === undefined || id === null) return null; // notification
  return JSON.stringify({ jsonrpc: "2.0", id, error: { code: -32601, message: `Method not found: ${method}` } });
}

function pageHtml() {
  const cl = changelogRows();
  const rel = releases();
  const dict = dictRows();
  const arch = read("architecture.mmd");
  const liveCall = mcpText("mcp-generate_changelog.json");
  const queryCall = mcpText("mcp-query_release.json");
  const tools = (json("mcp-tools-list.json").result?.tools ?? []).map((t) => t.name);
  const proof = read("webhook-bidirectional-proof.log");

  const row = (r) =>
    `<tr><td><b>${esc(r.name)}</b></td><td>${r.f}</td><td>${r.fix}</td><td>${r.br}</td><td><a target=_blank href="${r.url}">open ↗</a></td></tr>`;

  return `<!doctype html><html><head><meta charset="utf-8"><title>FlowSync — DEMO MODE</title><style>
 body{font:15px/1.65 -apple-system,Segoe UI,Roboto,sans-serif;background:#0c0c0f;color:#e9e9ec;margin:0;padding:40px;max-width:1040px;margin:0 auto}
 h1{font-size:30px;margin:0} .tag{color:#7ee0a2;font-weight:600;letter-spacing:.04em;font-size:13px}
 .sub{color:#8a8a92;margin:6px 0 28px}
 .beat{background:#15151a;border:1px solid #26262c;border-radius:14px;padding:22px 26px;margin:18px 0}
 .beat h2{font-size:17px;margin:0 0 4px;color:#9cd}
 .beat .k{color:#6f6f78;font-size:12px;text-transform:uppercase;letter-spacing:.08em;margin-bottom:14px}
 table{width:100%;border-collapse:collapse;margin:6px 0} td,th{text-align:left;padding:7px 10px;border-bottom:1px solid #232329}
 th{color:#8a8a92;font-size:12px;font-weight:600}
 a{color:#7ab8ff;text-decoration:none} a:hover{text-decoration:underline}
 pre{background:#08080a;border:1px solid #232329;border-radius:8px;padding:14px;overflow:auto;font-size:12.5px;color:#9fe;font-family:ui-monospace,Consolas,monospace}
 .ok{color:#7ee0a2;font-weight:600} .badge{background:#26262c;border-radius:6px;padding:2px 8px;font-size:12px;color:#9cd;margin:2px 6px 2px 0;display:inline-block}
 .res{background:#10231a;border:1px solid #1f5f3a;border-radius:8px;padding:12px 14px;color:#9ff0c0;font-family:ui-monospace,Consolas,monospace;font-size:13px}
</style></head><body>
 <div class="tag">DEMO MODE · NO INTERNET · REAL CAPTURED RESULTS</div>
 <h1>🔁 FlowSync</h1>
 <div class="sub">Every panel is a real recorded response. The MCP endpoint below is live offline — point the demo curl at <code>localhost:${PORT}/mcp</code>.</div>

 <div class="beat"><div class="k">Beat 1 · Hook</div><h2>One project, fully logged</h2>
 <p>Code is the source of truth; Notion is the two-way control surface. 14 capabilities, 13 working end-to-end, on real data. Full page: <a target=_blank href="https://www.notion.so/FlowSync-Project-Overview-363b98e7d08181758251f2a7ba3a71c7">FlowSync — Project Overview ↗</a></p></div>

 <div class="beat"><div class="k">Beat 2 · Real data</div><h2>Google / Angular releases, generated into Notion</h2>
 <table><tr><th>Release</th><th>Feat</th><th>Fix</th><th>Break</th><th></th></tr>${cl.map(row).join("")}</table>
 <p class="sub">v21.2.0 = 19 features / 29 fixes — real Angular engineers, real PR links.</p></div>

 <div class="beat"><div class="k">Beat 3 · Live proof (replayed)</div><h2>Agent calls FlowSync over MCP</h2>
 <p>The exact demo command, captured from the real endpoint:</p>
 <pre>curl -X POST localhost:${PORT}/mcp -d '{"method":"tools/call",
   "params":{"name":"generate_changelog",
   "arguments":{"repo":"angular/angular","tag":"v21.2.13","fromTag":"v21.2.12"}}}'</pre>
 <div class="res">${esc(liveCall)}</div>
 <p class="sub" style="margin-top:10px">Read-back: <span class="ok">${esc(queryCall)}</span></p></div>

 <div class="beat"><div class="k">Beat 4 · Bidirectional</div><h2>Notion → real GitHub releases</h2>
 ${rel.map((r) => `<div><span class="badge">${esc(r.tag)}</span><a target=_blank href="${r.url}">${esc(r.url)}</a></div>`).join("")}
 <p class="sub" style="margin:10px 0 6px">v0.1.0 published by a Notion Status flip; v0.2.0 by the agent's publish_release. Proof log:</p>
 <pre>${esc(proof)}</pre></div>

 <div class="beat"><div class="k">Beat 5 · The system</div><h2>Architecture, generated from code, rendered in Notion</h2>
 <pre>${esc(arch)}</pre>
 <div><a target=_blank href="https://www.notion.so/Platform-Engineering-Hub-363b98e7d08181f8a305e382748a8e97">Engineering Hub ↗</a> &nbsp;·&nbsp; <a target=_blank href="https://www.notion.so/FlowSync-Architecture-363b98e7d08181159a26c8e44a40fbe7">Architecture page ↗</a></div>
 <p class="sub" style="margin-top:10px">Prisma → Data Dictionary: ${dict.map((d) => `<span class="badge">${esc(d.name)}${d.fk ? " 🔑" : ""}</span>`).join("")} · OpenAPI → ${apiCount()} endpoints synced.</p></div>

 <div class="beat"><div class="k">Beat 6 · Close</div><h2>Code writes the docs. The docs ship the code.</h2>
 <p>MCP server live offline at <code>localhost:${PORT}/mcp</code> — tools: ${tools.map((t) => `<span class="badge">${esc(t)}</span>`).join("")}</p>
 <p class="ok">curl -s -X POST localhost:${PORT}/mcp -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'</p></div>

 <div class="sub" style="margin-top:30px">FlowSync · Notion Developer Platform Hackathon · demo-mode bundle (zero dependency)</div>
</body></html>`;
}

const server = createServer((req, res) => {
  const u = new URL(req.url, `http://localhost:${PORT}`);

  if (u.pathname === "/healthz") {
    res.setHeader("content-type", "application/json");
    return res.end(JSON.stringify({ ok: true, service: "flowsync-demo-mode", mode: "offline" }));
  }
  if (req.method === "GET" && u.pathname === "/tools") {
    res.setHeader("content-type", "application/json");
    return res.end(JSON.stringify(json("mcp-tools-list.json").result ?? { tools: [] }));
  }
  if (req.method === "POST" && (u.pathname === "/mcp" || u.pathname === "/")) {
    let b = "";
    req.on("data", (c) => (b += c));
    req.on("end", () => {
      let body = {};
      try {
        body = JSON.parse(b || "{}");
      } catch {}
      res.setHeader("content-type", "application/json");
      // MCP JSON-RPC shape
      if (body.jsonrpc || body.method) {
        const out = mcpReply(body);
        return res.end(out ?? "");
      }
      // legacy {name,arguments}
      const name = body.name;
      if (name === "generate_changelog") return res.end(JSON.stringify(json("mcp-generate_changelog.json").result));
      if (name === "query_release") return res.end(JSON.stringify(json("mcp-query_release.json").result));
      return res.end(JSON.stringify({ content: [{ type: "text", text: `[demo mode] captured: generate_changelog, query_release` }] }));
    });
    return;
  }

  res.setHeader("content-type", "text/html; charset=utf-8");
  res.end(pageHtml());
});

server.listen(PORT, () => {
  console.log(`\n  FlowSync DEMO MODE → http://localhost:${PORT}`);
  console.log(`  MCP replay        → POST http://localhost:${PORT}/mcp`);
  console.log(`  Zero internet. Ctrl+C to stop.\n`);
});

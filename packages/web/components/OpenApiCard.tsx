"use client";

import { useState, useTransition } from "react";
import { syncOpenApi, type ActionResult } from "@/app/actions";
import { ResultPanel } from "./ResultPanel";

export function OpenApiCard({ hasDb }: { hasDb: boolean }) {
  const [spec, setSpec] = useState("");
  const [db, setDb] = useState("");
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, start] = useTransition();

  async function loadSample() {
    const res = await fetch("/api/sample/openapi");
    setSpec(await res.text());
  }

  return (
    <div className="card">
      <h2>🌐 Sync OpenAPI spec</h2>
      <p className="desc">Parses an OpenAPI JSON doc and upserts one row per endpoint.</p>
      <div className="field">
        <label>OpenAPI JSON</label>
        <textarea
          value={spec}
          onChange={(e) => setSpec(e.target.value)}
          rows={6}
          placeholder='{"openapi":"3.0.0","paths":{...}}'
        />
      </div>
      <div className="field">
        <label>Database ID (override)</label>
        <input
          value={db}
          onChange={(e) => setDb(e.target.value)}
          placeholder={hasDb ? "from NOTION_API_REFERENCE_DB_ID" : "required: paste DB ID"}
        />
      </div>
      <div className="row">
        <button
          disabled={pending}
          onClick={() =>
            start(async () => setResult(await syncOpenApi({ specText: spec, database: db })))
          }
        >
          {pending ? "Syncing…" : "Sync to Notion"}
        </button>
        <button className="secondary" disabled={pending} onClick={loadSample}>
          Load sample
        </button>
      </div>
      <ResultPanel result={result} />
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { testConnection, type ActionResult } from "@/app/actions";
import type { EnvStatus } from "@/lib/env";
import { ResultPanel } from "./ResultPanel";

export function ConfigCard({ env }: { env: EnvStatus }) {
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="card" style={{ gridColumn: "1 / -1" }}>
      <h2>
        Configuration
        <span className="tag">.env → E:\notion\.env</span>
      </h2>
      <p className="desc">Env vars are loaded from the repo-root <code>.env</code> at server start.</p>
      <div className="kv">
        <span className="k">NOTION_TOKEN</span>
        <span className={`v ${env.notionToken.set ? "ok" : "miss"}`}>
          {env.notionToken.set ? env.notionToken.preview : "missing"}
        </span>
        <span className="k">NOTION_CHANGELOG_DB_ID</span>
        <span className={`v ${env.changelogDb.set ? "ok" : "miss"}`}>
          {env.changelogDb.value || "missing"}
        </span>
        <span className="k">NOTION_API_REFERENCE_DB_ID</span>
        <span className={`v ${env.apiRefDb.set ? "ok" : "miss"}`}>
          {env.apiRefDb.value || "missing"}
        </span>
        <span className="k">NOTION_DATA_DICTIONARY_DB_ID</span>
        <span className={`v ${env.dataDictDb.set ? "ok" : "miss"}`}>
          {env.dataDictDb.value || "missing"}
        </span>
      </div>
      <div className="row">
        <button
          disabled={!env.notionToken.set || pending}
          onClick={() => start(async () => setResult(await testConnection()))}
        >
          {pending ? "Testing…" : "Test Notion connection"}
        </button>
        {!env.notionToken.set ? (
          <span className="badge warn"><span className="dot" />Set NOTION_TOKEN to enable</span>
        ) : null}
      </div>
      <ResultPanel result={result} />
    </div>
  );
}

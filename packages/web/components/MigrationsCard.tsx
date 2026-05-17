"use client";

import { useState, useTransition } from "react";
import { syncMigrations, type ActionResult } from "@/app/actions";
import { ResultPanel } from "./ResultPanel";

export function MigrationsCard({ hasDb }: { hasDb: boolean }) {
  const [schema, setSchema] = useState("");
  const [db, setDb] = useState("");
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, start] = useTransition();

  async function loadSample() {
    const res = await fetch("/api/sample/prisma");
    setSchema(await res.text());
  }

  return (
    <div className="card">
      <h2>🗃️ Sync data dictionary</h2>
      <p className="desc">Parses a Prisma schema and upserts one row per model.</p>
      <div className="field">
        <label>schema.prisma</label>
        <textarea
          value={schema}
          onChange={(e) => setSchema(e.target.value)}
          rows={6}
          placeholder='model User { id String @id ... }'
        />
      </div>
      <div className="field">
        <label>Database ID (override)</label>
        <input
          value={db}
          onChange={(e) => setDb(e.target.value)}
          placeholder={hasDb ? "from NOTION_DATA_DICTIONARY_DB_ID" : "required: paste DB ID"}
        />
      </div>
      <div className="row">
        <button
          disabled={pending}
          onClick={() =>
            start(async () => setResult(await syncMigrations({ schemaText: schema, database: db })))
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

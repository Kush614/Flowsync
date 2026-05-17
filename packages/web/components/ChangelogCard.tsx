"use client";

import { useState, useTransition } from "react";
import { pushChangelog, type ActionResult } from "@/app/actions";
import { ResultPanel } from "./ResultPanel";

const SAMPLE = `abc1234\tjdoe\tfeat: add multi-tenant workspaces (closes ENG-1234)
def5678\trsmith\tfix: race in webhook signature verifier
ghi9012\tjdoe\tfeat!: drop legacy /v1 endpoints
jkl3456\tkwong\tchore: bump dependencies`;

export function ChangelogCard({ hasDb }: { hasDb: boolean }) {
  const [tag, setTag] = useState("v0.1.0");
  const [commits, setCommits] = useState(SAMPLE);
  const [db, setDb] = useState("");
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="card">
      <h2>📝 Push changelog</h2>
      <p className="desc">
        Bucket conventional commits and upsert a row in the Notion Changelog DB.
      </p>
      <div className="field">
        <label>Release tag</label>
        <input value={tag} onChange={(e) => setTag(e.target.value)} placeholder="v1.5.0" />
      </div>
      <div className="field">
        <label>Commits (one per line: <code>sha\tauthor\tsubject</code>)</label>
        <textarea value={commits} onChange={(e) => setCommits(e.target.value)} rows={6} />
      </div>
      <div className="field">
        <label>Database ID (override)</label>
        <input
          value={db}
          onChange={(e) => setDb(e.target.value)}
          placeholder={hasDb ? "from NOTION_CHANGELOG_DB_ID" : "required: paste DB ID"}
        />
      </div>
      <div className="row">
        <button
          disabled={pending}
          onClick={() =>
            start(async () =>
              setResult(await pushChangelog({ tag, commitsText: commits, database: db }))
            )
          }
        >
          {pending ? "Pushing…" : "Push to Notion"}
        </button>
      </div>
      <ResultPanel result={result} />
    </div>
  );
}

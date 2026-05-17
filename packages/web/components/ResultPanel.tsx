"use client";

import type { ActionResult } from "@/app/actions";

export function ResultPanel({ result }: { result: ActionResult | null }) {
  if (!result) return null;
  const cls = result.ok ? "result ok" : "result err";
  const url = (result.details?.url as string | undefined) ?? undefined;

  return (
    <div className={cls}>
      <div style={{ fontWeight: 600, marginBottom: 6 }}>
        {result.ok ? "OK" : "Error"} — {result.message}
      </div>
      {url ? (
        <div style={{ marginBottom: 6 }}>
          <a href={url} target="_blank" rel="noreferrer">{url}</a>
        </div>
      ) : null}
      {result.details ? (
        <pre style={{ margin: 0 }}>{JSON.stringify(result.details, null, 2)}</pre>
      ) : null}
    </div>
  );
}

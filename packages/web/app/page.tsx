import { readEnvStatus } from "@/lib/env";
import { ConfigCard } from "@/components/ConfigCard";
import { ChangelogCard } from "@/components/ChangelogCard";
import { OpenApiCard } from "@/components/OpenApiCard";
import { MigrationsCard } from "@/components/MigrationsCard";

export const dynamic = "force-dynamic";

export default function Page() {
  const env = readEnvStatus();

  return (
    <>
      <header className="app">
        <div>
          <h1>FlowSync Dashboard</h1>
          <div className="sub">Engineering-native Notion sync — built on the Notion Developer Platform</div>
        </div>
        <ConnectionBadge connected={env.notionToken.set} />
      </header>

      <div className="grid">
        <ConfigCard env={env} />
        <ChangelogCard hasDb={env.changelogDb.set} />
        <OpenApiCard hasDb={env.apiRefDb.set} />
        <MigrationsCard hasDb={env.dataDictDb.set} />
      </div>
    </>
  );
}

function ConnectionBadge({ connected }: { connected: boolean }) {
  return (
    <span className={`badge ${connected ? "ok" : "warn"}`}>
      <span className="dot" />
      {connected ? "NOTION_TOKEN loaded" : "NOTION_TOKEN missing"}
    </span>
  );
}

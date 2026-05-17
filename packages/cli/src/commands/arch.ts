import { Command } from "commander";
import { readFileSync, readdirSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import kleur from "kleur";
import {
  ArchUpserter,
  FlowSyncClient,
  fromMermaid,
  planScaffold,
  toMermaid,
  type ArchGraph,
  type ArchNode,
  type ArchEdge,
  type Layer
} from "@flowsync/core";
import { requireEnv } from "../env.js";

const EMOJI: Record<string, string> = {
  core: "📦",
  cli: "🖥️",
  github_action: "⚙️",
  webhook_handler: "🔗",
  agent_tools: "🤖",
  web: "🖼️",
  cli_py: "🐍"
};

function layerOf(name: string): Layer {
  if (name === "@flowsync/core") return "Core";
  if (/webhook|agent-tools/.test(name)) return "Workers";
  return "Clients";
}

function sid(name: string): string {
  return name.replace(/^@[^/]+\//, "").replace(/[^a-zA-Z0-9]/g, "_");
}

function scanMonorepo(root: string, title: string): ArchGraph {
  const pkgDir = join(root, "packages");
  if (!existsSync(pkgDir)) throw new Error(`No packages/ dir under ${root}`);
  const nodes: ArchNode[] = [];
  const edges: ArchEdge[] = [];
  const known = new Set<string>();

  const entries = readdirSync(pkgDir, { withFileTypes: true }).filter((d) => d.isDirectory());
  const manifests: Array<{ name: string; deps: string[] }> = [];
  for (const e of entries) {
    const pj = join(pkgDir, e.name, "package.json");
    if (!existsSync(pj)) continue;
    const json = JSON.parse(readFileSync(pj, "utf8")) as {
      name: string;
      dependencies?: Record<string, string>;
    };
    const deps = Object.keys(json.dependencies ?? {}).filter((d) => d.startsWith("@flowsync/"));
    manifests.push({ name: json.name, deps });
    known.add(json.name);
  }

  for (const m of manifests) {
    const id = sid(m.name);
    nodes.push({ id, label: m.name, layer: layerOf(m.name), emoji: EMOJI[id] ?? "🔹" });
  }
  for (const m of manifests) {
    for (const d of m.deps) {
      if (known.has(d)) edges.push({ from: sid(m.name), to: sid(d), kind: "depends" });
    }
  }

  // Python sibling mirrors the TS CLI (nice real touch).
  if (existsSync(join(root, "cli-py"))) {
    nodes.push({ id: "cli_py", label: "notion-flowsync (py)", layer: "Clients", emoji: "🐍" });
    if (known.has("@flowsync/cli")) edges.push({ from: "cli_py", to: "cli", kind: "mirrors" });
  }

  // External systems FlowSync talks to — makes it read like a company system diagram.
  nodes.push({ id: "GitHub", label: "GitHub", layer: "External", emoji: "🐙" });
  nodes.push({ id: "Notion", label: "Notion API", layer: "External", emoji: "📝" });
  for (const m of manifests) {
    const id = sid(m.name);
    if (/webhook|github-action|cli$/.test(m.name)) edges.push({ from: id, to: "GitHub", kind: "calls" });
    if (id === "core") edges.push({ from: id, to: "Notion", kind: "calls" });
  }

  return { title, nodes, edges };
}

export function registerArch(program: Command): void {
  const arch = program.command("arch").description("Sync architecture diagrams between code and Notion (bidirectional)");

  arch
    .command("push")
    .description("Scan the monorepo package graph and upsert a rendered Mermaid diagram into Notion")
    .option("--parent <pageId>", "Notion parent page ID. Defaults to NOTION_ARCH_PARENT_PAGE_ID env.")
    .option("--root <dir>", "Repo root containing packages/", ".")
    .option("--title <title>", "Architecture page title", "FlowSync Architecture")
    .option("--dry-run", "Print the Mermaid diagram without writing to Notion", false)
    .action(async (opts: { parent?: string; root: string; title: string; dryRun?: boolean }) => {
      const graph = scanMonorepo(resolve(opts.root), opts.title);
      console.log(
        kleur.cyan(`Scanned ${graph.nodes.length} components, ${graph.edges.length} links`)
      );

      if (opts.dryRun) {
        console.log("\n" + toMermaid(graph) + "\n");
        return;
      }

      const token = requireEnv("NOTION_TOKEN");
      const parent = opts.parent ?? requireEnv("NOTION_ARCH_PARENT_PAGE_ID");
      const client = new FlowSyncClient({ token });
      const upserter = new ArchUpserter(client, parent);
      const res = await upserter.upsert(graph);
      console.log(
        kleur.green(`${res.created ? "Created" : "Updated"} `) + kleur.underline(res.url)
      );
      console.log(kleur.dim("Open it in Notion — the Mermaid block renders as a live diagram."));
    });

  arch
    .command("scaffold")
    .description("Read a Mermaid diagram from a Notion page and scaffold a prototype skeleton")
    .requiredOption("--page <pageId>", "Notion page ID that contains a Mermaid code block")
    .option("--out <dir>", "Output directory for the prototype", "./prototype")
    .option("--dry-run", "List files that would be written", false)
    .action(async (opts: { page: string; out: string; dryRun?: boolean }) => {
      const token = requireEnv("NOTION_TOKEN");
      const client = new FlowSyncClient({ token });

      const mermaid = await extractMermaid(client, opts.page);
      if (!mermaid) {
        console.error(kleur.red("No Mermaid code block found on that page."));
        process.exit(1);
      }
      const graph = fromMermaid(mermaid);
      const pageTitle = await fetchPageTitle(client, opts.page);
      if (pageTitle) graph.title = pageTitle;
      console.log(
        kleur.cyan(`Parsed ${graph.nodes.length} nodes, ${graph.edges.length} edges from the diagram`)
      );

      const files = planScaffold(graph);
      if (opts.dryRun) {
        for (const f of files) console.log("  " + f.path);
        return;
      }
      const root = resolve(opts.out);
      for (const f of files) {
        const full = join(root, f.path);
        mkdirSync(dirname(full), { recursive: true });
        writeFileSync(full, f.contents);
      }
      console.log(kleur.green(`Wrote ${files.length} files to ${root}`));
      console.log(kleur.dim("Draw a new diagram in Notion and re-run to regenerate."));
    });
}

async function fetchPageTitle(client: FlowSyncClient, pageId: string): Promise<string | null> {
  try {
    const page = await client.withRetry(() => client.notion.pages.retrieve({ page_id: pageId }));
    const props = (page as { properties?: Record<string, { type?: string; title?: Array<{ plain_text: string }> }> }).properties;
    for (const v of Object.values(props ?? {})) {
      if (v?.type === "title") return (v.title ?? []).map((t) => t.plain_text).join("");
    }
  } catch {
    /* fall through */
  }
  return null;
}

async function extractMermaid(client: FlowSyncClient, pageId: string): Promise<string | null> {
  let cursor: string | undefined;
  do {
    const page = await client.withRetry(() =>
      client.notion.blocks.children.list({ block_id: pageId, page_size: 100, start_cursor: cursor })
    );
    for (const b of page.results as Array<Record<string, unknown>>) {
      const code = b.code as { language?: string; rich_text?: Array<{ plain_text: string }> } | undefined;
      if (b.type === "code" && code?.language === "mermaid") {
        return (code.rich_text ?? []).map((t) => t.plain_text).join("");
      }
    }
    cursor = page.has_more ? page.next_cursor ?? undefined : undefined;
  } while (cursor);
  return null;
}

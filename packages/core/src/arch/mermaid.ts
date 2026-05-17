import {
  type ArchGraph,
  type ArchNode,
  type ArchEdge,
  type Layer,
  LAYER_ORDER,
  LAYER_META,
  safeId
} from "./types.js";

const EDGE_STYLE: Record<NonNullable<ArchEdge["kind"]>, string> = {
  depends: "-->",
  calls: "==>",
  mirrors: "-.->"
};

export function toMermaid(graph: ArchGraph): string {
  const lines: string[] = ["flowchart TD"];

  const byLayer = new Map<Layer, ArchNode[]>();
  for (const n of graph.nodes) {
    if (!byLayer.has(n.layer)) byLayer.set(n.layer, []);
    byLayer.get(n.layer)!.push(n);
  }

  for (const layer of LAYER_ORDER) {
    const nodes = byLayer.get(layer);
    if (!nodes?.length) continue;
    const meta = LAYER_META[layer];
    lines.push(`  subgraph ${layer}["${meta.emoji} ${layer}"]`);
    lines.push("    direction LR");
    for (const n of nodes) {
      lines.push(`    ${n.id}["${n.emoji} ${n.label}"]`);
    }
    lines.push("  end");
  }

  for (const e of graph.edges) {
    const arrow = EDGE_STYLE[e.kind ?? "depends"];
    const label =
      e.kind === "mirrors" ? "|mirrors|" : e.kind === "calls" ? "|calls|" : "";
    lines.push(`  ${e.from} ${arrow}${label ? `${label} ` : " "}${e.to}`);
  }

  const usedLayers = LAYER_ORDER.filter((l) => byLayer.get(l)?.length);
  for (const layer of usedLayers) {
    const m = LAYER_META[layer];
    lines.push(
      `  classDef ${m.classId} fill:${m.fill},stroke:${m.stroke},stroke-width:2px,color:#e8e8ea`
    );
  }
  for (const layer of usedLayers) {
    const m = LAYER_META[layer];
    const ids = (byLayer.get(layer) ?? []).map((n) => n.id).join(",");
    if (ids) lines.push(`  class ${ids} ${m.classId}`);
  }

  return lines.join("\n");
}

const SUBGRAPH_RE = /^\s*subgraph\s+(\w+)\s*\[?"?([^"\]]*)"?\]?/;
const NODE_RE = /^\s*([A-Za-z0-9_]+)\s*\[\s*"([^"]*)"\s*\]\s*$/;
const EDGE_RE =
  /^\s*([A-Za-z0-9_]+)\s*(-->|==>|-\.->|--x|---)\s*(?:\|([^|]*)\|\s*)?([A-Za-z0-9_]+)\s*$/;

export function fromMermaid(src: string): ArchGraph {
  const nodes = new Map<string, ArchNode>();
  const edges: ArchEdge[] = [];
  let currentLayer: Layer = "Core";
  const title = "Imported architecture";

  for (const raw of src.split("\n")) {
    const line = raw.replace(/\r$/, "");
    if (/^\s*flowchart|^\s*graph/.test(line)) continue;
    if (/^\s*end\s*$/.test(line)) {
      currentLayer = "Core";
      continue;
    }
    const sg = SUBGRAPH_RE.exec(line);
    if (sg) {
      const name = (sg[2] || sg[1]).replace(/^[^\w]*\s*/, "").trim();
      if (/client/i.test(name)) currentLayer = "Clients";
      else if (/worker/i.test(name)) currentLayer = "Workers";
      else if (/core/i.test(name)) currentLayer = "Core";
      else if (/external|extern/i.test(name)) currentLayer = "External";
      continue;
    }
    const nm = NODE_RE.exec(line);
    if (nm) {
      const id = nm[1];
      const rawLabel = nm[2].trim();
      const emojiMatch = /^(\p{Emoji}️?|\p{Extended_Pictographic})\s*/u.exec(rawLabel);
      const emoji = emojiMatch ? emojiMatch[1] : "🔹";
      const label = emojiMatch ? rawLabel.slice(emojiMatch[0].length).trim() : rawLabel;
      nodes.set(id, { id, label: label || id, layer: currentLayer, emoji });
      continue;
    }
    const em = EDGE_RE.exec(line);
    if (em) {
      const [, from, op, , to] = em;
      const kind: ArchEdge["kind"] =
        op === "-.->" ? "mirrors" : op === "==>" ? "calls" : "depends";
      edges.push({ from, to, kind });
      if (!nodes.has(from)) nodes.set(from, { id: from, label: from, layer: "Core", emoji: "🔹" });
      if (!nodes.has(to)) nodes.set(to, { id: to, label: to, layer: "Core", emoji: "🔹" });
    }
  }

  return { title, nodes: Array.from(nodes.values()), edges };
}

export { safeId };

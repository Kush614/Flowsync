export type Layer = "Clients" | "Workers" | "Core" | "External";

export interface ArchNode {
  id: string; // mermaid-safe id (no @ / -)
  label: string; // pretty display name
  layer: Layer;
  emoji: string;
}

export interface ArchEdge {
  from: string;
  to: string;
  kind?: "depends" | "mirrors" | "calls";
}

export interface ArchGraph {
  title: string;
  nodes: ArchNode[];
  edges: ArchEdge[];
}

export const LAYER_ORDER: Layer[] = ["Clients", "Workers", "Core", "External"];

export const LAYER_META: Record<Layer, { emoji: string; classId: string; fill: string; stroke: string }> = {
  Clients: { emoji: "🧑‍💻", classId: "cls", fill: "#3a2f1f", stroke: "#e0c47e" },
  Workers: { emoji: "☁️", classId: "wkr", fill: "#1f3a2a", stroke: "#7ee0a2" },
  Core: { emoji: "📦", classId: "core", fill: "#1f3a5f", stroke: "#7ab8ff" },
  External: { emoji: "🌐", classId: "ext", fill: "#2a2a30", stroke: "#9a9aa2" }
};

export function safeId(name: string): string {
  return name.replace(/^@[^/]+\//, "").replace(/[^a-zA-Z0-9]/g, "_");
}

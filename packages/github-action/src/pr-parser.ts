import type { ChangeItem } from "@flowsync/core";

const CONVENTIONAL_RE = /^(feat|fix|chore|docs|refactor|perf|test|build|ci|style|revert)(\([^)]+\))?(!)?:\s*(.+)$/i;
const BREAKING_FOOTER_RE = /BREAKING[- ]CHANGE:/i;

export type Category = "features" | "fixes" | "chores" | "breaking";

export interface ParsedCommit {
  sha: string;
  summary: string;
  author?: string;
  prUrl?: string;
  category: Category;
  isBreaking: boolean;
}

export function categorize(message: string, hasBreakingFooter: boolean): { category: Category; isBreaking: boolean; cleaned: string } {
  const firstLine = message.split("\n", 1)[0] ?? message;
  const match = CONVENTIONAL_RE.exec(firstLine);
  const fullBreaking = hasBreakingFooter || BREAKING_FOOTER_RE.test(message);

  if (!match) {
    return { category: "chores", isBreaking: fullBreaking, cleaned: firstLine };
  }

  const [, typeRaw, , bang, subject] = match;
  const type = typeRaw.toLowerCase();
  const isBreaking = fullBreaking || Boolean(bang);

  let category: Category;
  if (isBreaking) category = "breaking";
  else if (type === "feat") category = "features";
  else if (type === "fix") category = "fixes";
  else category = "chores";

  return { category, isBreaking, cleaned: subject.trim() };
}

export function bucket(commits: ParsedCommit[]): Record<Category, ChangeItem[]> {
  const out: Record<Category, ChangeItem[]> = {
    breaking: [],
    features: [],
    fixes: [],
    chores: []
  };
  for (const c of commits) {
    out[c.category].push({ summary: c.summary, author: c.author, prUrl: c.prUrl, sha: c.sha });
  }
  return out;
}

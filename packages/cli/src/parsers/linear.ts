const LINEAR_RE = /\b([A-Z]{2,8})-(\d{1,6})\b/g;

export function extractLinearTickets(text: string): string[] {
  const seen = new Set<string>();
  for (const match of text.matchAll(LINEAR_RE)) {
    seen.add(`${match[1]}-${match[2]}`);
  }
  return Array.from(seen);
}

export function extractLinearTicketsFromCommits(commits: Array<{ subject: string }>): string[] {
  const all = new Set<string>();
  for (const c of commits) {
    for (const t of extractLinearTickets(c.subject)) all.add(t);
  }
  return Array.from(all);
}

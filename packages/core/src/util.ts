export function normalizeId(id: string): string {
  const clean = id.replace(/-/g, "").trim();
  if (clean.length !== 32) {
    throw new Error(`Invalid Notion ID: expected 32 hex chars, got "${id}"`);
  }
  return `${clean.slice(0, 8)}-${clean.slice(8, 12)}-${clean.slice(12, 16)}-${clean.slice(16, 20)}-${clean.slice(20)}`;
}

export function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export function truncate(text: string, max = 2000): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

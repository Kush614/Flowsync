export interface GhCommit {
  sha: string;
  commit: { message: string; author?: { name?: string } | null };
  author: { login?: string } | null;
}

export class Gh {
  constructor(private readonly token: string) {}

  private async req<T>(path: string, init: RequestInit = {}): Promise<T> {
    const res = await fetch(`https://api.github.com${path}`, {
      ...init,
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${this.token}`,
        "User-Agent": "flowsync-agent-tools",
        "X-GitHub-Api-Version": "2022-11-28",
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...(init.headers ?? {})
      }
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`GitHub ${res.status} ${path}: ${body}`);
    }
    return (await res.json()) as T;
  }

  async previousTag(owner: string, repo: string, currentTag: string): Promise<string | undefined> {
    const tags = await this.req<Array<{ name: string }>>(`/repos/${owner}/${repo}/tags?per_page=50`);
    const names = tags.map((t) => t.name);
    const idx = names.indexOf(currentTag);
    if (idx === -1) return undefined;
    return names[idx + 1];
  }

  async compareCommits(owner: string, repo: string, base: string, head: string): Promise<GhCommit[]> {
    const res = await this.req<{ commits: GhCommit[] }>(
      `/repos/${owner}/${repo}/compare/${base}...${head}`
    );
    return res.commits;
  }

  async createRelease(
    owner: string,
    repo: string,
    body: { tag_name: string; name?: string; body?: string; draft?: boolean }
  ): Promise<{ html_url: string }> {
    return this.req(`/repos/${owner}/${repo}/releases`, {
      method: "POST",
      body: JSON.stringify(body)
    });
  }
}

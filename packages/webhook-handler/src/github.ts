export class GithubClient {
  constructor(private readonly token: string, private readonly userAgent = "flowsync-webhook") {}

  private async req<T>(path: string, init: RequestInit = {}): Promise<T> {
    const res = await fetch(`https://api.github.com${path}`, {
      ...init,
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${this.token}`,
        "User-Agent": this.userAgent,
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

  async createRelease(
    owner: string,
    repo: string,
    body: { tag_name: string; name?: string; body?: string; draft?: boolean }
  ): Promise<{ html_url: string; id: number }> {
    return this.req(`/repos/${owner}/${repo}/releases`, {
      method: "POST",
      body: JSON.stringify(body)
    });
  }

  async createIssue(
    owner: string,
    repo: string,
    body: { title: string; body: string; labels?: string[] }
  ): Promise<{ html_url: string; number: number }> {
    return this.req(`/repos/${owner}/${repo}/issues`, {
      method: "POST",
      body: JSON.stringify(body)
    });
  }

  async createIssueComment(
    owner: string,
    repo: string,
    issueNumber: number,
    body: string
  ): Promise<{ html_url: string }> {
    return this.req(`/repos/${owner}/${repo}/issues/${issueNumber}/comments`, {
      method: "POST",
      body: JSON.stringify({ body })
    });
  }
}

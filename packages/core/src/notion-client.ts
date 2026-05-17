import { Client, APIErrorCode, APIResponseError } from "@notionhq/client";

export interface FlowSyncClientOptions {
  token: string;
  maxRetries?: number;
  baseBackoffMs?: number;
}

export class FlowSyncClient {
  readonly notion: Client;
  private readonly maxRetries: number;
  private readonly baseBackoffMs: number;

  constructor(opts: FlowSyncClientOptions) {
    if (!opts.token) throw new Error("FlowSyncClient: NOTION_TOKEN is required");
    this.notion = new Client({ auth: opts.token });
    this.maxRetries = opts.maxRetries ?? 4;
    this.baseBackoffMs = opts.baseBackoffMs ?? 500;
  }

  async withRetry<T>(fn: () => Promise<T>): Promise<T> {
    let lastErr: unknown;
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (err) {
        lastErr = err;
        if (!this.isRetriable(err) || attempt === this.maxRetries - 1) throw err;
        const delay = Math.min(this.baseBackoffMs * 2 ** attempt, 8000);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
    throw lastErr;
  }

  private isRetriable(err: unknown): boolean {
    if (!APIResponseError.isAPIResponseError(err)) return false;
    return (
      err.code === APIErrorCode.RateLimited ||
      err.code === APIErrorCode.ServiceUnavailable ||
      err.code === APIErrorCode.InternalServerError
    );
  }
}

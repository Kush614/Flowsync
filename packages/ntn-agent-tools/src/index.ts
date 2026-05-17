import { Worker } from "@notionhq/workers";
import { j } from "@notionhq/workers/schema-builder";

const worker = new Worker();
export default worker;

// Notion reserves the NOTION_ env prefix for everything except the
// platform's own NOTION_API_TOKEN, so DB ids use the FLOWSYNC_ prefix.
const CHANGELOG_DB = () => need("FLOWSYNC_CHANGELOG_DB_ID");
const API_DB = () => need("FLOWSYNC_API_REFERENCE_DB_ID");

function need(k: string): string {
	const v = process.env[k];
	if (!v) throw new Error(`Missing env ${k}`);
	return v;
}

function dashId(raw: string): string {
	const c = raw.replace(/-/g, "").trim();
	if (c.length !== 32) throw new Error(`Bad Notion id: ${raw}`);
	return `${c.slice(0, 8)}-${c.slice(8, 12)}-${c.slice(12, 16)}-${c.slice(16, 20)}-${c.slice(20)}`;
}

async function gh<T>(path: string, method = "GET", body?: unknown): Promise<T> {
	const r = await fetch(`https://api.github.com${path}`, {
		method,
		headers: {
			Authorization: `Bearer ${need("GITHUB_TOKEN")}`,
			Accept: "application/vnd.github+json",
			"User-Agent": "flowsync-ntn-worker",
			"X-GitHub-Api-Version": "2022-11-28",
			...(body ? { "Content-Type": "application/json" } : {}),
		},
		body: body ? JSON.stringify(body) : undefined,
	});
	if (!r.ok) throw new Error(`GitHub ${r.status} ${path}: ${(await r.text()).slice(0, 200)}`);
	return r.json() as Promise<T>;
}

async function nt<T = any>(path: string, method = "GET", body?: unknown): Promise<T> {
	const r = await fetch(`https://api.notion.com/v1${path}`, {
		method,
		headers: {
			// Custom-Agent invocations override NOTION_API_TOKEN with the
			// agent's own integration. Pin to our Flowsync integration via a
			// non-reserved var so the tool always has DB access.
			Authorization: `Bearer ${need("FLOWSYNC_NOTION_TOKEN")}`,
			"Notion-Version": "2022-06-28",
			"Content-Type": "application/json",
		},
		body: body ? JSON.stringify(body) : undefined,
	});
	const j = (await r.json()) as T;
	if (!r.ok) throw new Error(`Notion ${r.status} ${path}: ${JSON.stringify(j).slice(0, 220)}`);
	return j;
}

const rt = (s: string) => [{ type: "text", text: { content: s.slice(0, 1900) } }];
const bullet = (s: string, link?: string) => ({
	object: "block",
	type: "bulleted_list_item",
	bulleted_list_item: {
		rich_text: [{ type: "text", text: { content: s.slice(0, 1900), link: link ? { url: link } : null } }],
	},
});
const toggle = (s: string, kids: unknown[]) => ({
	object: "block",
	type: "toggle",
	toggle: { rich_text: rt(s), children: kids },
});
const callout = (s: string, emoji: string) => ({
	object: "block",
	type: "callout",
	callout: { rich_text: rt(s), icon: { type: "emoji", emoji } },
});

const CONV = /^(feat|fix|chore|docs|refactor|perf|test|build|ci|style|revert)(\([^)]+\))?(!)?:\s*(.+)$/i;
const CAP = 80;

interface Commit {
	sha: string;
	commit: { message: string; author?: { name?: string } | null };
	author: { login?: string } | null;
}

function section(title: string, items: Array<{ s: string; url?: string }>) {
	const shown: unknown[] = items.slice(0, CAP).map((i) => bullet(i.s, i.url));
	if (items.length > CAP)
		shown.push(bullet(`…and ${items.length - CAP} more ${title.toLowerCase()} in this release`));
	return toggle(`${title} (${items.length})`, shown);
}

async function findByTitle(dbId: string, title: string): Promise<string | null> {
	const res = await nt(`/databases/${dashId(dbId)}/query`, "POST", {
		filter: { property: "Name", title: { equals: title } },
		page_size: 1,
	});
	return res.results?.[0]?.id ?? null;
}

async function replaceChildren(pageId: string, children: unknown[]) {
	let cursor: string | undefined;
	do {
		const q = cursor ? `?page_size=100&start_cursor=${cursor}` : `?page_size=100`;
		const pg = await nt(`/blocks/${pageId}/children${q}`);
		for (const b of pg.results ?? []) await nt(`/blocks/${b.id}`, "DELETE");
		cursor = pg.has_more ? pg.next_cursor ?? undefined : undefined;
	} while (cursor);
	for (let i = 0; i < children.length; i += 100)
		await nt(`/blocks/${pageId}/children`, "PATCH", { children: children.slice(i, i + 100) });
}

worker.tool("generate_changelog", {
	title: "Generate Changelog",
	description:
		"Read commits between two git tags from a GitHub repo and upsert a structured release entry into the Notion Changelog database.",
	schema: j.object({
		repo: j.string().describe("GitHub repo as owner/name, e.g. angular/angular"),
		tag: j.string().describe("New release tag, e.g. v21.2.0"),
		fromTag: j.string().describe("Previous tag to compare from").nullable(),
	}),
	execute: async (input) => {
		const { repo, tag } = input;
		const [owner, name] = repo.split("/");
		if (!owner || !name) throw new Error(`Invalid repo: ${repo}`);
		let base = input.fromTag ?? undefined;
		if (!base) {
			const tags = await gh<Array<{ name: string }>>(`/repos/${owner}/${name}/tags?per_page=50`);
			const idx = tags.findIndex((t) => t.name === tag);
			base = idx >= 0 ? tags[idx + 1]?.name : undefined;
		}
		if (!base) return `No previous tag before ${tag}. Pass fromTag.`;

		const cmp = await gh<{ commits: Commit[] }>(`/repos/${owner}/${name}/compare/${base}...${tag}`);
		const feats: Array<{ s: string; url?: string }> = [];
		const fixes: Array<{ s: string; url?: string }> = [];
		const chores: Array<{ s: string; url?: string }> = [];
		const breaking: Array<{ s: string; url?: string }> = [];
		for (const c of cmp.commits) {
			const first = c.commit.message.split("\n", 1)[0] ?? c.commit.message;
			const m = CONV.exec(first);
			const who = c.author?.login ?? c.commit.author?.name ?? "";
			const pr = /\(#(\d+)\)/.exec(first);
			const item = {
				s: `${m ? m[4].trim() : first} (${c.sha.slice(0, 7)})${who ? ` — @${who}` : ""}`,
				url: pr ? `https://github.com/${owner}/${name}/pull/${pr[1]}` : undefined,
			};
			if (m?.[3] === "!") breaking.push(item);
			else if (m?.[1]?.toLowerCase() === "feat") feats.push(item);
			else if (m?.[1]?.toLowerCase() === "fix") fixes.push(item);
			else chores.push(item);
		}

		const body: unknown[] = [
			callout(`Range ${base}..${tag} · ${cmp.commits.length} commits · auto-generated by FlowSync`, "🚀"),
		];
		if (breaking.length) body.push(section("Breaking changes", breaking));
		if (feats.length) body.push(section("Features", feats));
		if (fixes.length) body.push(section("Fixes", fixes));
		if (chores.length) body.push(section("Chores", chores));

		const properties = {
			Name: { title: [{ type: "text", text: { content: tag } }] },
			"Release Date": { date: { start: new Date().toISOString().slice(0, 10) } },
			Features: { number: feats.length },
			Fixes: { number: fixes.length },
			Breaking: { number: breaking.length },
		};

		const existing = await findByTitle(CHANGELOG_DB(), tag);
		let url: string;
		if (existing) {
			const up = await nt(`/pages/${existing}`, "PATCH", { properties });
			await replaceChildren(existing, body);
			url = up.url;
		} else {
			const cr = await nt(`/pages`, "POST", {
				parent: { database_id: dashId(CHANGELOG_DB()) },
				properties,
				children: body,
			});
			url = cr.url;
		}
		return `${existing ? "Updated" : "Created"} ${tag}: ${breaking.length} breaking, ${feats.length} features, ${fixes.length} fixes, ${chores.length} chores. ${url}`;
	},
});

worker.tool("query_release", {
	title: "Query Release",
	description: "Look up a release by tag in the Notion Changelog database and return a summary.",
	schema: j.object({ tag: j.string().describe("Release tag, e.g. v21.2.0") }),
	execute: async ({ tag }) => {
		const res = await nt(`/databases/${dashId(CHANGELOG_DB())}/query`, "POST", {
			filter: { property: "Name", title: { equals: tag } },
			page_size: 1,
		});
		const r = res.results?.[0];
		if (!r) return `No release found for ${tag}.`;
		const p = r.properties;
		return `Release ${tag} (${p["Release Date"]?.date?.start ?? "no date"}): ${p.Breaking?.number ?? 0} breaking, ${p.Features?.number ?? 0} features, ${p.Fixes?.number ?? 0} fixes. ${r.url}`;
	},
});

worker.tool("publish_release", {
	title: "Publish Release",
	description: "Read a Notion changelog page and publish the corresponding GitHub release.",
	schema: j.object({
		pageId: j.string().describe("Notion page ID of the changelog row"),
		repo: j.string().describe("GitHub repo as owner/name"),
		draft: j.boolean().describe("Create as draft").nullable(),
	}),
	execute: async (input) => {
		const [owner, name] = input.repo.split("/");
		if (!owner || !name) throw new Error(`Invalid repo: ${input.repo}`);
		const page = await nt(`/pages/${input.pageId}`);
		let title = "";
		for (const v of Object.values(page.properties as Record<string, any>))
			if ((v as any).title) title = (v as any).title.map((t: any) => t.plain_text).join("");
		if (!title) throw new Error("Page has no title");
		const rel = await gh<{ html_url: string }>(`/repos/${owner}/${name}/releases`, "POST", {
			tag_name: title,
			name: title,
			body: `Published from Notion: ${page.url}`,
			draft: input.draft ?? false,
		});
		return `Published GitHub release ${title}: ${rel.html_url}`;
	},
});

worker.tool("sync_api_reference", {
	title: "Sync API Reference",
	description: "Fetch an OpenAPI JSON spec and upsert each endpoint into the Notion API Reference database.",
	schema: j.object({ specUrl: j.string().describe("URL to an OpenAPI 3.x JSON spec") }),
	execute: async ({ specUrl }) => {
		const r = await fetch(specUrl, { headers: { Accept: "application/json" } });
		if (!r.ok) throw new Error(`Fetch spec ${r.status}`);
		const spec = (await r.json()) as {
			paths?: Record<string, Record<string, { operationId?: string; tags?: string[] }>>;
		};
		const methods = ["get", "post", "put", "patch", "delete", "options", "head"];
		let created = 0;
		let updated = 0;
		for (const [route, ms] of Object.entries(spec.paths ?? {})) {
			for (const method of methods) {
				const op = ms[method];
				if (!op) continue;
				const opId = op.operationId ?? `${method.toUpperCase()} ${route}`;
				const properties = {
					Name: { title: [{ type: "text", text: { content: `${method.toUpperCase()} ${route}` } }] },
					Operation: { rich_text: [{ type: "text", text: { content: opId } }] },
					Method: { select: { name: method.toUpperCase() } },
					Path: { rich_text: [{ type: "text", text: { content: route } }] },
					Tags: { multi_select: (op.tags ?? []).slice(0, 20).map((nm) => ({ name: nm })) },
					Deprecated: { checkbox: false },
				};
				const q = await nt(`/databases/${dashId(API_DB())}/query`, "POST", {
					filter: { property: "Operation", rich_text: { equals: opId } },
					page_size: 1,
				});
				if (q.results?.[0]) {
					await nt(`/pages/${q.results[0].id}`, "PATCH", { properties });
					updated++;
				} else {
					await nt(`/pages`, "POST", { parent: { database_id: dashId(API_DB()) }, properties });
					created++;
				}
			}
		}
		return `Synced ${created + updated} endpoints from ${specUrl}. Created ${created}, updated ${updated}.`;
	},
});

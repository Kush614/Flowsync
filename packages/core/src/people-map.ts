export interface PeopleMap {
  byGithubLogin: Map<string, string>;
  breakingChangeLead?: string;
}

export interface PeopleMapFile {
  users: Array<{ github: string; notion: string }>;
  breakingChangeLead?: string;
}

export function parsePeopleMap(raw: string): PeopleMap {
  const parsed = JSON.parse(raw) as PeopleMapFile;
  const byGithubLogin = new Map<string, string>();
  for (const u of parsed.users) {
    byGithubLogin.set(u.github.toLowerCase(), u.notion);
  }
  return { byGithubLogin, breakingChangeLead: parsed.breakingChangeLead };
}

export function notionUsersFor(map: PeopleMap, githubLogins: Array<string | undefined>): string[] {
  const ids = new Set<string>();
  for (const login of githubLogins) {
    if (!login) continue;
    const id = map.byGithubLogin.get(login.toLowerCase());
    if (id) ids.add(id);
  }
  return Array.from(ids);
}

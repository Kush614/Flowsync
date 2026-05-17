# notion-flowsync (Python)

Python sibling CLI to the TypeScript `@flowsync/cli`. Mirrors the `push` subcommand so Python-heavy repos can run changelog automation without a Node.js toolchain.

## Install (editable)

```bash
cd cli-py
python -m venv .venv
.venv\Scripts\activate    # PowerShell: .\.venv\Scripts\Activate.ps1
pip install -e .
```

## Configure

Copy the repo-root `.env.example` to `.env` and set `NOTION_TOKEN` plus `NOTION_CHANGELOG_DB_ID`.

## Run

```bash
notion-sync push --tag v1.4.0
notion-sync push --tag v1.4.0 --from v1.3.0
notion-sync push --tag v1.4.0 --dry-run
```

## Notion database schema

The Changelog DB must have these properties:

| Property      | Type       |
|---------------|-----------|
| Name          | Title     |
| Release Date  | Date      |
| Features      | Number    |
| Fixes         | Number    |
| Breaking      | Number    |

from __future__ import annotations

import json
import os
import sys
from datetime import date

import click
from dotenv import load_dotenv

from . import __version__
from .notion_io import FlowSyncClient, upsert_changelog
from .parsers import bucket, git_log, previous_tag


@click.group()
@click.version_option(__version__, prog_name="notion-sync")
def main() -> None:
    """FlowSync Python CLI — sync engineering artifacts into Notion."""
    load_dotenv()


@main.command("push")
@click.option("--tag", required=True, help="Release tag (e.g., v1.4.0)")
@click.option("--from", "from_ref", help="Compare from this git ref. Defaults to previous tag.")
@click.option("--database", help="Notion database ID. Defaults to NOTION_CHANGELOG_DB_ID.")
@click.option("--dry-run", is_flag=True, default=False, help="Print payload without writing.")
def push(tag: str, from_ref: str | None, database: str | None, dry_run: bool) -> None:
    """Generate a changelog entry from git history and upsert into Notion."""
    base = from_ref or previous_tag(tag)
    commits = git_log(base, tag)
    buckets = bucket(commits)

    click.echo(f"Parsed {len(commits)} commits between {base or '(init)'}..{tag}", err=True)

    if dry_run:
        payload = {
            "releaseTag": tag,
            "releaseDate": date.today().isoformat(),
            "features": [c.__dict__ for c in buckets.features],
            "fixes": [c.__dict__ for c in buckets.fixes],
            "chores": [c.__dict__ for c in buckets.chores],
            "breaking": [c.__dict__ for c in buckets.breaking],
        }
        click.echo(json.dumps(payload, indent=2))
        return

    token = os.environ.get("NOTION_TOKEN")
    db_id = database or os.environ.get("NOTION_CHANGELOG_DB_ID")
    if not token or not db_id:
        click.echo("NOTION_TOKEN and NOTION_CHANGELOG_DB_ID (or --database) are required", err=True)
        sys.exit(1)

    client = FlowSyncClient(token=token)
    result = upsert_changelog(
        client=client,
        database_id=db_id,
        release_tag=tag,
        release_date=date.today().isoformat(),
        buckets=buckets,
    )
    verb = "Created" if result.created else "Updated"
    click.echo(f"{verb} {result.url}")


if __name__ == "__main__":
    main()

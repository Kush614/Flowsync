from __future__ import annotations

import time
from dataclasses import dataclass
from typing import Any

from notion_client import Client
from notion_client.errors import APIResponseError

from .parsers import Buckets, ChangeItem


@dataclass
class UpsertResult:
    page_id: str
    created: bool
    url: str


class FlowSyncClient:
    def __init__(self, token: str, max_retries: int = 4) -> None:
        if not token:
            raise ValueError("NOTION_TOKEN is required")
        self.notion = Client(auth=token)
        self.max_retries = max_retries

    def with_retry(self, fn):
        last: Exception | None = None
        for attempt in range(self.max_retries):
            try:
                return fn()
            except APIResponseError as err:
                last = err
                if err.code not in ("rate_limited", "internal_server_error", "service_unavailable"):
                    raise
                if attempt == self.max_retries - 1:
                    raise
                time.sleep(min(0.5 * (2**attempt), 8))
        assert last is not None
        raise last


def _normalize_id(raw: str) -> str:
    clean = raw.replace("-", "").strip()
    if len(clean) != 32:
        raise ValueError(f"Invalid Notion ID: {raw!r}")
    return f"{clean[0:8]}-{clean[8:12]}-{clean[12:16]}-{clean[16:20]}-{clean[20:]}"


def _rt(text: str) -> list[dict[str, Any]]:
    return [{"type": "text", "text": {"content": text[:2000]}}]


def _bullet(item: ChangeItem) -> dict[str, Any]:
    short_sha = item.sha[:7]
    return {
        "object": "block",
        "type": "bulleted_list_item",
        "bulleted_list_item": {
            "rich_text": _rt(f"{item.summary} ({short_sha}) — @{item.author}")
        },
    }


def _toggle(label: str, items: list[ChangeItem]) -> dict[str, Any]:
    return {
        "object": "block",
        "type": "toggle",
        "toggle": {
            "rich_text": _rt(f"{label} ({len(items)})"),
            "children": [_bullet(i) for i in items],
        },
    }


def upsert_changelog(
    client: FlowSyncClient,
    database_id: str,
    release_tag: str,
    release_date: str,
    buckets: Buckets,
) -> UpsertResult:
    db = _normalize_id(database_id)

    found = client.with_retry(
        lambda: client.notion.databases.query(
            database_id=db,
            filter={"property": "Name", "title": {"equals": release_tag}},
            page_size=1,
        )
    )
    existing_id = found["results"][0]["id"] if found["results"] else None

    properties: dict[str, Any] = {
        "Name": {"title": _rt(release_tag)},
        "Release Date": {"date": {"start": release_date}},
        "Features": {"number": len(buckets.features)},
        "Fixes": {"number": len(buckets.fixes)},
        "Breaking": {"number": len(buckets.breaking)},
    }

    children: list[dict[str, Any]] = []
    if buckets.breaking:
        children.append(_toggle("Breaking changes", buckets.breaking))
    if buckets.features:
        children.append(_toggle("Features", buckets.features))
    if buckets.fixes:
        children.append(_toggle("Fixes", buckets.fixes))
    if buckets.chores:
        children.append(_toggle("Chores", buckets.chores))

    if existing_id:
        updated = client.with_retry(
            lambda: client.notion.pages.update(page_id=existing_id, properties=properties)
        )
        _replace_children(client, existing_id, children)
        return UpsertResult(page_id=existing_id, created=False, url=updated["url"])

    created = client.with_retry(
        lambda: client.notion.pages.create(
            parent={"database_id": db},
            properties=properties,
            children=children,
        )
    )
    return UpsertResult(page_id=created["id"], created=True, url=created["url"])


def _replace_children(client: FlowSyncClient, page_id: str, new_children: list[dict[str, Any]]) -> None:
    cursor: str | None = None
    while True:
        params: dict[str, Any] = {"block_id": page_id, "page_size": 100}
        if cursor:
            params["start_cursor"] = cursor
        page = client.with_retry(lambda: client.notion.blocks.children.list(**params))
        for block in page["results"]:
            client.with_retry(lambda b=block: client.notion.blocks.delete(block_id=b["id"]))
        if not page.get("has_more"):
            break
        cursor = page.get("next_cursor")

    for i in range(0, len(new_children), 100):
        batch = new_children[i : i + 100]
        client.with_retry(
            lambda b=batch: client.notion.blocks.children.append(block_id=page_id, children=b)
        )

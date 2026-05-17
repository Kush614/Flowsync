from __future__ import annotations

import re
import subprocess
from dataclasses import dataclass, field

CONVENTIONAL_RE = re.compile(
    r"^(?P<type>feat|fix|chore|docs|refactor|perf|test|build|ci|style|revert)"
    r"(?:\([^)]+\))?(?P<bang>!)?:\s*(?P<subject>.+)$",
    re.IGNORECASE,
)


@dataclass
class ChangeItem:
    summary: str
    sha: str
    author: str


@dataclass
class Buckets:
    breaking: list[ChangeItem] = field(default_factory=list)
    features: list[ChangeItem] = field(default_factory=list)
    fixes: list[ChangeItem] = field(default_factory=list)
    chores: list[ChangeItem] = field(default_factory=list)


def git_log(from_ref: str | None, to_ref: str) -> list[ChangeItem]:
    rng = f"{from_ref}..{to_ref}" if from_ref else to_ref
    fmt = "%H\t%an\t%s"
    out = subprocess.check_output(
        ["git", "log", "--no-merges", f"--pretty=format:{fmt}", rng],
        text=True,
    )
    items: list[ChangeItem] = []
    for line in out.splitlines():
        if not line.strip():
            continue
        sha, author, subject = line.split("\t", 2)
        items.append(ChangeItem(summary=subject, sha=sha, author=author))
    return items


def previous_tag(current_tag: str) -> str | None:
    try:
        out = subprocess.check_output(
            ["git", "describe", "--tags", "--abbrev=0", f"{current_tag}^"],
            text=True,
            stderr=subprocess.DEVNULL,
        )
        return out.strip() or None
    except subprocess.CalledProcessError:
        return None


def bucket(items: list[ChangeItem]) -> Buckets:
    out = Buckets()
    for item in items:
        m = CONVENTIONAL_RE.match(item.summary)
        cleaned = ChangeItem(
            summary=(m.group("subject") if m else item.summary).strip(),
            sha=item.sha,
            author=item.author,
        )
        if m and m.group("bang"):
            out.breaking.append(cleaned)
        elif m and m.group("type").lower() == "feat":
            out.features.append(cleaned)
        elif m and m.group("type").lower() == "fix":
            out.fixes.append(cleaned)
        else:
            out.chores.append(cleaned)
    return out

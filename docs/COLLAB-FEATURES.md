# Collaboration features

FlowSync started as a one-way pipe (code → Notion). These features turn it into a workspace where engineers, PMs, support, and customers can all interact with the same source of truth.

## 1. Release approval (Notion → GitHub)

**Trigger:** A user flips a Changelog row from `Ready for review` → `Approved for release`.
**Action:** `@flowsync/webhook-handler` publishes a real GitHub release with the row's Release Notes.

Why it matters: non-engineers can ship releases. The engineer's job is to merge — the PM's is to approve. Each role uses the tool they already live in.

## 2. Comment forwarding (Notion → GitHub PR)

**Trigger:** Someone adds a comment to a Changelog or API Reference row.
**Action:** Webhook fetches the comment, locates the linked PR (via `#123` ref in the page or a `PR Number` property), and posts a PR comment with a backlink.

Why it matters: a PM asking "can this fix wait until Tuesday?" should appear on the engineer's PR, not in a Notion thread nobody monitors.

## 3. Edit-back to source (Notion → GitHub issue)

**Trigger:** Someone edits the `Description`, `Summary`, or `Notes` field on a synced row.
**Action:** Webhook opens a labeled GitHub issue with the edit, linking back to the Notion source, so an engineer can update the JSDoc / OpenAPI / migration comment.

Why it matters: docs are editable by non-engineers without giving them merge rights. Source-of-truth stays in code, but the friction of "filed in the wrong place" goes away.

## 4. Authors as Notion People

`packages/cli` and `packages/github-action` load `flowsync/people-map.json` (GitHub login → Notion user ID) and write a `People` property on every Changelog row.

Result: engineers are real Notion users, not strings. `@mention` them. Filter by them. They get notified.

## 5. Auto-@mention on breaking changes

When a release has any breaking changes, FlowSync inserts a banner callout that `@mentions` the `breakingChangeLead` from the people map. They get a Notion notification automatically.

## 6. Reactions as approval

This is a Notion configuration — no FlowSync code required. Add a `Reviewed by` rollup that counts reactions or comments. Filter views by `Reviewed by >= 2` to surface "ready to ship" releases.

## 7. Per-persona views

Same Changelog DB, three audiences:

- **Engineering** — everything.
- **Product** — features + breaking changes only.
- **Support** — fixes grouped by Release Date, with a Customers rollup.

See `DATABASE-SETUP.md` for filter specs.

## 8. Synced blocks

`@flowsync/core` exports `createSyncedSource(client, parentPageId, children)` and `referenceSynced(client, targetPageId, sourceBlockId)`.

Use case: a "release summary" block on the engineering wiki *is the same content* on the public release-notes page and the customer-facing changelog. Edit one, all update.

## 9. Notion AI over the docs

Once FlowSync populates your DBs, Notion AI can answer free-form questions:

- "What shipped in v1.4?"
- "Which endpoints take a User body?"
- "What fields does the Post table have?"

This is "free" once the substrate exists. The win is that you stop asking engineers and ask the workspace.

## 10. Auto-linked relations

FlowSync extracts Linear ticket IDs (e.g., `ENG-1234`) from commit messages and writes them to a `Linear Tickets` property. Combined with Notion's Linear sync, ticket pages link back automatically.

You can also pass `customerRelationIds` when calling the `ChangelogUpserter` directly — relate releases to customer accounts so "which customers got this fix" becomes a one-click filter.

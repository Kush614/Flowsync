# Notion database setup

FlowSync writes to three databases. Set these up once in Notion before pointing FlowSync at them. All property names are case-sensitive.

## 1. Changelog database

| Property         | Type          | Required | Notes |
|------------------|---------------|----------|-------|
| Name             | Title         | yes      | Will be set to the git tag, e.g. `v1.4.0`. |
| Release Date     | Date          | yes      |  |
| Features         | Number        | yes      |  |
| Fixes            | Number        | yes      |  |
| Breaking         | Number        | yes      |  |
| Status           | Status        | no       | Required for release-approval webhook. Use values: `Draft`, `Ready for review`, `Approved for release`. |
| Authors          | People        | no       | Required if you supply a `people-map.json`. |
| Linear Tickets   | Text          | no       | Required if your commits reference Linear tickets. |
| Customers        | Relation      | no       | Required if you wire customer accounts. Target a Customers DB. |
| Release Notes    | Text          | no       | Used by the release-approval webhook to populate the GitHub release body. |
| PR Number        | Number        | no       | Helps the comment-forwarder locate the PR. |

### Recommended per-persona views

- **Engineering** — all rows, sorted by Release Date desc.
- **Product** — filter `Breaking > 0 OR Features > 0`, hide Chores. Roll up `Authors` to show owners.
- **Support** — filter `Fixes > 0`, group by Release Date by week. Add a `Customers` rollup so support sees which customers were waiting on each fix.
- **Public release notes** — filter `Status = Approved for release`, show only Name, Release Date, and the Release Notes property.

## 2. API Reference database

| Property    | Type         | Required |
|-------------|--------------|----------|
| Name        | Title        | yes (set to `METHOD /path`) |
| Operation   | Text         | yes (used as unique key) |
| Method      | Select       | yes (`GET`, `POST`, `PUT`, `PATCH`, `DELETE`, …) |
| Path        | Text         | yes |
| Tags        | Multi-select | yes |
| Deprecated  | Checkbox     | yes |
| Description | Text         | no (edit-back webhook tracks this) |

### Recommended views

- **By tag** — group by Tags, kanban style.
- **Deprecated** — filter `Deprecated = true`. Auto-warning surface for partners.

## 3. Data Dictionary database

| Property | Type     | Required |
|----------|----------|----------|
| Name     | Title    | yes (table name) |
| Schema   | Text     | yes |
| Columns  | Number   | yes |
| Has FK   | Checkbox | yes |

### Recommended views

- **All tables** — gallery view with a Has FK badge.
- **Tables with relations** — filter `Has FK = true`. Surface the schema's foreign-key graph at a glance.

## Status workflow for releases

FlowSync's webhook handler reacts to a Status property flipping to `Approved for release`. Configure the Status property like so:

```
To-do:   Draft
In progress: Ready for review
Complete: Approved for release, Shipped
```

The webhook only publishes the GitHub release when the Status flips *into* `Approved for release`. Subsequent edits won't re-publish.

## Notion AI over your synced docs

Once FlowSync is populating these databases, Notion AI can answer:

- "What shipped in v1.4.0?"
- "Which endpoints take a `User` body?"
- "What fields does the `Post` table have?"
- "What did @Kush ship last week?"

To enable this end-to-end:

1. Make sure the parent page (or workspace) has Notion AI on.
2. In the Changelog DB, add an `AI summary` property of type "AI summary" — Notion AI will auto-summarize each release page.
3. In the API Reference DB, add an `AI key fields` property — generates a one-line description per endpoint.

You build the substrate; Notion AI does the rest.

## Reactions and approval workflow

For lightweight stakeholder approval without engineering involvement:

- Add a `Reviewed by` rollup property on Changelog rows that counts comments or page reactions.
- Use a view filter `Reviewed by >= 2` for "ready to ship."
- The comment-forwarder webhook will mirror review comments to the PR, so engineers see Notion approval without leaving GitHub.

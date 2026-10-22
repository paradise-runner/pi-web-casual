---
name: repo-docs
description: Rewrite or audit a repository's README, docs, glossary, and ADRs around the new-user path, with an explicit limits section and every claim verified against source. Use when writing, restructuring, or reviewing README.md, docs/, CONTRIBUTING.md, or when docs oversell a project, hide known gaps, or bury the first useful action under internals.
---

# Repository docs

Target reader: someone who has never used the project. They should be able to install it, do the one useful thing, and learn what it deliberately cannot do — without reading internals and without wading through marketing.

A doc set written this way has four properties: the first screen answers "what is this and what do I type", every capability claim is traceable to code, non-goals are stated as plainly as goals, and detail lives in exactly one place.

## Workflow

1. **Read the code, not the old docs.** Old docs encode stale assumptions; treat every sentence as unverified.
2. **Inventory user-visible behavior.** List entry points (buttons, tabs, commands, palette actions), each control, each state the UI can show. For each, trace the call chain from contribution → handler → navigation or render.
3. **Classify each claim** as source-backed, conditional, or false. Record conditionals precisely (which state, which version, which surface).
4. **Restructure** using the contract below; delete what the code does not support.
5. **Push detail down**: README → `docs/using-*.md` → `docs/how-it-works.md` → `docs/adr/`. Each fact keeps one home.
6. **Verify mechanically**: run `node scripts/check-doc-links.mjs .` (relative paths, images, and heading anchors; exits non-zero on failure), then confirm images render on the hosting surface.
7. **Update contributor docs**: document ownership and the PR obligation to keep limits current.

Start from `references/readme-skeleton.md` when writing a README from scratch.

## README contract

Fixed order. A section may be omitted only if it genuinely does not apply; never reorder to hide a section.

1. `# project-name`
2. **One sentence** stating what it is, mechanically, with no adjectives: "A PI WEB plugin that adds one long-running conversation that is not attached to a repository."
3. `**Status:**` line — implemented/experimental, the artifact shape (browser-only, server entry, single binary), and whether a restart is required.
4. One screenshot or terminal capture with descriptive alt text (what a reader would see, not "screenshot").
5. `## What <thing> does` — what it contributes, then how it behaves, as declarative bullets.
6. `## Install` with a `### Requirements` subsection (runtime versions, toolchain only if building, restart needs).
7. First run / quick start if the first use needs more than install.
8. `## Use` — a task → where table.
9. `## Limits (v<major>)` — required, see below.
10. `## How it runs` — architecture in a short paragraph, plus a change → action table (what rebuilds, what reloads, what restarts).
11. `## Development` — commands only, no duplicated setup prose.
12. `## Contributing` — one paragraph plus links.
13. `## Decisions` — index of ADRs, glossary, and deep docs.
14. `## Related`, `## License`.

Do not open with badges, a centered HTML hero, or an emoji heading. One screenshot per surface in the README; the rest belong in `docs/`.

## Voice

- Describe what happens, not how good it is. "The panel shows…", "It creates…", "The previous conversation stays in Sessions."
- Every adjective must be measurable or go. Strength words and superlatives are claims nobody verifies.
- Quote UI labels verbatim and bold (**New chat**, **Reset link**), including the exact state strings the code renders.
- Name concrete objects (`~/.casual-pi-web`, `localStorage`, `data-*` markers) instead of "configuration" or "internal state".
- One plain paragraph before any table; tables carry lists, not narrative.
- Never promise behavior the code does not implement "yet". If it is planned, link an issue.

## Limits section

The limits section is the section readers trust most, because competitors omit theirs. Include every category that applies:

- **Scope**: what the project deliberately does not do (one conversation, no topics; global installs only).
- **Storage**: where state lives, per-machine vs shared, what a second machine sees.
- **Missing surfaces**: no settings pane, no CLI flag, no API — and where the workaround is.
- **Conditional controls**: a control that exists in only some states, plus the reliable path that always works.
- **Best-effort integrations**: anything depending on private markup, undocumented endpoints, or host internals, and what still works when it breaks.
- **Version support**: oldest supported version, deprecation warnings emitted on newer ones, and what a fix would cost.
- **Data lifecycle**: what the project never deletes, and where deletion actually happens.
- **Telemetry**: state "no telemetry" only after grepping for it.

Rules: no softening ("Currently…" only with an issue link); no heading like "Known issues" in place of limits; if a documented control turns out to be unreachable in a common flow, say so and point at the reachable alternative.

## Verify claims against code

| Claim type | Check |
| --- | --- |
| "Button/tab opens X" | Click handler → open function → navigation call |
| "Command does Y" | The command body; what it writes, what it preserves |
| "Resets Z" | Which fields the handler clears, and which it keeps |
| "Hidden from the sidebar/list" | The selector or model-based filter, plus its restore path on deactivate |
| "Works on version N" | The feature-detection branch and its fallback |
| "No telemetry / no network" | `rg -n "fetch|beacon|axios|XMLHttpRequest|sentry|analytics"` |
| "Keeps history" | Confirm the code path never deletes; find the one that does |

Useful starting points:

```sh
rg -n "addEventListener|onClick|@click" src        # entry points
rg -n "navigate|router|href" src                  # where a control lands
rg -n "localStorage|sessionStorage|writeFile" src # state and storage
rg -n "version|apiVersion|compat" src             # support claims
```

Cross-check the rendered state strings, then quote them exactly.

## Docs split

| File | Owns | Never contains |
| --- | --- | --- |
| `README.md` | What it is, install, first run, task table, limits, how it runs, links | Version-specific internals, duplicated setup prose, contributor workflow |
| `docs/using-*.md` | The user path: first run detail, entry points, states, controls, recovery table, privacy | Architecture, bootstrap internals, build steps |
| `docs/how-it-works.md` | Bootstrap, discovery order, stored state and keys, DOM integration, layout, compatibility detail | Marketing copy, duplicate install instructions |
| `docs/adr/NNNN-*.md` | One decision each, with consequences | Tutorials, feature wishlists |
| `GLOSSARY.md` | Domain terms and the synonyms to avoid | Usage instructions |
| `CONTRIBUTING.md` | Setup, hot-reload/restart matrix, manual checklist, docs ownership | User-facing quick start duplicate |

Cross-link instead of restating. A reader who lands anywhere should reach the others in one hop.

## ADR contract

- Path `docs/adr/NNNN-kebab-slug.md`, numbered from 0001, never renumbered.
- Title is the decision, not the problem: "One long-running conversation", "Stay on browser plugin API v4".
- First paragraph: the forces and the choice in at most five sentences, no headings. State what was rejected and why in passing.
- `## Consequences`: bullets covering costs, what the decision forbids, and what reversing it would require.
- Length: 10–20 lines. An ADR that needs a diagram is two ADRs.
- Write ADRs for tradeoffs already visible in the code. Do not invent future plans.
- Index every ADR under `## Decisions` in the README, with one-line titles.

## Glossary contract

- Group under `### Objects`, `### Operations`, `### Surfaces` (or the domain's own axes).
- `**Term**:` then one sentence defining it in this project's terms, then `_Avoid_:` with the synonyms the docs must not use.
- Use these exact terms in issues, docs, test names, and commit messages. Drift to an avoided synonym is a doc bug.
- Skip a glossary when the project has fewer than about six non-obvious terms; a thin glossary teaches readers to ignore it.

## Contributor obligations

In `CONTRIBUTING.md`, add a `## Documentation` section that states, per file, what it owns, and make the PR checklist require:

- behavior changes update the matching doc;
- the README **Limits** section is re-read whenever a control, surface, or version range changes;
- any changed user-visible tradeoff gets a new ADR and a README **Decisions** entry;
- links and anchors pass `scripts/check-doc-links.mjs`.

## Bundled files

- `references/readme-skeleton.md` — fill-in README with the section contract and inline prompts.
- `scripts/check-doc-links.mjs` — dependency-free checker; run `node scripts/check-doc-links.mjs [root]`. It ignores fenced code and inline code, accepts directory links that resolve to a `README.md`, honours `<a id>`/`{#id}` anchors, and exits 1 on broken targets or anchors, 2 on a bad root.

## Anti-patterns

| Instead of | Write |
| --- | --- |
| "## Why <project>?" with benefits | "## What <project> does" with contributions and states |
| Badge row and centered hero above any sentence | One sentence, status line, screenshot |
| "Beautifully fast, seamless" | "Reopens the same session from any project" |
| "Known issues" | `## Limits (v1)` with categories and workarounds |
| Install alternatives before the primary path | Primary path first, alternatives collapsed or linked |
| Version-specific internals in the README | A line in `docs/how-it-works.md` |
| The same setup commands in README and CONTRIBUTING | One home, one link |
| Documenting the intended UI without checking reachability | Document the states that exist and name the reliable path |

## Finish criteria

- A reader who only sees the first screen knows what it is and how to start.
- Every UI label in the docs exists in the source strings.
- Every "works on version N" claim names the branch that implements it.
- Limits lists at least scope, storage, surfaces, version support, and data lifecycle — or explains why a category does not apply.
- Each fact appears once; other files link to it.
- Glossary terms are used consistently; avoided synonyms appear nowhere else.
- `scripts/check-doc-links.mjs` passes, and images load from the rendered path.

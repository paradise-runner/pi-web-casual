# README skeleton

Copy this and fill it in. Delete a section only when it genuinely does not apply; do not reorder.

```markdown
# project-name

One sentence stating what this is, mechanically, with no adjectives.

**Status:** implemented (v1). <artifact shape: browser-only / one binary / server entry>. <restart or reload requirement>.

![What a reader actually sees: the main surface, its controls, and the state after setup](docs/main-surface.png)

## What <project> does

The problem in one short paragraph, naming the constraint the project respects.

It contributes:

- <surface> — <where it appears>;
- <command> — <what it runs>.

It behaves like this:

- **Behavior name.** One sentence on the observable outcome, including what it preserves.
- **Self-repair.** What the software recovers from on its own, and what it does not.

## Install

### Requirements

- <runtime> <oldest supported version> (tested against <exact tested version>).
- <toolchain>, only if building from source.
- <restart requirement, or "none">.

### <Primary path>

1. <step>
2. <step>

### <Alternative path>

<Short prose and one link. Never more steps than the primary path.>

## First run

1. <first action>
2. <what the software creates, trusts, or writes>
3. <what the user sees>

<Explain any one-time cost, e.g. a single reload, and why it exists.>

## Use

| Task | Where |
| --- | --- |
| <recurring task> | <exact label, tab, command> |
| <recurring task> | <exact label, tab, command> |

<One paragraph naming conditional controls and the path that always works.>

## Limits (v1)

- **Scope.** What it deliberately does not do.
- **Storage.** Where state lives, per-machine vs shared, second-machine behavior.
- **Missing surfaces.** No settings pane, flag, or endpoint, and the workaround.
- **Conditional controls.** Which control exists only in some states, plus the reliable path.
- **Best-effort integrations.** What depends on private markup or undocumented endpoints, and what still works.
- **Version support.** Oldest version, warnings on newer ones, what a fix costs.
- **Data lifecycle.** What it never deletes, and where deletion happens.
- **No telemetry.** Only after grepping for it.

## How it runs

One paragraph on the architecture and what the project deliberately does not own.

- <component> in <path>, served/run by <host>.
- <state> in <location>.
- <integration> isolated in <file>.

| Change | Action |
| --- | --- |
| <code surface> | <rebuild / reload / restart> |
| <metadata> | <reload / restart> |

## Development

```sh
<install>
<typecheck>
<build>
```

<Test command and what it does not cover.>

## Contributing

<One paragraph plus links to CONTRIBUTING, CODE_OF_CONDUCT, SECURITY.>

## Decisions

- [ADR 0001: <decision>](docs/adr/0001-<slug>.md)
- [Vocabulary](GLOSSARY.md)
- [Using <project>](docs/using-<project>.md)
- [How <project> works](docs/how-it-works.md)

## Related

- <host or dependency> — <why it matters here>.

## License

<license> © <year> <holder>.
```

## Notes

- Keep the README under roughly 150 lines once filled. Anything longer belongs in `docs/`.
- Every bold label must match a string in the source. Grep before writing it.
- If a section would contain a single sentence, fold it into the section above.

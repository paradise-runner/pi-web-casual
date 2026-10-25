# Dagger CI (1.0 beta)

CI for this repo is a Dagger workspace, not a toolchain matrix. `dagger check`
runs every check in `.dagger/modules/ci/main.dang` in parallel, inside the
engine's containers.

## Run it locally

```bash
dagger check            # everything
dagger check -l         # list checks
dagger check "dag://?check=ci/build"   # one check
```

Results are identical locally, on the self-hosted Mac runner, and on any other
runner, because nothing depends on the host beyond a container runtime.

## How it runs in CI

- Runner: self-hosted macOS machine (`runs-on: [self-hosted, darwin]`), one job
  at a time, started by launchd.
- Dagger CLI: ``~/.local/bin/dagger``, pinned to **v1.0.0-beta.21**.
- Engine: a privileged container managed by the Dagger CLI, with its cache on a
  Docker volume. The cache is shared by every repo this machine builds, so the
  second run of a check is typically 2–6s instead of ~15–20s.
- The workflow does not install any language toolchain: the checks own their
  containers.

## Pinned versions

- `dagger-module.toml` → `engineVersion = "v1.0.0-beta.21"`. Dagger refuses to
  silently mix engine versions; keep this in step with the CLI.
- `dagger.lock` → resolved image/module pins. Refresh with `dagger lock update`.
- To move to a new release: install the new CLI, then
  `dagger lock update 'dagger@m*'` and update `engineVersion` by running
  `dagger module update` (or edit both files and re-run `dagger check`).

## Adding a check

Add a `@check` function to `.dagger/modules/ci/main.dang`:

```dang
  """Fail when X is wrong."""
  pub myCheck: Void @check {
    base.withExec(["npm", "run", "my-script"]).sync
    null
  }
```

`.sync` is what actually executes the container; a non-zero exit fails the
check. Read project files through `source` (already excludes `node_modules`,
`.git`, build output) so unrelated changes do not invalidate the cache.

## Notes / known sharp edges

- Dagger 1.0 is **beta**. `dagger.toml` + `dagger-module.toml` replace 0.x's
  single `dagger.json`, and command names differ (`dagger api call`, not
  `dagger call`).
- A type-level `let` cannot see constructor state; use `pub name: Type! { ... }`
  member functions instead (this is what `base` does).
- `Directory.digest` is not a reliable "did the build change anything" test
  across host↔container; compare with `diff -r` in a container instead.

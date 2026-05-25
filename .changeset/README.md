# Changesets

This folder is managed by the automated release workflow. Changesets are generated from conventional commit messages on every merge to `main`.

## How versioning works

All `@webui-rubric/*` packages are versioned together (fixed versioning), so a single semantic version describes the entire monorepo.

| Commit prefix | Version bump |
|---|---|
| `feat:` | minor |
| `fix:`, `perf:`, `refactor:` | patch |
| `!` suffix or `BREAKING CHANGE:` | major |

## Manual changesets

To add a manual changeset outside the automated flow:

```bash
pnpm changeset
```

See the [Changesets docs](https://github.com/changesets/changesets/blob/main/docs/adding-a-changeset.md) for details.

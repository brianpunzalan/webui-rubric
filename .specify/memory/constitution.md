<!--
SYNC IMPACT REPORT
==================
Version change: (uninitialized template) → 1.0.0
Bump rationale: Initial ratification. Replaces all placeholder tokens with
concrete values; establishes the seven Core Principles, NPM Monorepo
Constraints, Development Workflow & Quality Gates, and Governance section.

Modified principles (template placeholder → final name):
- [PRINCIPLE_1_NAME] → I. Monorepo Library-First
- [PRINCIPLE_2_NAME] → II. Agent-Oriented CLI Interface
- [PRINCIPLE_3_NAME] → III. Test-First (NON-NEGOTIABLE)
- [PRINCIPLE_4_NAME] → IV. Contract & Integration Testing
- [PRINCIPLE_5_NAME] → V. Deterministic Observability
- (added) → VI. Semantic Versioning & Breaking Changes
- (added) → VII. Simplicity & YAGNI

Added sections:
- NPM Monorepo Constraints (formerly [SECTION_2_NAME])
- Development Workflow & Quality Gates (formerly [SECTION_3_NAME])
- Governance (filled)

Removed sections: none

Templates requiring updates:
- .specify/templates/plan-template.md          ✅ no change required (generic Constitution Check gate; principles consumed at runtime)
- .specify/templates/spec-template.md          ✅ no change required (no principle-specific content)
- .specify/templates/tasks-template.md         ✅ no change required (task categories already cover testing, observability, polish)
- .specify/templates/checklist-template.md     ✅ no change required (generic)
- .claude/skills/*                             ✅ no change required (skills are workflow scaffolding, not principle-bound)
- CLAUDE.md                                    ✅ no change required (points to plan for runtime context)

Follow-up TODOs: none
-->

# webui-rubric Constitution

## Core Principles

### I. Monorepo Library-First

Every capability ships as a standalone package inside the NPM workspaces monorepo.
Each package MUST be independently installable, importable, and testable; it
MUST declare an explicit `package.json` with a focused public API surface, and
MUST NOT depend on private internals of sibling packages (only their published
exports). Organizational-only packages (no runtime purpose) are forbidden.

**Rationale**: Evaluator and Generator agents consume our packages as discrete
units; clean library boundaries keep that contract honest and prevent the
monorepo from collapsing into an implicit single application.

### II. Agent-Oriented CLI Interface

Every package that performs evaluation, scoring, or rubric I/O MUST expose its
functionality through a CLI binary in addition to its programmatic API. CLIs
MUST follow the text-in/text-out protocol: input via stdin and/or flags, normal
output to stdout, errors and diagnostics to stderr, non-zero exit codes on
failure. CLIs MUST support `--json` (machine-readable, the default for agent
callers) and a human-readable mode; the JSON schema for every command MUST be
documented and versioned.

**Rationale**: The Evaluator → Generator feedback loop is the primary consumer,
and agents work best against stable, parseable, exit-code-honest interfaces.

### III. Test-First (NON-NEGOTIABLE)

Test-Driven Development is mandatory for all production code paths. The cycle
is: write a failing test (Red) → get explicit user/maintainer approval of the
test list when scope is non-trivial → implement just enough code to pass
(Green) → refactor (Refactor). Code MUST NOT be merged without tests that
fail prior to its implementation, and coverage of new public API surface MUST
be exercised by at least one automated test.

**Rationale**: Rubric scoring drives an automated feedback loop; silent
regressions corrupt every downstream Generator output. Tests are the only
durable contract.

### IV. Contract & Integration Testing

Integration tests are REQUIRED for: (a) every new package that other packages
or external agents call, (b) any change to a published CLI flag, JSON schema,
or rubric format, (c) inter-package communication paths, and (d) any shared
schema used by Evaluator or Generator agents. Contract tests MUST be kept
alongside the package that owns the contract and MUST fail when the contract
changes in a backward-incompatible way without a corresponding version bump.

**Rationale**: A rubric schema or CLI shape change ripples outward to every
agent consumer; contract tests are the firewall.

### V. Deterministic Observability

All evaluation runs MUST emit structured logs (JSON lines on stderr by default)
that include: invocation inputs, rubric identifier and version, deterministic
run identifier, scoring outcome, and timing. Given identical inputs, rubric
version, and configuration, an evaluation MUST produce identical scores; any
non-determinism (e.g., LLM-as-judge calls) MUST be isolated behind an explicit
sampling boundary and the sampling parameters MUST be recorded in the log.

**Rationale**: The Generator improves by reading Evaluator output; without
deterministic, inspectable signals the feedback loop becomes noise.

### VI. Semantic Versioning & Breaking Changes

Every package follows SemVer (MAJOR.MINOR.PATCH). Breaking changes — to public
APIs, CLI flags, exit codes, JSON output schemas, or rubric formats — REQUIRE
a MAJOR bump and a migration note in the package CHANGELOG. Deprecations MUST
ship at least one MINOR release before removal and MUST emit a runtime warning
to stderr during the deprecation window. The constitution itself is versioned
under the same rules (see Governance).

**Rationale**: Agents pin versions; surprise breakage corrupts long-running
evaluation pipelines.

### VII. Simplicity & YAGNI

Start with the smallest design that satisfies the current spec. Speculative
abstractions, configuration knobs without a current consumer, and "future-proof"
indirection layers are forbidden until a second concrete use case exists. When
a Constitution Check flags additional complexity (extra package, extra
abstraction layer, novel dependency), the plan MUST justify it in its
Complexity Tracking table or simplify until no justification is needed.

**Rationale**: Complexity compounds in monorepos; every premature layer is
friction the next contributor (often an agent) must navigate.

## NPM Monorepo Constraints

- The repository MUST use NPM workspaces; all runtime packages live under
  `packages/*` and all internal tooling under `tools/*`.
- Node.js MUST be pinned via `.nvmrc` and `engines.node` in every published
  package's `package.json`; supported range MUST be a current LTS line.
- TypeScript is the implementation language for all packages; `tsconfig` MUST
  enable `strict`, `noUncheckedIndexedAccess`, and `noImplicitOverride`.
- Every package MUST declare its public exports via the `exports` field; deep
  imports into a sibling package's internals are forbidden.
- Rubric schemas MUST be defined in a single shared schema package and
  validated at runtime at every public boundary (CLI input, library entry).
- No package may take a hard dependency on a network service in its default
  code path; network-dependent behavior (e.g., LLM-as-judge) MUST be gated
  behind an explicit adapter that can be swapped for an in-memory fake in
  tests.

## Development Workflow & Quality Gates

- All work happens on feature branches per the project's branch naming policy;
  pushes to `main` are forbidden outside of merge commits from approved PRs.
- Every PR MUST pass, locally and in CI, the full quality gate:
  `lint` → `typecheck` → `test` → `build`. A failing gate blocks merge.
- Every PR description MUST reference the spec, plan, and (if applicable)
  tasks document driving the change, and MUST call out any Constitution
  Check exceptions justified in the plan's Complexity Tracking table.
- Code review by the repository maintainer is required before merge. The
  reviewer MUST verify: tests existed and failed before implementation,
  principles are upheld, public API changes carry version bumps and changelog
  entries, and JSON/CLI contracts are accompanied by contract tests.
- Generated artifacts (build output, coverage reports, lockfile churn from
  unrelated installs) MUST NOT be committed unless the PR's scope is to update
  them.

## Governance

This constitution supersedes any conflicting practice, convention, or ad-hoc
agreement. When a tension arises between this document and another guideline,
this document wins until it is amended.

**Amendment procedure**:
1. Open a PR that modifies `.specify/memory/constitution.md` and any
   downstream templates affected by the change.
2. The PR description MUST state the proposed version bump (MAJOR/MINOR/PATCH)
   and the rationale, and MUST include an updated Sync Impact Report at the
   top of the constitution file.
3. The repository maintainer is the approving authority; their approval and
   merge constitute ratification of the amendment.

**Versioning policy** (constitution itself):
- MAJOR: backward-incompatible governance changes or removal/redefinition of
  a principle.
- MINOR: a new principle or materially expanded section.
- PATCH: clarifications, wording, typo fixes, non-semantic refinements.

**Compliance review**: Every plan generated under `/speckit-plan` MUST run the
Constitution Check gate before Phase 0 and again after Phase 1 design. Every
PR review MUST verify principle compliance and flag any deviation in the
Complexity Tracking table or block the merge. Use the in-repo plan, spec, and
tasks documents for runtime development guidance.

**Version**: 1.0.0 | **Ratified**: 2026-05-22 | **Last Amended**: 2026-05-22

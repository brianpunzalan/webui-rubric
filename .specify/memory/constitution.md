<!--
Sync Impact Report
==================
Version change: 1.0.0 → 1.1.0
Bump rationale: MINOR — two new principles added (IV. Code Commentary
for Intent; V. JSDoc as Standard API Documentation Format). No
backward-incompatible changes to existing principles I–III; principle
II's docstring requirement is clarified (not narrowed) by the new
principle V which specifies JSDoc as the mandated format.

Modified principles:
- II. API Documentation Per Module — clarifying cross-reference added
  to principle V (the docstring format is now explicitly JSDoc).

Added principles:
- IV. Code Commentary for Intent (NON-NEGOTIABLE)
- V. JSDoc as Standard API Documentation Format (NON-NEGOTIABLE)

Added sections:
- (none — Documentation Standards section expanded in place to cover
  the new code-commentary and JSDoc requirements)

Removed sections:
- (none)

Templates requiring updates:
- ✅ .specify/templates/tasks-template.md — Polish phase updated to
  include a JSDoc-coverage task and a code-comments task per the new
  principles IV and V.
- ✅ .specify/templates/plan-template.md — Constitution Check expanded
  to gate principles IV and V at plan time.
- ✅ .specify/templates/spec-template.md — no change required (specs
  remain implementation-agnostic).
- ✅ .specify/templates/checklist-template.md — no change required.
- ⚠ README.md — repository root README does not yet exist; remains a
  carryover follow-up from v1.0.0 under Principle III.

Prior version history:
- v1.0.0 (2026-05-22): Initial ratification. Added principles I–III
  (Documentation Per Feature; API Documentation Per Module; README as
  Project Reference Hub).

Deferred TODOs:
- (none)
-->

# WebUI Rubric Constitution

## Core Principles

### I. Documentation Per Feature (NON-NEGOTIABLE)

Every feature MUST ship with user-facing documentation before it is considered
complete. "Feature" means any unit of work that originates from a
`/speckit-specify` invocation and produces a `specs/NNN-<feature>/` directory.

Required documentation per feature:

- A user-facing guide that explains, in plain language, what the feature does,
  who it is for, when to use it, how to invoke it, and what the expected
  outputs are. The guide MUST live alongside the feature's design artifacts
  (e.g., `specs/NNN-<feature>/quickstart.md` produced by `/speckit-plan`) and
  MUST be cross-linked from the repository root `README.md`.
- A worked example demonstrating the primary user journey end-to-end. If the
  feature has multiple priority-1 user stories, each P1 story MUST have at
  least one worked example.
- A "limitations and known caveats" section listing scope boundaries and
  out-of-scope behaviors so consumers do not form false expectations.

A feature MUST NOT be merged to the default branch until its documentation is
present, builds without broken cross-references, and has been reviewed
alongside the code change.

**Rationale**: Undocumented features become tribal knowledge that decays the
moment the original author moves on. Tying documentation to the feature's
own spec directory keeps it close to the requirements it implements and
makes review/audit trivial.

### II. API Documentation Per Module (NON-NEGOTIABLE)

Every code module that exposes a public interface — CLI command, library
function, network endpoint, configuration schema, output schema, plugin
extension point — MUST publish API reference documentation describing that
interface contract.

Required for every public interface:

- Every public symbol (command, function, type, schema field, flag, option)
  MUST carry an in-source documentation comment describing purpose,
  inputs, outputs, errors, and observable side effects. The required
  format for in-source documentation is **JSDoc**, as specified by
  Principle V.
- A generated or hand-maintained API reference document MUST exist under a
  predictable location (`docs/api/<module>.md` is the default convention)
  and MUST be regenerated or updated in the same change that modifies the
  interface — never in a follow-up commit.
- Breaking changes to any public interface MUST be called out explicitly in
  the API reference and in the change's commit/PR description.

Internal (non-public) modules are exempt from the generated reference
requirement but MUST still carry in-source docstrings on exported symbols.

**Rationale**: API documentation is the contract that downstream
consumers — including the Generator agent that consumes the Evaluator's
JSON — depend on. Drift between code and reference is a silent breakage
vector; co-locating the update with the code change closes that gap.

### III. README as Project Reference Hub (NON-NEGOTIABLE)

The repository root `README.md` MUST exist and MUST serve as the single
navigational entry point for the project. It MUST link out to every other
reference category so that a newcomer can discover the full project surface
from one file.

Required link categories in `README.md` (omit a category only if it is
genuinely empty for the project):

- Documentation: links to user-facing guides per feature.
- Guides: links to end-to-end how-tos and tutorials.
- API References: links to per-module API documentation produced under
  Principle II.
- Examples: links to runnable samples and worked examples produced under
  Principle I.
- Specifications: links to `specs/` directory or to an index of features.
- Constitution: link to this document.
- Contribution guide: link to contributor guidance, if present.

The `README.md` MUST be updated in the same change that introduces a new
document of any of the categories above. Adding a new feature, module, or
guide without adding its link to `README.md` is a documentation defect of
equal severity to a missing API doc.

**Rationale**: Documentation only helps when it is discoverable.
Centralizing discovery in `README.md` prevents the silent fragmentation
that occurs when guides accumulate in unrelated directories with no
common index.

### IV. Code Commentary for Intent (NON-NEGOTIABLE)

Code blocks MUST carry comments that describe the **intent** of the code
and **how it is used**. The requirement targets the WHY and the
contract — not a line-by-line restatement of the WHAT.

Required:

- Every non-trivial code block (function body, conditional branch,
  loop, regex, configuration block, schema definition) MUST be prefixed
  by a short comment stating its intent and, where the call-site is not
  obvious from context, how the block is intended to be used.
- Comments MUST be written in full sentences in English and MUST be
  kept in sync with the code in the same commit; stale comments are
  treated as defects equal in severity to incorrect code.
- "Magic" values (non-obvious constants, thresholds, regular
  expressions, encoded states) MUST carry a comment explaining where
  the value comes from and why it was chosen — e.g., a WCAG contrast
  threshold MUST be commented with the standard it derives from.
- Workarounds, fixes for specific bugs, and code that exists only to
  satisfy an external constraint MUST be commented with the trigger
  (issue ID, ticket, external requirement) and a removal condition.

Prohibited:

- Comments that only restate the immediately adjacent code in
  natural language (e.g., `// increment i` next to `i++`). Comments
  exist to add information that the code does not already convey.
- Commented-out code in committed work; deleted code MUST be deleted,
  not parked behind `//`.

**Rationale**: This project ships an evaluator–generator agent loop
whose correctness depends on a large amount of policy encoded directly
in code (rubric anchors, weight floors, severity thresholds, bias
mitigations). Readers — human or AI — cannot infer the policy from
the syntax alone. Intent comments preserve the reasoning so future
edits do not silently violate the constitution.

### V. JSDoc as Standard API Documentation Format (NON-NEGOTIABLE)

All in-source documentation comments required by Principle II (API
Documentation Per Module) MUST use the **JSDoc** syntax — i.e.,
`/** … */` blocks with standard JSDoc tags — for every module, public
function, class, type/interface, and exported constant in the project.

Required for every public symbol:

- A `/** … */` JSDoc block immediately preceding the declaration.
- A leading summary sentence describing what the symbol does.
- `@param` tags for every parameter with type and description, and
  `@returns` (or `@return`) with type and description for any
  non-void return value.
- `@throws` tags enumerating the error classes the symbol may raise,
  with the conditions that trigger each.
- `@example` block(s) for any non-trivial public API — at minimum
  one example for every public CLI command and every Generator-
  consumed schema producer.
- Module-level JSDoc (`@module` or top-of-file block) MUST describe
  the module's purpose and its place in the system; it MUST also link
  back to the relevant `docs/api/<module>.md` reference produced under
  Principle II.

Additional rules:

- Deprecated symbols MUST carry `@deprecated` with a migration note
  and the version in which removal is planned.
- Where the project uses TypeScript or a typed dialect, the JSDoc
  `@param`/`@returns` types MAY be omitted in favor of the language's
  native type annotations, but the descriptive prose for each
  parameter and return value MUST still be present.
- JSDoc blocks MUST be the source the API reference under `docs/api/`
  is generated or distilled from; the generator/maintainer is free to
  use any tool, but the JSDoc remains the canonical source.

**Rationale**: A single, well-known documentation format makes API
references mechanically extractable, makes IDE and editor tooling
useful out of the box, and removes ambiguity about where a public
symbol's contract is recorded. JSDoc is the most widely supported
in-source documentation format for the JavaScript / TypeScript
ecosystems this CLI is most likely to live in; standardizing on it
keeps the per-module API documentation under Principle II coherent
across the codebase.

## Documentation Standards

The following standards apply to all documentation produced under the three
core principles:

- **Source-of-truth location**: Per-feature docs live under the feature's
  spec directory (`specs/NNN-<feature>/`). API references live under
  `docs/api/`. Guides and tutorials live under `docs/guides/`. Examples live
  under `examples/`. The `README.md` at the repository root indexes them.
- **Format**: Markdown (`.md`) is the default. Diagrams MUST be embeddable
  in Markdown (e.g., Mermaid, SVG, PNG) so the document remains
  self-contained in the repository.
- **Audience signaling**: Every document MUST state its intended audience
  in the first paragraph (e.g., "for end users invoking the CLI", "for
  Generator-agent implementers consuming the evaluator JSON", "for
  contributors extending the rubric").
- **Versioning**: When a document describes a versioned artifact
  (e.g., the rubric definition, the evaluator output schema), the document
  MUST cite the artifact's version and update in lockstep with version
  changes. WCAG transitions (2.2 → 3) and rubric schema bumps MUST trigger
  documentation review.
- **Cross-references**: Use repository-relative links (e.g.,
  `[Quickstart](specs/001-ui-evaluator-cli/quickstart.md)`) rather than
  absolute URLs so links survive forks and mirrors. Broken links are
  blocking defects.
- **Examples**: Code samples in documentation MUST be runnable (or
  clearly marked as illustrative pseudocode) and SHOULD be exercised by
  CI where feasible so they cannot rot silently.
- **In-source documentation format**: All in-source documentation
  comments required by Principles II and V MUST use JSDoc `/** … */`
  blocks with standard JSDoc tags (`@param`, `@returns`, `@throws`,
  `@example`, `@deprecated`, `@module`). See Principle V for the full
  contract.
- **Code commentary**: Intent comments required by Principle IV MUST
  state WHY the block exists or HOW it is used, not WHAT it does
  line-by-line. Magic values, workarounds, and policy-bearing
  thresholds MUST cite their source (standard, ticket, decision).

## Development Workflow & Quality Gates

- **Spec-Kit lifecycle**: Every feature follows
  `/speckit-specify` → `/speckit-plan` → `/speckit-tasks` →
  `/speckit-implement`. The plan-phase Constitution Check MUST verify
  that the three core principles are addressed in the design artifacts
  (feature docs scaffolded, public interfaces enumerated for API
  references, README updates queued).
- **Pull-request gate**: A pull request that adds or modifies a feature,
  module, public interface, or guide MUST include the corresponding
  documentation update in the same PR. Reviewers MUST decline merges
  that introduce undocumented surface area, regardless of code quality.
- **Compliance check**: A repeatable check (manual or automated) MUST
  verify, at minimum:
  - Every `specs/NNN-<feature>/` directory has a feature-level user-facing
    document (e.g., `quickstart.md`) once `/speckit-implement` has run.
  - Every public module under the project source tree has an entry under
    `docs/api/`.
  - The repository root `README.md` exists and links to every directory
    listed in the Documentation Standards section that is non-empty.
  - Every public symbol carries a JSDoc `/** … */` block per Principle V,
    with `@param`, `@returns`, `@throws`, and (where applicable)
    `@example` populated.
  - Every non-trivial code block carries an intent comment per
    Principle IV; magic values and workarounds cite their source.
- **Severity**: Documentation defects under principles I, II, III, IV,
  and V are treated as blocking — equivalent in severity to a failing
  test or a WCAG-AA accessibility regression in the Evaluator CLI's
  rubric.

## Governance

- **Supremacy**: This constitution supersedes ad-hoc development practices.
  When a workflow, command template, or contributor guideline conflicts
  with the constitution, the constitution wins until it is amended.
- **Amendment procedure**: Amendments are proposed via
  `/speckit-constitution` and committed as a documented change. Each
  amendment MUST update the version line and the Sync Impact Report at
  the top of this file, and MUST propagate any consequent changes into
  `.specify/templates/*` in the same change.
- **Versioning policy**: This constitution uses semantic versioning.
  - **MAJOR**: Backward-incompatible governance/principle removal or
    redefinition.
  - **MINOR**: New principle or section added, or materially expanded
    guidance.
  - **PATCH**: Clarifications, wording, or non-semantic refinements.
- **Compliance review**: Reviewers of every pull request MUST confirm
  compliance with principles I, II, III before approving merge. A
  follow-up task is open to add the repository root `README.md`, which
  does not yet exist; until it is created, the project is in a documented
  non-compliant state with respect to Principle III and the next feature
  PR MUST include its creation.
- **Runtime guidance for AI agents**: Agent-facing guidance lives in
  `CLAUDE.md` (and equivalents). Those files MUST point back to this
  constitution and MUST NOT contradict it.

**Version**: 1.1.0 | **Ratified**: 2026-05-22 | **Last Amended**: 2026-05-22

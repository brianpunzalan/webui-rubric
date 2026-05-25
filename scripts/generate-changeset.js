#!/usr/bin/env node
'use strict';

/**
 * Generates a changeset file from conventional commit messages since the last
 * git release tag. Also updates the root CHANGELOG.md.
 *
 * Conventional commit → semver mapping:
 *   breaking change (`!` or BREAKING CHANGE footer) → major
 *   feat: → minor
 *   fix: / perf: / refactor: / everything else → patch
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function run(cmd) {
  return execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
}

function setOutput(name, value) {
  const outputFile = process.env.GITHUB_OUTPUT;
  if (outputFile) {
    fs.appendFileSync(outputFile, `${name}=${value}\n`);
  }
  console.log(`[output] ${name}=${value}`);
}

function abort(reason) {
  console.log(reason);
  setOutput('has_changes', 'false');
  process.exit(0);
}

// ---------------------------------------------------------------------------
// 1. Determine commit range since last release tag
// ---------------------------------------------------------------------------

let lastTag = '';
try {
  lastTag = run('git describe --tags --abbrev=0');
  console.log(`Last release tag: ${lastTag}`);
} catch {
  console.log('No previous release tags — using full commit history');
}

const commitRange = lastTag ? `${lastTag}..HEAD` : 'HEAD';

let rawCommits = '';
try {
  rawCommits = run(`git log "${commitRange}" --pretty=format:"%s|||%h" --no-merges`);
} catch {
  rawCommits = '';
}

const commitLines = rawCommits
  .split('\n')
  .filter(Boolean)
  .filter((line) => {
    const [msg] = line.split('|||');
    // Skip automated release commits to avoid loops
    return !msg.includes('[skip ci]') && !/^chore: release/.test(msg);
  });

if (commitLines.length === 0) {
  abort('No releasable commits found since last release — skipping');
}

console.log(`Found ${commitLines.length} releasable commit(s)`);

// ---------------------------------------------------------------------------
// 2. Classify commits and determine semver bump type
// ---------------------------------------------------------------------------

const BREAKING_RE = /^(\w+)(\(.+\))?!:|BREAKING CHANGE:/;
const FEAT_RE = /^feat(\(.+\))?:/;
const FIX_RE = /^fix(\(.+\))?:/;
const PERF_RE = /^perf(\(.+\))?:/;
const REFACTOR_RE = /^refactor(\(.+\))?:/;
const DOCS_RE = /^docs(\(.+\))?:/;
const CHORE_RE = /^chore(\(.+\))?:/;

let bumpType = 'patch';

const groups = {
  breaking: [],
  feat: [],
  fix: [],
  perf: [],
  refactor: [],
  docs: [],
  chore: [],
  other: [],
};

for (const line of commitLines) {
  const [message, hash] = line.split('|||');
  const entry = `- ${message} (\`${hash}\`)`;

  if (BREAKING_RE.test(message)) {
    bumpType = 'major';
    groups.breaking.push(entry);
  } else if (FEAT_RE.test(message)) {
    if (bumpType !== 'major') bumpType = 'minor';
    groups.feat.push(entry);
  } else if (FIX_RE.test(message)) {
    groups.fix.push(entry);
  } else if (PERF_RE.test(message)) {
    groups.perf.push(entry);
  } else if (REFACTOR_RE.test(message)) {
    groups.refactor.push(entry);
  } else if (DOCS_RE.test(message)) {
    groups.docs.push(entry);
  } else if (CHORE_RE.test(message)) {
    groups.chore.push(entry);
  } else {
    groups.other.push(entry);
  }
}

console.log(`Semver bump type: ${bumpType}`);

// ---------------------------------------------------------------------------
// 3. Build human-readable changelog body
// ---------------------------------------------------------------------------

const SECTION_MAP = [
  ['breaking', '### ⚠ Breaking Changes'],
  ['feat', '### Features'],
  ['fix', '### Bug Fixes'],
  ['perf', '### Performance Improvements'],
  ['refactor', '### Refactors'],
  ['docs', '### Documentation'],
  ['chore', '### Chores'],
  ['other', '### Other Changes'],
];

const bodyParts = [];
for (const [key, heading] of SECTION_MAP) {
  if (groups[key].length > 0) {
    bodyParts.push(`${heading}\n\n${groups[key].join('\n')}`);
  }
}
const changelogBody = bodyParts.join('\n\n');

// ---------------------------------------------------------------------------
// 4. Discover publishable workspace packages
// ---------------------------------------------------------------------------

function findPublishablePackages() {
  const packages = [];
  const workspaceDirs = ['packages'];

  for (const dir of workspaceDirs) {
    if (!fs.existsSync(dir)) continue;

    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;

      const pkgJsonPath = path.join(dir, entry.name, 'package.json');
      if (!fs.existsSync(pkgJsonPath)) continue;

      try {
        const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
        if (!pkg.private && pkg.name) {
          packages.push(pkg.name);
        }
      } catch {
        // skip malformed package.json
      }
    }
  }

  return packages;
}

const publishablePackages = findPublishablePackages();

if (publishablePackages.length === 0) {
  abort('No publishable packages found in workspace — skipping');
}

console.log(`Publishable packages: ${publishablePackages.join(', ')}`);

// ---------------------------------------------------------------------------
// 5. Write changeset file
// ---------------------------------------------------------------------------

const frontmatter = publishablePackages.map((n) => `"${n}": ${bumpType}`).join('\n');
const changesetContent = `---\n${frontmatter}\n---\n\n${changelogBody}\n`;

const changesetId = `auto-${crypto.randomBytes(6).toString('hex')}`;
const changesetPath = path.join('.changeset', `${changesetId}.md`);
fs.mkdirSync('.changeset', { recursive: true });
fs.writeFileSync(changesetPath, changesetContent);

console.log(`Changeset written → ${changesetPath}`);

// ---------------------------------------------------------------------------
// 6. Prepend a new section to root CHANGELOG.md
//    Version placeholder is replaced by update-changelog.js after versioning.
// ---------------------------------------------------------------------------

const today = new Date().toISOString().slice(0, 10);
const changelogPath = 'CHANGELOG.md';

const newSection = `## [Unreleased] - ${today}\n\n${changelogBody}`;

let existing = '';
if (fs.existsSync(changelogPath)) {
  existing = fs.readFileSync(changelogPath, 'utf8');
}

const HEADER =
  '# Changelog\n\nAll notable changes to this project will be documented in this file.\n';

if (existing.startsWith('# Changelog')) {
  // Splice new section in after the header block
  const afterHeader = existing.replace(/^# Changelog\n+[^\n]*\n+/, '');
  fs.writeFileSync(changelogPath, `${HEADER}\n${newSection}\n\n${afterHeader}`);
} else {
  fs.writeFileSync(changelogPath, `${HEADER}\n${newSection}\n`);
}

console.log(`Root CHANGELOG.md updated`);
setOutput('has_changes', 'true');
setOutput('bump_type', bumpType);

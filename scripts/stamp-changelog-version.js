#!/usr/bin/env node
'use strict';

/**
 * Replaces the "[Unreleased]" placeholder in the root CHANGELOG.md with the
 * actual version produced by `changeset version`.
 *
 * Reads the version from the first non-private package found in packages/.
 * All packages share a single version thanks to the `fixed` group in
 * .changeset/config.json.
 */

const fs = require('fs');
const path = require('path');

function findMonorepoVersion() {
  const packagesDir = 'packages';
  if (!fs.existsSync(packagesDir)) return null;

  for (const entry of fs.readdirSync(packagesDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;

    const pkgJsonPath = path.join(packagesDir, entry.name, 'package.json');
    if (!fs.existsSync(pkgJsonPath)) continue;

    try {
      const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
      if (!pkg.private && pkg.version) return pkg.version;
    } catch {
      // continue
    }
  }

  return null;
}

const version = findMonorepoVersion();
if (!version) {
  console.log('No package version found — CHANGELOG.md left unchanged');
  process.exit(0);
}

const changelogPath = 'CHANGELOG.md';
if (!fs.existsSync(changelogPath)) {
  console.log('CHANGELOG.md not found — nothing to stamp');
  process.exit(0);
}

const content = fs.readFileSync(changelogPath, 'utf8');
const stamped = content.replace(/\[Unreleased\]/g, `[${version}]`);
fs.writeFileSync(changelogPath, stamped);

console.log(`CHANGELOG.md stamped with version ${version}`);

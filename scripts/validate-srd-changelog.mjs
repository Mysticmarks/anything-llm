#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const modulePath = fileURLToPath(import.meta.url);
const rootDir = path.resolve(path.dirname(modulePath), '..');
const srdPath = path.join(rootDir, 'docs', 'srd.md');
const changelogPath = path.join(rootDir, 'docs', 'CHANGELOG.md');

function extractFrontMatter(markdown) {
  const match = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/m.exec(markdown);
  if (!match) {
    throw new Error('Document is missing YAML front matter.');
  }
  return { frontMatter: match[1], body: match[2] };
}

function parseSrdVersion(markdown) {
  const { frontMatter } = extractFrontMatter(markdown);
  const versionMatch = /\bversion:\s*([^\n]+)/.exec(frontMatter);
  if (!versionMatch) {
    throw new Error('SRD front matter does not declare a version.');
  }
  const dateMatch = /\blast_updated:\s*([^\n]+)/.exec(frontMatter);
  if (!dateMatch) {
    throw new Error('SRD front matter does not declare last_updated.');
  }
  return { version: versionMatch[1].trim(), lastUpdated: dateMatch[1].trim() };
}

function parseChangelogVersions(frontMatter) {
  const lines = frontMatter.split(/\r?\n/);
  const versions = [];
  let current = null;
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    if (line.startsWith('srd_versions')) continue;
    const versionMatch = /^-\s+version:\s*(.+)$/.exec(line);
    if (versionMatch) {
      if (current) versions.push(current);
      current = { version: versionMatch[1].trim() };
      continue;
    }
    if (!current) continue;
    const dateMatch = /^date:\s*(.+)$/.exec(line);
    if (dateMatch) {
      current.date = dateMatch[1].trim();
      continue;
    }
    const summaryMatch = /^summary:\s*(.+)$/.exec(line);
    if (summaryMatch) {
      current.summary = summaryMatch[1].trim();
    }
  }
  if (current) versions.push(current);
  return versions;
}

function escapeRegExp(input) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function main() {
  const [srd, changelog] = await Promise.all([
    readFile(srdPath, 'utf8'),
    readFile(changelogPath, 'utf8')
  ]);

  const { version, lastUpdated } = parseSrdVersion(srd);
  const { frontMatter: changeFront, body: changeBody } = extractFrontMatter(changelog);
  const versions = parseChangelogVersions(changeFront);

  const matching = versions.find(entry => entry.version === version);
  if (!matching) {
    throw new Error(`CHANGELOG is missing an srd_versions entry for version ${version}.`);
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(matching.date ?? '')) {
    throw new Error(`CHANGELOG entry for version ${version} must include an ISO date.`);
  }

  if (matching.date !== lastUpdated) {
    throw new Error(`SRD last_updated (${lastUpdated}) does not match CHANGELOG date (${matching.date}) for version ${version}.`);
  }

  const headingLine = `## [${version}] - ${matching.date}`;
  const headingIndex = changeBody.indexOf(headingLine);
  if (headingIndex === -1) {
    throw new Error(`CHANGELOG needs a section heading "${headingLine}".`);
  }

  const afterHeading = changeBody.slice(headingIndex + headingLine.length);
  const nextHeadingIndex = afterHeading.indexOf('\n## [');
  const section = nextHeadingIndex === -1 ? afterHeading : afterHeading.slice(0, nextHeadingIndex);
  if (!section.trim()) {
    throw new Error(`Unable to locate detailed section for version ${version} in CHANGELOG.`);
  }

  if (!/###\s+SRD/.test(section)) {
    throw new Error(`CHANGELOG entry for version ${version} must include an "### SRD" subsection.`);
  }

  if (!/###\s+Code Alignment/.test(section)) {
    throw new Error(`CHANGELOG entry for version ${version} must include an "### Code Alignment" subsection.`);
  }

  if (!/-\s+Updated\s+/i.test(section) && !/-\s+Published\s+/i.test(section)) {
    throw new Error(`CHANGELOG entry for version ${version} should describe SRD updates using bullet points.`);
  }

  console.log('✅ SRD change log linkage verified.');
}

main().catch(error => {
  console.error('SRD change log validation failed.');
  console.error(error.message ?? error);
  process.exitCode = 1;
});

#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const modulePath = fileURLToPath(import.meta.url);
const rootDir = path.resolve(path.dirname(modulePath), '..');
const srdPath = path.join(rootDir, 'docs', 'srd.md');

function parseFrontMatter(markdown) {
  const match = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/m.exec(markdown);
  if (!match) {
    throw new Error('SRD must start with YAML front matter.');
  }
  const [, frontMatter, body] = match;
  const data = {};
  for (const line of frontMatter.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('-')) continue;
    const kv = /^([A-Za-z0-9_]+):\s*(.+)$/.exec(trimmed);
    if (kv) {
      data[kv[1]] = kv[2].trim();
    }
  }
  return { data, body };
}

function collectHeadings(body) {
  const headings = new Set();
  const regex = /^#{2,6}\s+(.+)$/gm;
  let match;
  while ((match = regex.exec(body)) !== null) {
    headings.add(match[1].trim());
  }
  return headings;
}

async function main() {
  const markdown = await readFile(srdPath, 'utf8');
  const { data, body } = parseFrontMatter(markdown);

  const requiredFrontMatter = ['version', 'status', 'last_updated'];
  for (const key of requiredFrontMatter) {
    if (!data[key]) {
      throw new Error(`Missing required front matter field: ${key}`);
    }
  }

  if (!/^\d+\.\d+\.\d+$/.test(data.version)) {
    throw new Error(`SRD version must follow semver (x.y.z). Found: ${data.version}`);
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(data.last_updated)) {
    throw new Error(`SRD last_updated must use ISO date format (YYYY-MM-DD). Found: ${data.last_updated}`);
  }

  const headings = collectHeadings(body);
  const requiredHeadings = [
    'Architecture Overview',
    'Data Models',
    'Agent Orchestration',
    'Ingestion Pipelines',
    'UI Flows',
    'Deployment Options',
    'Change-Log Integration'
  ];

  const missing = requiredHeadings.filter(name => !headings.has(name));
  if (missing.length > 0) {
    throw new Error(`SRD is missing required section headings: ${missing.join(', ')}`);
  }

  console.log('✅ SRD structure and metadata look good.');
}

main().catch(error => {
  console.error('SRD validation failed.');
  console.error(error.message ?? error);
  process.exitCode = 1;
});

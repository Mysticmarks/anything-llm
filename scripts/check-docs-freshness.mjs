#!/usr/bin/env node
import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const modulePath = fileURLToPath(import.meta.url);
const rootDir = path.resolve(path.dirname(modulePath), '..');
const docsRoots = [
  'README.md',
  'CONTRIBUTING.md',
  'docs'
];
const ignoreScriptNames = new Set([
  'add',
  'config',
  'create',
  'dlx',
  'global',
  'info',
  'init',
  'install',
  'link',
  'lockfile',
  'login',
  'logout',
  'node',
  'npm',
  'pack',
  'remove',
  'set',
  'upgrade'
]);

function collectMatches(text, regex) {
  const results = new Set();
  let match;
  while ((match = regex.exec(text)) !== null) {
    const [, name] = match;
    if (!name) continue;
    results.add(name.trim());
  }
  return results;
}

async function listMarkdownFiles(entry) {
  const absolute = path.resolve(rootDir, entry);
  const fileStats = await stat(absolute);
  if (fileStats.isDirectory()) {
    const children = await readdir(absolute);
    const nestedResults = await Promise.all(children.map(child => listMarkdownFiles(path.join(entry, child))));
    return nestedResults.flat();
  }
  if (fileStats.isFile() && absolute.endsWith('.md')) {
    return [entry];
  }
  return [];
}

async function gatherDocumentationFiles() {
  const files = await Promise.all(docsRoots.map(listMarkdownFiles));
  return files.flat();
}

async function readPackageScripts() {
  const packageJsonPath = path.join(rootDir, 'package.json');
  const contents = await readFile(packageJsonPath, 'utf8');
  const data = JSON.parse(contents);
  return data.scripts ?? {};
}

async function main() {
  const scripts = await readPackageScripts();
  const documentationFiles = await gatherDocumentationFiles();
  const missing = new Map();

  for (const relativePath of documentationFiles) {
    const absolute = path.join(rootDir, relativePath);
    const text = await readFile(absolute, 'utf8');
    const yarnMatches = collectMatches(text, /yarn\s+([\w:-]+)/g);
    const npmMatches = collectMatches(text, /npm\s+run\s+([\w:-]+)/g);
    const pnpmMatches = collectMatches(text, /pnpm\s+([\w:-]+)/g);
    const referenced = new Set([...yarnMatches, ...npmMatches, ...pnpmMatches]);

    for (const name of referenced) {
      if (ignoreScriptNames.has(name)) continue;
      if (!(name in scripts)) {
        if (!missing.has(name)) {
          missing.set(name, []);
        }
        missing.get(name).push(relativePath);
      }
    }
  }

  if (missing.size > 0) {
    console.error('Documentation references scripts that are not defined in package.json:\n');
    for (const [name, files] of missing) {
      console.error(`- ${name}: ${files.join(', ')}`);
    }
    console.error('\nAdd the script or update the documentation.');
    process.exitCode = 1;
    return;
  }

  console.log('✅ Documentation scripts are in sync with package.json.');
}

main().catch(error => {
  console.error('Failed to validate documentation scripts.');
  console.error(error);
  process.exitCode = 1;
});

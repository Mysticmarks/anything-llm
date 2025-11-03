#!/usr/bin/env node
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const modulePath = fileURLToPath(import.meta.url);
const rootDir = path.resolve(path.dirname(modulePath), '..');
const docRoots = ['README.md', 'CONTRIBUTING.md', 'docs'];

async function collectMarkdownFiles(entry) {
  const absolute = path.resolve(rootDir, entry);
  const entryStat = await stat(absolute);
  if (entryStat.isDirectory()) {
    const children = await readdir(absolute);
    const nested = await Promise.all(children.map(child => collectMarkdownFiles(path.join(entry, child))));
    return nested.flat();
  }
  if (entryStat.isFile() && absolute.endsWith('.md')) {
    return [entry];
  }
  return [];
}

function lintFileContents(relativePath, contents) {
  const issues = [];
  const lines = contents.split(/\r?\n/);
  let inCodeBlock = false;
  let lastHeadingLevel = 0;

  if (!contents.endsWith('\n')) {
    issues.push({ line: lines.length, message: 'File must end with a newline.' });
  }

  lines.forEach((line, index) => {
    const lineNumber = index + 1;
    if (/^```/.test(line.trim())) {
      inCodeBlock = !inCodeBlock;
      return;
    }

    if (inCodeBlock) return;

    if (/\s+$/.test(line)) {
      issues.push({ line: lineNumber, message: 'Trailing whitespace detected.' });
    }

    if (/\t/.test(line)) {
      issues.push({ line: lineNumber, message: 'Tab characters are not allowed; use spaces.' });
    }

    const headingMatch = /^(#+)(\s*)(.*)$/.exec(line);
    if (headingMatch) {
      const [, hashes, space] = headingMatch;
      const level = hashes.length;
      if (space.length === 0 && headingMatch[3].length > 0) {
        issues.push({ line: lineNumber, message: 'Headings must include a space after the # symbols.' });
      }
      if (lastHeadingLevel && level > lastHeadingLevel + 1) {
        issues.push({ line: lineNumber, message: `Heading level jumps from ${lastHeadingLevel} to ${level}.` });
      }
      lastHeadingLevel = level;
    }
  });

  return issues;
}

async function main() {
  const files = (await Promise.all(docRoots.map(collectMarkdownFiles))).flat();
  let hasIssues = false;

  for (const relativePath of files.sort()) {
    const absolute = path.join(rootDir, relativePath);
    const contents = await readFile(absolute, 'utf8');
    const issues = lintFileContents(relativePath, contents);
    if (issues.length > 0) {
      hasIssues = true;
      console.error(`\n✖ ${relativePath}`);
      for (const issue of issues) {
        console.error(`  Line ${issue.line}: ${issue.message}`);
      }
    }
  }

  if (hasIssues) {
    console.error('\nMarkdown linting failed.');
    process.exitCode = 1;
    return;
  }

  console.log('✅ Markdown linting passed.');
}

main().catch(error => {
  console.error('Markdown linting encountered an unexpected error.');
  console.error(error);
  process.exitCode = 1;
});

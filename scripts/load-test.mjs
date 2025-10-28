#!/usr/bin/env node
import { performance } from 'node:perf_hooks';
import fs from 'node:fs/promises';
import path from 'node:path';

const args = process.argv.slice(2);
const options = {
  scenario: 'chat',
  baseUrl: process.env.LOADTEST_BASE_URL || 'http://localhost:3001',
  apiKey: process.env.ANYTHINGLLM_API_KEY || null,
  workspace: process.env.LOADTEST_WORKSPACE || null,
  iterations: 10,
  concurrency: 1,
  message: 'Hello, can you summarize the workspace?',
  file: null,
  output: null,
};

for (let i = 0; i < args.length; i += 1) {
  const [key, value] = args[i].split('=');
  switch (key) {
    case '--scenario':
      options.scenario = value;
      break;
    case '--base-url':
      options.baseUrl = value;
      break;
    case '--api-key':
      options.apiKey = value;
      break;
    case '--workspace':
      options.workspace = value;
      break;
    case '--iterations':
      options.iterations = Number(value);
      break;
    case '--concurrency':
      options.concurrency = Number(value);
      break;
    case '--message':
      options.message = value;
      break;
    case '--file':
      options.file = value;
      break;
    case '--output':
      options.output = value;
      break;
    default:
      break;
  }
}

if (!options.apiKey) {
  console.error('An API key is required via --api-key or ANYTHINGLLM_API_KEY env');
  process.exit(1);
}

if (!options.workspace) {
  console.error('A workspace slug is required via --workspace or LOADTEST_WORKSPACE env');
  process.exit(1);
}

function summaryStatistics(samples) {
  if (!samples.length) return {};
  const sorted = [...samples].sort((a, b) => a - b);
  const percentile = (pct) => {
    if (sorted.length === 1) return sorted[0];
    const idx = (sorted.length - 1) * pct;
    const lower = Math.floor(idx);
    const upper = Math.ceil(idx);
    if (lower === upper) return sorted[lower];
    const weight = idx - lower;
    return sorted[lower] * (1 - weight) + sorted[upper] * weight;
  };
  const total = sorted.reduce((acc, value) => acc + value, 0);
  return {
    count: sorted.length,
    average: total / sorted.length,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    p50: percentile(0.5),
    p95: percentile(0.95),
    p99: percentile(0.99),
  };
}

async function runChatScenario() {
  const url = new URL(`/api/v1/workspace/${options.workspace}/chat`, options.baseUrl).toString();
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      Authorization: `Bearer ${options.apiKey}`,
    },
    body: JSON.stringify({
      message: options.message,
      mode: 'chat',
      attachments: [],
      reset: false,
    }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Chat request failed: ${response.status} ${text}`);
  }
  await response.json();
}

async function runDocumentUploadScenario() {
  if (!options.file) {
    throw new Error('Document scenario requires --file path');
  }
  const buffer = await fs.readFile(path.resolve(options.file));
  const blob = new Blob([buffer]);
  const form = new FormData();
  form.append('file', blob, path.basename(options.file));
  form.append('addToWorkspaces', options.workspace);
  const url = new URL('/api/v1/document/upload', options.baseUrl).toString();
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${options.apiKey}`,
    },
    body: form,
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Upload failed: ${response.status} ${text}`);
  }
  await response.json();
}

async function worker(taskFn, iterations, results) {
  for (let i = 0; i < iterations; i += 1) {
    const start = performance.now();
    await taskFn();
    const end = performance.now();
    results.push(end - start);
  }
}

async function runScenario() {
  const task = options.scenario === 'document' ? runDocumentUploadScenario : runChatScenario;
  const totalIterations = Math.max(1, options.iterations);
  const concurrency = Math.max(1, options.concurrency);
  const perWorker = Math.ceil(totalIterations / concurrency);
  const timings = [];
  const workers = [];
  for (let i = 0; i < concurrency; i += 1) {
    workers.push(worker(task, perWorker, timings));
  }
  await Promise.all(workers);
  return timings.slice(0, totalIterations);
}

(async () => {
  try {
    const samples = await runScenario();
    const stats = summaryStatistics(samples);
    const result = {
      scenario: options.scenario,
      workspace: options.workspace,
      baseUrl: options.baseUrl,
      iterations: options.iterations,
      concurrency: options.concurrency,
      stats,
      samples,
    };
    if (options.output) {
      await fs.writeFile(path.resolve(options.output), JSON.stringify(result, null, 2));
    }
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(error?.message || error);
    process.exit(1);
  }
})();

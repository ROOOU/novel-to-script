#!/usr/bin/env node

const DEFAULT_TIMEOUT_MS = 15_000;
const REQUESTS = [
  { path: '/', method: 'GET' },
  { path: '/sign-in', method: 'GET' },
  { path: '/sign-up', method: 'GET' },
  { path: '/en-US/projects', method: 'GET' },
  { path: '/en-US/billing', method: 'GET' },
  { path: '/api/auth/session', method: 'GET' },
  { path: '/api/generate', method: 'POST' },
  { path: '/api/storyboard', method: 'POST' },
];

function readBaseUrl() {
  const fromArg = process.argv[2]?.trim();
  const fromEnv = process.env.BASE_URL?.trim();
  const raw = fromArg || fromEnv;
  if (!raw) {
    throw new Error('Missing BASE_URL. Usage: BASE_URL=https://example.com node scripts/rollout-smoke.mjs');
  }

  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`Invalid BASE_URL: ${raw}`);
  }

  return url.origin;
}

function escapeMarkdownCell(value) {
  return String(value).replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

function summarizeJson(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) {
    return `array(len=${value.length})`;
  }

  if (typeof value === 'object') {
    const objectValue = value;
    const summary = {};
    const preferredKeys = ['ok', 'error', 'message', 'code', 'status'];
    for (const key of preferredKeys) {
      if (key in objectValue) {
        summary[key] = objectValue[key];
      }
    }
    if ('viewer' in objectValue && typeof objectValue.viewer === 'object' && objectValue.viewer) {
      summary.viewerKeys = Object.keys(objectValue.viewer);
    }
    if (Object.keys(summary).length === 0) {
      summary.keys = Object.keys(objectValue).slice(0, 8);
    }
    return JSON.stringify(summary);
  }

  return JSON.stringify(value);
}

function trimForCell(value, maxLength = 180) {
  if (!value) return '-';
  return value.length > maxLength ? `${value.slice(0, maxLength - 3)}...` : value;
}

async function requestOne(baseUrl, requestConfig) {
  const url = new URL(requestConfig.path, baseUrl).toString();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  const isPost = requestConfig.method.toUpperCase() === 'POST';
  const headers = {
    Accept: 'application/json, text/plain;q=0.9, text/html;q=0.8, */*;q=0.5',
  };
  if (isPost) {
    headers['Content-Type'] = 'application/json';
  }

  try {
    const response = await fetch(url, {
      method: requestConfig.method,
      redirect: 'manual',
      headers,
      body: isPost ? '{}' : undefined,
      signal: controller.signal,
    });

    const location = response.headers.get('location');
    let jsonSummary = '-';
    let parseable = false;
    const contentType = response.headers.get('content-type') || '';

    try {
      const text = await response.text();
      if (text) {
        const maybeJson = JSON.parse(text);
        jsonSummary = summarizeJson(maybeJson);
        parseable = true;
      }
    } catch {
      if (contentType.includes('application/json')) {
        jsonSummary = '(invalid json)';
      }
    }

    return {
      method: requestConfig.method,
      path: requestConfig.path,
      status: response.status,
      location,
      jsonSummary,
      parseable,
    };
  } catch (error) {
    return {
      method: requestConfig.method,
      path: requestConfig.path,
      status: 'ERR',
      location: null,
      jsonSummary: error instanceof Error ? error.message : String(error),
      parseable: false,
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function main() {
  const baseUrl = readBaseUrl();
  const startedAt = new Date().toISOString();
  const results = [];
  for (const requestConfig of REQUESTS) {
    const result = await requestOne(baseUrl, requestConfig);
    results.push(result);
  }

  const markdown = [
    '# Rollout Smoke Report',
    '',
    `- baseUrl: ${baseUrl}`,
    `- requestedAt: ${startedAt}`,
    '',
    '| Method | Path | Status | Location | JSON Summary |',
    '| --- | --- | ---: | --- | --- |',
    ...results.map((result) => {
      return [
        '|',
        escapeMarkdownCell(result.method),
        '|',
        escapeMarkdownCell(result.path),
        '|',
        escapeMarkdownCell(result.status),
        '|',
        escapeMarkdownCell(trimForCell(result.location ?? '-')),
        '|',
        escapeMarkdownCell(trimForCell(result.jsonSummary)),
        '|',
      ].join(' ');
    }),
  ].join('\n');

  process.stdout.write(`${markdown}\n`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

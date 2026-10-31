#!/usr/bin/env node
/**
 * Automated public-transport proximity POC.
 * Downloads the official TD route-stop GeoJSON feeds, matches every campsite in
 * data.js to nearby bus/GMB stops, and writes diagnostics only (no app integration).
 */
import { appendFileSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import {
  buildTransitPoc,
  parseRouteGeoJson,
  renderTransitPocMarkdown,
  validateCampsites,
} from './transit-poc-core.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_OUT_DIR = join(ROOT, '.cache', 'transit-poc');
const MAX_DOWNLOAD_BYTES = 160 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 120_000;
const RETRY_DELAYS_MS = [1000, 3000, 7000];

export const FEEDS = Object.freeze({
  bus: {
    url: 'https://static.data.gov.hk/td/routes-fares-geojson/JSON_BUS.json',
    mode: 'bus',
  },
  gmb: {
    url: 'https://static.data.gov.hk/td/routes-fares-geojson/JSON_GMB.json',
    mode: 'gmb',
  },
});

function parseArgs(argv) {
  const args = { outDir: DEFAULT_OUT_DIR, fixtureDir: null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      args.help = true;
    } else if (arg === '--out-dir') {
      args.outDir = resolve(argv[++i] || '');
    } else if (arg === '--fixture-dir') {
      args.fixtureDir = resolve(argv[++i] || '');
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return args;
}

function printHelp() {
  console.log([
    'Usage: node scripts/transit-poc.mjs [options]',
    '',
    'Options:',
    '  --out-dir <path>      Output directory (default: .cache/transit-poc)',
    '  --fixture-dir <path>  Read JSON_BUS.json and JSON_GMB.json from a local fixture directory',
    '  --help                Show this help',
  ].join('\n'));
}

async function readResponseLimited(response, maxBytes) {
  if (!response.body?.getReader) {
    const text = await response.text();
    if (Buffer.byteLength(text) > maxBytes) throw new Error(`response exceeds ${maxBytes} bytes`);
    return text;
  }

  const reader = response.body.getReader();
  const chunks = [];
  let byteCount = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      byteCount += value.byteLength;
      if (byteCount > maxBytes) {
        await reader.cancel().catch(() => {});
        throw new Error(`response exceeds ${maxBytes} bytes`);
      }
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock?.();
  }
  return Buffer.concat(chunks, byteCount).toString('utf8');
}

export function parseGeoJsonText(text, source) {
  const normalizedText = text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text;
  try {
    return JSON.parse(normalizedText);
  } catch (error) {
    throw new Error(`Invalid JSON from ${source}: ${error.message}`);
  }
}

async function fetchGeoJson(url) {
  let lastError;
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        headers: {
          Accept: 'application/geo+json, application/json;q=0.9, */*;q=0.1',
          'User-Agent': 'hkcamping-transit-poc/1.0 (+https://github.com/playerkousas-rgb/hkcamping)',
        },
        signal: controller.signal,
      });
      if (!response.ok) {
        const retryable = response.status === 429 || response.status >= 500;
        const error = new Error(`HTTP ${response.status} from ${url}`);
        error.retryable = retryable;
        if (!retryable) throw error;
        if (attempt === RETRY_DELAYS_MS.length) throw error;
        lastError = error;
      } else {
        const body = await readResponseLimited(response, MAX_DOWNLOAD_BYTES);
        return parseGeoJsonText(body, url);
      }
    } catch (error) {
      lastError = error;
      if (error.retryable === false || attempt === RETRY_DELAYS_MS.length) break;
    } finally {
      clearTimeout(timeout);
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, RETRY_DELAYS_MS[attempt]));
  }
  throw new Error(`Could not download official feed after retries: ${lastError?.message || url}`);
}

function readFixture(directory, baseName) {
  const candidates = [
    join(directory, baseName),
    join(directory, baseName === 'JSON_BUS.json' ? 'bus.geojson' : 'gmb.geojson'),
  ];
  const path = candidates.find((candidate) => {
    try { readFileSync(candidate); return true; } catch { return false; }
  });
  if (!path) throw new Error(`Missing fixture: expected ${candidates.join(' or ')}`);
  return parseGeoJsonText(readFileSync(path, 'utf8'), path);
}

function loadCampsitesFromDataJs() {
  const dataPath = join(ROOT, 'data.js');
  const sandbox = { window: {} };
  vm.runInNewContext(readFileSync(dataPath, 'utf8'), sandbox, {
    filename: 'data.js',
    timeout: 5000,
  });
  return validateCampsites(sandbox.window.CAMPSITES);
}

function publishSuccessSummary(poc) {
  const coverage = (mode) => [250, 500, 1000, 2000, 5000]
    .map((distance) => poc.summary.coverageWithinMeters[mode][String(distance)])
    .join('/');
  const message = [
    `camps ${poc.quality.processedCampsites}/${poc.quality.expectedCampsites}`,
    `bus ${poc.summary.uniqueBusStopCount} stops/${poc.sources.bus.featureCount} features, coverage 250/500/1000/2000/5000m ${coverage('bus')}`,
    `GMB ${poc.summary.uniqueGmbStopCount} stops/${poc.sources.gmb.featureCount} features, coverage 250/500/1000/2000/5000m ${coverage('gmb')}`,
    `coordinate conflicts ${poc.quality.coordinateConflictCount}`,
    `exact-name matches ${poc.quality.exactNameMatchCount}`,
  ].join('; ');
  console.log(`::notice title=Transit%20POC%20live%20summary::${message}`);

  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (summaryPath) {
    try {
      appendFileSync(summaryPath, `${renderTransitPocMarkdown(poc)}\n`);
    } catch (error) {
      console.error(`Unable to append GitHub summary: ${error.message}`);
    }
  }
}

function writeOutputsAtomically(outDir, poc) {
  mkdirSync(outDir, { recursive: true });
  const outputs = [
    [join(outDir, 'transit-poc.json'), JSON.stringify(poc, null, 2) + '\n'],
    [join(outDir, 'transit-poc-report.md'), renderTransitPocMarkdown(poc)],
  ];
  const tempPaths = [];
  try {
    for (const [path, content] of outputs) {
      const tempPath = `${path}.tmp-${process.pid}`;
      writeFileSync(tempPath, content);
      tempPaths.push([tempPath, path]);
    }
    for (const [tempPath, path] of tempPaths) renameSync(tempPath, path);
  } catch (error) {
    for (const [tempPath] of tempPaths) rmSync(tempPath, { force: true });
    throw error;
  }
}

function writeFailureDiagnostic(outDir, error) {
  const message = String(error?.stack || error?.message || error).replace(/[\r\n]+/g, ' | ');
  try {
    mkdirSync(outDir, { recursive: true });
    const diagnostic = [
      '# Transit POC failed closed',
      '',
      `- Time: ${new Date().toISOString()}`,
      `- Error: ${message}`,
      '- No transit result was written or integrated into the website.',
      '',
    ].join('\n');
    writeFileSync(join(outDir, 'transit-poc-error.md'), diagnostic);
  } catch (writeError) {
    console.error(`Unable to save failure diagnostic: ${writeError.message}`);
  }

  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (summaryPath) {
    const summary = [
      '## Transit POC failed closed',
      '',
      `Error: ${message}`,
      '',
      'No transit result was written or integrated into the website.',
      '',
    ].join('\n');
    try { appendFileSync(summaryPath, summary); } catch (writeError) {
      console.error(`Unable to append GitHub summary: ${writeError.message}`);
    }
  }
  const annotation = String(error?.message || error).replace(/[\r\n]+/g, ' ').slice(0, 500);
  console.error(`::error title=Transit POC failed::${annotation}`);
}

export async function runTransitPoc({ fixtureDir = null, outDir = DEFAULT_OUT_DIR } = {}) {
  const campsites = loadCampsitesFromDataJs();
  console.log(`📍 已載入 ${campsites.length} 個營地座標`);

  const rawFeeds = {};
  for (const [key, feed] of Object.entries(FEEDS)) {
    console.log(`⬇️ 下載官方 ${key === 'gmb' ? 'GMB' : '巴士'} 路線／站點資料…`);
    rawFeeds[key] = fixtureDir
      ? readFixture(fixtureDir, key === 'bus' ? 'JSON_BUS.json' : 'JSON_GMB.json')
      : await fetchGeoJson(feed.url);
  }

  const busFeed = parseRouteGeoJson(rawFeeds.bus, {
    mode: 'bus', sourceUrl: fixtureDir ? 'local fixture: JSON_BUS.json' : FEEDS.bus.url,
  });
  const gmbFeed = parseRouteGeoJson(rawFeeds.gmb, {
    mode: 'gmb', sourceUrl: fixtureDir ? 'local fixture: JSON_GMB.json' : FEEDS.gmb.url,
  });
  const poc = buildTransitPoc({ busFeed, gmbFeed, campsites });
  writeOutputsAtomically(outDir, poc);
  publishSuccessSummary(poc);

  console.log(`✅ 已完成 ${poc.quality.processedCampsites}/${poc.quality.expectedCampsites} 個場地的配對`);
  console.log(`   巴士站 ${poc.summary.uniqueBusStopCount}；專線小巴站 ${poc.summary.uniqueGmbStopCount}`);
  console.log(`   座標衝突 ${poc.quality.coordinateConflictCount}；站名完全相同配對 ${poc.quality.exactNameMatchCount}`);
  console.log(`📝 報告：${join(outDir, 'transit-poc-report.md')}`);
  return poc;
}

if (process.argv[1] && isAbsolute(process.argv[1]) && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let args = { outDir: DEFAULT_OUT_DIR };
  try {
    args = parseArgs(process.argv.slice(2));
    if (args.help) printHelp();
    else await runTransitPoc(args);
  } catch (error) {
    console.error(`❌ Transit POC failed closed: ${error.stack || error.message}`);
    writeFailureDiagnostic(args.outDir || DEFAULT_OUT_DIR, error);
    process.exitCode = 1;
  }
}

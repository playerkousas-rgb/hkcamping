#!/usr/bin/env node
/**
 * Convert a verified transit POC result into the compact, public website snapshot.
 * The output is committed automatically by the transit GitHub Actions workflow.
 */
import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import vm from 'node:vm';
import { createWebsiteTransitSnapshot } from '../lib/transit-snapshot.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_INPUT = join(ROOT, '.cache', 'transit-poc', 'transit-poc.json');
const DEFAULT_OUTPUT = join(ROOT, 'data', 'auto', 'transit.json');

function parseArgs(argv) {
  const args = { input: DEFAULT_INPUT, output: DEFAULT_OUTPUT };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--input') args.input = resolve(argv[++i] || '');
    else if (argv[i] === '--output') args.output = resolve(argv[++i] || '');
    else if (argv[i] === '--help' || argv[i] === '-h') args.help = true;
    else throw new Error(`Unknown argument: ${argv[i]}`);
  }
  return args;
}

function loadCampsites() {
  const sandbox = { window: {} };
  vm.runInNewContext(readFileSync(join(ROOT, 'data.js'), 'utf8'), sandbox, {
    filename: 'data.js',
    timeout: 5000,
  });
  return sandbox.window.CAMPSITES;
}

function writeJsonAtomically(outputPath, value) {
  mkdirSync(dirname(outputPath), { recursive: true });
  const temporaryPath = `${outputPath}.tmp-${process.pid}`;
  try {
    writeFileSync(temporaryPath, `${JSON.stringify(value)}\n`, 'utf8');
    renameSync(temporaryPath, outputPath);
  } catch (error) {
    rmSync(temporaryPath, { force: true });
    throw error;
  }
}

export function publishTransitSnapshot({ input = DEFAULT_INPUT, output = DEFAULT_OUTPUT } = {}) {
  const poc = JSON.parse(readFileSync(input, 'utf8'));
  const snapshot = createWebsiteTransitSnapshot(poc, loadCampsites());
  writeJsonAtomically(output, snapshot);
  return snapshot;
}

function printHelp() {
  console.log([
    'Usage: node scripts/publish-transit.mjs [options]',
    '',
    'Options:',
    '  --input <path>   Verified transit-poc.json (default: .cache/transit-poc/transit-poc.json)',
    '  --output <path>  Website snapshot path (default: data/auto/transit.json)',
    '  --help           Show this help',
  ].join('\n'));
}

const isMain = process.argv[1]
  && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
if (isMain) {
  try {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) printHelp();
    else {
      const snapshot = publishTransitSnapshot(args);
      console.log(`✅ 已發布交通網站快照：${snapshot.campsites.length} 個營地；巴士站 ${snapshot.summary.uniqueBusStopCount} 個；專線小巴站 ${snapshot.summary.uniqueGmbStopCount} 個`);
    }
  } catch (error) {
    console.error(`❌ 交通快照未發布（fail-closed）：${error.message}`);
    process.exitCode = 1;
  }
}

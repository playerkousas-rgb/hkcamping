#!/usr/bin/env node
/**
 * slim-report.mjs — 瘦身報告（S5 / S6 / S7 / S10 / S11）
 *
 * 用嚟答「我哋而家幾重、邊個檔最肥、有冇死重」。
 * 只讀唔改，exit code 0 = 全部在預算內；1 = 超預算（可放 CI）。
 *
 * 用法：node scripts/slim-report.mjs [--ci]
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const KB = (n) => (n / 1024).toFixed(1).padStart(7) + ' KB';
const SKIP = new Set(['.git', 'node_modules', 'dist', '.vercel', '.cache', 'coverage']);

function walk(dir = ROOT, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(e.name)) continue;
    const full = join(dir, e.name);
    if (e.isDirectory()) walk(full, out);
    else out.push(relative(ROOT, full));
  }
  return out;
}

const BUDGET = {
  dataJs: 250 * 1024,        // data.js（前端唯一資料檔）
  distTotal: 1024 * 1024,    // dist/ 4 個檔總和（S7 硬上限 5MB，呢個係我哋自己嘅目標）
  file: 1024 * 1024,         // 單檔（S10）
  repo: 5 * 1024 * 1024,     // Git 工作目錄（唔計 .git）
};

const files = walk();
const rows = files
  .map((f) => {
    const buf = readFileSync(join(ROOT, f));
    return { f, bytes: buf.length, gz: gzipSync(buf).length };
  })
  .sort((a, b) => b.bytes - a.bytes);

console.log('\n=== 瘦身報告（S 系列）===\n');
console.log('最重 10 個檔（gzip 係實際傳輸估算）：');
for (const r of rows.slice(0, 10)) {
  console.log(`  ${KB(r.bytes)}  → ${KB(r.gz)} gz  ${r.f}`);
}

console.log('\ndist/（Vercel 真正部署嘅嘢）：');
let distTotal = 0;
if (existsSync(join(ROOT, 'dist'))) {
  for (const f of readdirSync(join(ROOT, 'dist')).sort()) {
    const buf = readFileSync(join(ROOT, 'dist', f));
    distTotal += buf.length;
    console.log(`  ${KB(buf.length)}  → ${KB(gzipSync(buf).length)} gz  dist/${f}`);
  }
  console.log(`  ${KB(distTotal)}  合計（S7 硬上限 5120 KB，我哋目標 ${BUDGET.distTotal / 1024} KB）`);
} else {
  console.log('  （未有 dist/，跑 npm run build:site）');
}

const repoTotal = rows.reduce((n, r) => n + r.bytes, 0);
const dataJs = rows.find((r) => r.f === 'data.js');
const overFiles = rows.filter((r) => r.bytes >= BUDGET.file);

const problems = [];
if (dataJs && dataJs.bytes > BUDGET.dataJs) {
  problems.push(`data.js ${KB(dataJs.bytes)} > 預算 ${BUDGET.dataJs / 1024} KB`);
}
if (distTotal > BUDGET.distTotal) {
  problems.push(`dist 合計 ${KB(distTotal)} > 預算 ${BUDGET.distTotal / 1024} KB`);
}
if (overFiles.length) {
  problems.push(`單檔 ≥1MB：${overFiles.map((r) => r.f).join(', ')}（S10）`);
}
if (repoTotal > BUDGET.repo) {
  problems.push(`工作目錄 ${KB(repoTotal)} > ${BUDGET.repo / 1024} KB`);
}

// 死重掃描（S5）
const DEAD = /\.(bak|tmp|old|orig|log|zip|tar\.gz|psd|mp4|mov)$/i;
const dead = files.filter((f) => DEAD.test(f));
if (dead.length) problems.push(`死重檔：${dead.join(', ')}（S5）`);

console.log('\n預算：');
console.log(`  data.js        ${KB(dataJs ? dataJs.bytes : 0)}  / ${BUDGET.dataJs / 1024} KB`);
console.log(`  dist 合計      ${KB(distTotal)}  / ${BUDGET.distTotal / 1024} KB`);
console.log(`  工作目錄       ${KB(repoTotal)}  / ${BUDGET.repo / 1024} KB`);
console.log(`  死重檔         ${dead.length} 個`);

if (problems.length) {
  console.log('\n❌ 超預算：');
  for (const p of problems) console.log(`  - ${p}`);
  process.exit(1);
}
console.log('\n✅ 全部在預算內');

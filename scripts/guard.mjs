#!/usr/bin/env node
/**
 * guard.mjs — 本機 + CI 同一條守護檢查（S12 / F14 / G5 / W1 / V1）
 *
 * 對照 playerkousas-rgb/readme 真理倉：
 *   S 瘦身（單檔 <1MB、dist <5MB）／F 防呆（build --check 可執行）
 *   A 安全（零 secret）／W 版權（© SCOUT SYSTEM 頁尾＋meta）／V 雙版號
 *   G Git 衛生（必要檔、workflow、 Conventional 交付）
 *
 * 用法：node scripts/guard.mjs [--ci]
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const results = [];
const ok = (name, detail = '') => results.push({ pass: true, name, detail });
const bad = (name, detail = '') => results.push({ pass: false, name, detail });
const exists = (p) => existsSync(join(ROOT, p));
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

const SKIP_DIRS = new Set(['.git', 'node_modules', 'dist', '.vercel', '.cache', 'coverage']);
function allFiles(dir = ROOT, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) allFiles(full, out);
    else out.push(relative(ROOT, full));
  }
  return out;
}
const files = allFiles();

/* ---------- 1. 必要檔（G1 / 部署合約） ---------- */
const REQUIRED = [
  'README.md', 'AUTOMATION.md', 'GITHUB-SETUP.md', 'HANDOVER-STATUS.md', 'VERSIONS.md',
  'data.csv', 'data.js', 'build-data.mjs', 'build-site.mjs', 'package.json',
  'index.html', 'styles.css', 'app.js',
  '.gitignore', '.vercelignore', 'vercel.json',
  '.github/workflows/sync-data.yml', '.github/workflows/sync-had.yml',
  '.github/workflows/guard.yml', '.github/PULL_REQUEST_TEMPLATE.md',
  'scripts/guard.mjs', 'scripts/smoke.test.mjs',
  'data/auto/weather.json',
];
const missing = REQUIRED.filter((f) => !exists(f));
missing.length ? bad('必要檔案齊全', `缺：${missing.join(', ')}`) : ok('必要檔案齊全', `${REQUIRED.length} 個`);

/* ---------- 2. 雙版號（V1 / V3） ---------- */
let version = null;
try {
  const pkg = JSON.parse(read('package.json'));
  version = pkg.version;
  const html = read('index.html');
  const js = read('app.js');
  const registry = read('VERSIONS.md');
  const htmlVer = html.match(/<meta\s+name="version"\s+content="([^"]+)"/)?.[1];
  const jsVer = js.match(/const\s+APP_VERSION\s*=\s*'([^']+)'/)?.[1];
  const pairs = [['package.json', version], ['index.html <meta version>', htmlVer],
    ['app.js APP_VERSION', jsVer]];
  const mismatch = pairs.filter(([, v]) => v !== version);
  if (mismatch.length) {
    bad('雙版號一致', `唔同步：${mismatch.map(([k, v]) => `${k}=${v}`).join(' / ')}（應為 ${version}）`);
  } else if (!registry.includes(`| ${version} |`)) {
    bad('版本登記表', `VERSIONS.md 冇 | ${version} | 呢列`);
  } else {
    ok('雙版號一致', `v${version}（package / meta / APP_VERSION / VERSIONS.md）`);
  }
} catch (e) {
  bad('雙版號一致', e.message);
}

/* ---------- 3. 版權（W1） ---------- */
const html = exists('index.html') ? read('index.html') : '';
const hasMetaCopyright = /<meta\s+name="copyright"\s+content="[^"]*© SCOUT SYSTEM/.test(html);
const hasFooter = /site-footer[\s\S]*© SCOUT SYSTEM/.test(html);
hasMetaCopyright && hasFooter
  ? ok('© SCOUT SYSTEM 版權', 'meta + 頁尾都有')
  : bad('© SCOUT SYSTEM 版權', `meta=${hasMetaCopyright} footer=${hasFooter}（W1）`);

/* ---------- 4. data.js 同 data.csv 同步（F14 可執行文件） ---------- */
try {
  const out = execFileSync(process.execPath, ['build-data.mjs', '--check'],
    { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  ok('data.js 同步', out.trim().split('\n')[0]);
} catch (e) {
  bad('data.js 同步', (e.stdout || e.message || '').toString().trim());
}

/* ---------- 5. 部署產物（S4 / S6 / S7） ---------- */
try {
  const out = execFileSync(process.execPath, ['build-site.mjs'],
    { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  const expected = ['index.html', 'styles.css', 'app.js', 'data.js'];
  const lack = expected.filter((f) => !exists(join('dist', f)));
  const bytes = expected.reduce((n, f) => n + statSync(join(ROOT, 'dist', f)).size, 0);
  if (lack.length) bad('dist 產物', `缺：${lack.join(', ')}`);
  else if (bytes > 5 * 1024 * 1024) bad('dist 產物', `${(bytes / 1048576).toFixed(2)}MB > 5MB（S7）`);
  else ok('dist 產物', out.trim().split('\n').pop());
} catch (e) {
  bad('dist 產物', (e.stdout || e.message || '').toString().trim());
}

/* ---------- 6. 單檔 <1MB（S10） ---------- */
const oversized = files
  .filter((f) => !f.startsWith('dist/'))
  .map((f) => [f, statSync(join(ROOT, f)).size])
  .filter(([, n]) => n >= 1024 * 1024);
oversized.length
  ? bad('單檔 <1MB', oversized.map(([f, n]) => `${f} ${(n / 1048576).toFixed(2)}MB`).join(', '))
  : ok('單檔 <1MB', `${files.filter((f) => !f.startsWith('dist/')).length} 個檔全部合格`);

/* ---------- 7. 零 secret（A1 / G5） ---------- */
const SECRET_RE = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /\bghp_[A-Za-z0-9]{20,}/,
  /\bgithub_pat_[A-Za-z0-9_]{20,}/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\bsk-[A-Za-z0-9]{24,}/,
  /SUPABASE_SERVICE_ROLE_KEY\s*[:=]\s*['"][^'"]{16,}['"]/,
];
const leaked = [];
for (const f of files) {
  if (f === 'scripts/guard.mjs' || f.startsWith('dist/')) continue; // 自己嘅規則唔算
  let text;
  try { text = read(f); } catch { continue; }
  if (SECRET_RE.some((re) => re.test(text))) leaked.push(f);
}
const envFiles = files.filter((f) => /(^|\/)\.env(\.[^.]+)?$/.test(f) && !f.endsWith('.env.example'));
if (leaked.length || envFiles.length) {
  bad('零 secret', `疑似 secret：${[...leaked, ...envFiles].join(', ')}`);
} else {
  ok('零 secret', `${files.length} 個檔掃過，無 key / .env`);
}

/* ---------- 8. workflow 合約（P0 交付） ---------- */
try {
  const daily = read('.github/workflows/sync-data.yml');
  const monthly = read('.github/workflows/sync-had.yml');
  const guardYml = read('.github/workflows/guard.yml');
  const checks = [
    [daily.includes("cron: '30 16 * * *'"), '每日 cron = 00:30 HKT'],
    [monthly.includes("cron: '15 17 1 * *'"), '每月 cron = 2 號 01:15 HKT'],
    [daily.includes('workflow_dispatch') && monthly.includes('workflow_dispatch'), '兩條都可手動觸發'],
    [daily.includes('contents: write') && monthly.includes('contents: write'), 'contents: write 權限'],
    [monthly.includes('data/auto/had-') && !monthly.includes('git add data.csv'), '月更唔碰 data.csv'],
    [guardYml.includes('scripts/guard.mjs'), 'guard CI 存在'],
  ];
  const failed = checks.filter(([pass]) => !pass).map(([, name]) => name);
  failed.length ? bad('workflow 合約', failed.join('; ')) : ok('workflow 合約', `${checks.length} 項全過`);
} catch (e) {
  bad('workflow 合約', e.message);
}

/* ---------- 總結 ---------- */
console.log('\n=== hkcamping guard ===');
for (const r of results) {
  console.log(`${r.pass ? '✅' : '❌'} ${r.name}${r.detail ? ` — ${r.detail}` : ''}`);
}
const failed = results.filter((r) => !r.pass).length;
console.log(`\n${results.length - failed}/${results.length} 項通過${failed ? `，${failed} 項 FAIL` : '，全部綠'}`);
process.exit(failed ? 1 : 0);

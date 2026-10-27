/**
 * build-site.mjs — Vercel / 正式部署用嘅零依賴 build（S4：只部署最終產物）
 *
 * 1. 先執行 build-data.mjs，確保 data.js 同 data.csv（＋天氣快照）同步
 * 2. 將前端真正需要嘅 4 個檔抄入 dist/，其餘工具／快照／文件一律唔部署
 *
 * 本機預覽唔使跑呢支（根目錄直接開 index.html 或 npm run dev 就得）。
 * 用法：node build-site.mjs
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, copyFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const DIST = join(ROOT, 'dist');
const FILES = ['index.html', 'styles.css', 'app.js', 'data.js'];

execFileSync(process.execPath, [join(ROOT, 'build-data.mjs')], {
  cwd: ROOT,
  stdio: 'inherit',
});

mkdirSync(DIST, { recursive: true });
for (const f of FILES) {
  copyFileSync(join(ROOT, f), join(DIST, f));
}

const bytes = FILES.reduce((sum, f) => sum + statSync(join(DIST, f)).size, 0);
console.log(`✅ dist/ 已產生：${FILES.length} 個檔，${(bytes / 1024).toFixed(1)} KB（S6 上限 5MB）`);

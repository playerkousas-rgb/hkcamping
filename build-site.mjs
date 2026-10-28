/**
 * build-site.mjs — Vercel / 正式部署用嘅零依賴 build（S4：只部署最終產物）
 *
 * 1. 先執行 build-data.mjs，確保 data.js 同 data.csv（＋天氣快照）同步
 * 2. 將前端真正需要嘅檔抄入 dist/（4 個頁面檔 ＋ icons/ ＋ manifest ＋ robots），
 *    其餘工具／快照／文件一律唔部署（S10 瘦身）
 *
 * 本機預覽唔使跑呢支（根目錄直接開 index.html 或 npm run dev 就得）。
 * 用法：node build-site.mjs
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, copyFileSync, statSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const DIST = join(ROOT, 'dist');
const FILES = ['index.html', 'styles.css', 'app.js', 'data.js', 'manifest.webmanifest', 'robots.txt'];
// v1.11.0：App Icon／favicon 全套（iOS 主畫面、Android 安裝、瀏覽器分頁、分享預覽）
const ICON_DIR = 'icons';
const ICON_FILES = readdirSync(join(ROOT, ICON_DIR)).filter((f) => /\.(png|ico|svg)$/i.test(f));

execFileSync(process.execPath, [join(ROOT, 'build-data.mjs')], {
  cwd: ROOT,
  stdio: 'inherit',
});

mkdirSync(DIST, { recursive: true });
for (const f of FILES) {
  copyFileSync(join(ROOT, f), join(DIST, f));
}
mkdirSync(join(DIST, ICON_DIR), { recursive: true });
for (const f of ICON_FILES) {
  copyFileSync(join(ROOT, ICON_DIR, f), join(DIST, ICON_DIR, f));
}

const all = [...FILES, ...ICON_FILES.map((f) => `${ICON_DIR}/${f}`)];
const bytes = all.reduce((sum, f) => sum + statSync(join(DIST, f)).size, 0);
console.log(`✅ dist/ 已產生：${all.length} 個檔（含 ${ICON_FILES.length} 個圖標），${(bytes / 1024).toFixed(1)} KB（S6 上限 5MB）`);

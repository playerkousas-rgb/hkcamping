#!/usr/bin/env node
/**
 * ui-check.mjs — 「一般用戶」角度實測（對照真理倉 docs/17 §1 角度⑥ ＋ STEP 8 人手實測）
 *
 * 檢查項目：
 *   A. 斷網都開到（CDN 攞唔到 Leaflet 都唔可以死）／108 張卡／頁尾 © SCOUT SYSTEM + 版號
 *   B. 私隱模式（localStorage 一掂就 throw）／撳收藏、撳足跡都唔可以死
 *   C. 篩選真係撳得（廁所 32 ／ 旱廁 16 分開、旱廁卡有警示）
 *   D. 手機：viewport／斷點／chip 識換行
 *
 * 用法：
 *   npm i -D jsdom      # 只係測試用，唔會入 dist、唔影響網站
 *   npm run ui
 *
 * 點解唔放入 npm test：jsdom 係 ~5MB devDependency。網站本身零 runtime deps（S1），
 * 唔想為咗一個測試令 Vercel build 每次都裝多幾 MB。想跑先自己裝。
 * 退出碼：0 = 全綠；1 = 有 FAIL；2 = 未裝 jsdom。
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

let jsdom;
try {
  jsdom = (await import('jsdom')).default;
} catch {
  console.error('✗ 未裝 jsdom。先跑：npm i -D jsdom  再跑：npm run ui');
  process.exit(2);
}
const { JSDOM, VirtualConsole, requestInterceptor } = jsdom;

/** 所有 http(s) 一律斷開 → 模擬斷網；file:// 照讀 */
const offline = requestInterceptor(async (request) =>
  /^https?:/i.test(request.url) ? new Response('', { status: 503 }) : undefined);

async function boot({ privateMode = false, onFetch = null } = {}) {
  const caught = [];
  const vc = new VirtualConsole();
  // 只捉「程式真係拋錯」，唔捉資源載入失敗（斷網本來就載唔到 CDN）
  vc.on('jsdomError', (e) => {
    const m = String(e.message || e);
    if (!/Could not load/.test(m)) caught.push(m);
  });
  vc.on('error', (...a) => caught.push(a.join(' ')));
  vc.forwardTo(console, { jsdomErrors: 'none' });

  const dom = await JSDOM.fromFile(path.join(ROOT, 'index.html'), {
    runScripts: 'dangerously',
    resources: { interceptors: [offline] },
    pretendToBeVisual: true,
    virtualConsole: vc,
    beforeParse(win) {
      win.fetch = onFetch ? onFetch : () => Promise.reject(new Error('offline'));
      Object.defineProperty(win.navigator, 'onLine', { get: () => false });
      if (privateMode) {
        Object.defineProperty(win, 'localStorage', {
          get() { throw new win.DOMException('The operation is insecure.', 'SecurityError'); },
        });
      }
    },
  });
  await new Promise((r) => setTimeout(r, 600));
  return { dom, caught };
}

let pass = 0;
let fail = 0;
const ok = (m) => { pass++; console.log(`  ✅ ${m}`); };
const bad = (m) => { fail++; console.log(`  ❌ ${m}`); };
const eq = (got, want, msg) => (got === want ? ok(msg) : bad(`${msg}（實際 ${got}）`));

const VER = (readFileSync(path.join(ROOT, 'package.json'), 'utf8').match(/"version":\s*"([^"]+)"/) || [])[1];

console.log('\n【A】一般用戶 — 斷網都開到、睇到資料、頁尾版權版號');
{
  const { dom, caught } = await boot();
  const d = dom.window.document;
  const cards = d.querySelectorAll('#cardGrid .card');
  eq(cards.length, 108, `卡片渲染 ${cards.length} 張`);

  const footer = d.querySelector('footer')?.textContent || d.body.textContent;
  /© SCOUT SYSTEM/.test(footer) ? ok('頁尾有 © SCOUT SYSTEM') : bad('頁尾冇 © SCOUT SYSTEM');
  footer.includes(VER) ? ok(`頁尾有版號 v${VER}`) : bad(`頁尾冇版號 v${VER}`);

  const badge = d.getElementById('versionBadge')?.textContent?.trim();
  eq(badge, `v${VER}`, `標題徽章 ${badge}`);

  const visit = (d.getElementById('visitCount')?.textContent || '').trim();
  /入站人次/.test(visit) ? ok('入站人次有顯示') : bad('入站人次冇顯示');
  /undefined|NaN/.test(visit) ? bad('入站人次出現 undefined／NaN') : ok('入站人次數字正常');

  d.getElementById('emptyState')?.hidden === true ? ok('「冇結果」提示正確隱藏') : bad('有卡片但空白提示仍然顯示');
  caught.length === 0 ? ok('Console 零 error（CDN 斷開都冇拋錯）')
    : bad(`${caught.length} 個 error：${caught.slice(0, 3).join(' | ')}`);
  dom.window.close();
}

console.log('\n【B】一般用戶 — 私隱模式／無痕（localStorage 一掂就 throw）');
{
  const { dom, caught } = await boot({ privateMode: true });
  const d = dom.window.document;
  eq(d.querySelectorAll('#cardGrid .card').length, 108, '私隱模式照樣渲染全部卡片（app 冇停擺）');

  const fav = d.querySelector('#cardGrid .fav-btn');
  let err = null;
  try { fav?.click(); } catch (e) { err = e.message; }
  !err ? ok('撳「收藏」唔會令 app 死') : bad(`撳「收藏」拋錯：${err}`);
  eq(fav?.textContent?.trim(), '⭐', '收藏狀態有即時更新');

  const foot = d.querySelector('#cardGrid .foot-btn');
  let err2 = null;
  try { foot?.click(); } catch (e) { err2 = e.message; }
  !err2 ? ok('撳「我的足跡」唔會令 app 死') : bad(`撳「我的足跡」拋錯：${err2}`);

  caught.length === 0 ? ok('私隱模式 Console 零 error') : bad(`私隱模式 ${caught.length} 個 error：${caught.slice(0, 3).join(' | ')}`);
  dom.window.close();
}

console.log('\n【C】一般用戶 — 篩選真係撳得（廁所 vs 旱廁）');
{
  const { dom } = await boot();
  const d = dom.window.document;
  const chips = [...d.querySelectorAll('#tagChips .chip')];
  const label = (c) => c.textContent.replace(/\s+/g, ' ').trim();
  const toilet = chips.find((c) => /^廁所/.test(label(c)));
  const pit = chips.find((c) => /^旱廁/.test(label(c)));

  toilet ? ok(`有「${label(toilet)}」chip`) : bad('冇廁所 chip');
  pit ? ok(`有「${label(pit)}」chip（旱廁獨立，冇被合併）`) : bad('冇旱廁 chip — 可能又被合併');

  if (toilet) {
    toilet.click();
    eq(d.querySelectorAll('#cardGrid .card').length, 32, '撳「廁所」只剩沖水廁所');
    toilet.click();
  }
  if (pit) {
    pit.click();
    eq(d.querySelectorAll('#cardGrid .card').length, 16, '撳「旱廁」只剩旱廁');
    /🕳/.test(d.querySelector('#cardGrid .card')?.innerHTML || '') ? ok('旱廁卡有 🕳 警示徽章') : bad('旱廁卡冇警示徽章');
    pit.click();
  }
  dom.window.close();
}

console.log('\n【D】一般用戶 — 手機可讀性');
{
  const html = readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const css = readFileSync(path.join(ROOT, 'styles.css'), 'utf8');
  /<meta name="viewport"[^>]*width=device-width/.test(html) ? ok('有 viewport meta') : bad('冇 viewport meta');
  const mq = (css.match(/@media[^{]*max-width:\s*\d+px/g) || []).length;
  mq > 0 ? ok(`有 ${mq} 個手機斷點`) : bad('冇任何手機斷點');
  /flex-wrap:\s*wrap/.test(css) ? ok('chip 識換行（窄螢幕唔會爆版）') : bad('chip 冇 flex-wrap');
}

console.log('\n【E】一般用戶 — 回報交畀 Scout Admin widget（本站零表單）');
{
  const html = readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const app = readFileSync(path.join(ROOT, 'app.js'), 'utf8');
  const tag = (html.match(/<script[^>]*scout-admin-blue\.vercel\.app\/widget\.js[^>]*>/) || [])[0] || '';
  tag ? ok('已嵌 Scout Admin 統一回報 widget') : bad('未嵌 widget');
  /data-app="營地資料庫"/.test(tag) ? ok('來源標明「營地資料庫」（後台膠囊靠佢分）') : bad('widget 冇 data-app');
  /defer/.test(tag) ? ok('用 defer 載入，唔會阻住頁面') : bad('widget 冇 defer');
  !html.includes('id="reportDialog"') ? ok('冇自寫報料表單（少一套表單，後台好睇啲）') : bad('仲有自寫表單');
  (app.match(/\bfetch\s*\(/g) || []).length === 0 ? ok('app.js 零 fetch（回報由 widget 自己送）') : bad('app.js 仲有 fetch');

  const { dom } = await boot();
  const d = dom.window.document;
  eq(d.querySelectorAll('#cardGrid [data-action="report"]').length, 0, '卡片冇多餘報料掣');
  eq(d.querySelectorAll('#cardGrid .card').length, 108, 'widget 載入失敗都唔影響 108 張卡');
  dom.window.close();
}

console.log(`\n=== 一般用戶角度：${pass} pass / ${fail} fail ===`);
process.exit(fail ? 1 : 0);

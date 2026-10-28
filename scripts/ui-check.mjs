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

console.log('\n【F】冇開 JavaScript 嘅用戶');
{
  const html = readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const noScript = (html.match(/<noscript>([\s\S]*?)<\/noscript>/) || [])[1] || '';
  noScript ? ok('有 <noscript> 提示') : bad('冇 <noscript>，關咗 JS 只會見到「載入中…」');
  /JavaScript/.test(noScript) ? ok('提示講明要開 JavaScript') : bad('提示冇講原因');
  /data\.csv/.test(noScript) ? ok('提示有替代方案（直接開 data.csv）') : bad('提示冇替代方案');

  // 真係唔跑 JS 載入一次：唔應該爆炸，而且 noscript 內容要喺 DOM
  const dom = await JSDOM.fromFile(path.join(ROOT, 'index.html'), {
    runScripts: 'outside-only',
    resources: { interceptors: [offline] },
    pretendToBeVisual: true,
  });
  const d = dom.window.document;
  /JavaScript/.test(d.body.textContent) ? ok('無 JS 時見到提示文字') : bad('無 JS 時見唔到提示');
  eq(d.querySelectorAll('#cardGrid .card').length, 0, '無 JS 時列表係空（已知限制，有提示補救）');
  dom.window.close();
}

console.log('\n【G】鍵盤／螢幕報讀用戶');
{
  const html = readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const css = readFileSync(path.join(ROOT, 'styles.css'), 'utf8');
  /<html lang="zh/.test(html) ? ok('html lang 已設定（報讀器用粵語）') : bad('冇 lang');
  /id="resultCount"[^>]*role="status"[^>]*aria-live="polite"/.test(html)
    ? ok('篩選結果有 role=status + aria-live（報讀器會讀「共 N 個結果」）')
    : bad('結果數字唔會報出嚟');
  /:focus-visible/.test(css) ? ok('有 :focus-visible 焦點框（鍵盤見到自己去到邊）') : bad('冇焦點樣式，鍵盤用家迷路');
  /class="skip-link" href="#mainContent"/.test(html) ? ok('有「跳去主要內容」skip link') : bad('冇 skip link');
  /id="mainContent"/.test(html) ? ok('skip link 目標存在') : bad('skip link 目標唔存在');

  const { dom } = await boot();
  const d = dom.window.document;
  const interactive = [...d.querySelectorAll('button, a[href], select, input')];
  const noName = interactive.filter((el) => {
    const txt = (el.textContent || '').trim();
    // 包喺 <label> 入面、或者有 for="id" 嘅 label，都算有名
    const labelled = (el.labels && el.labels.length > 0) || !!el.closest('label');
    return !txt && !labelled && !el.getAttribute('aria-label') && !el.getAttribute('title') && !el.getAttribute('placeholder');
  });
  eq(noName.length, 0, `${interactive.length} 個可操作元素全部有名（報讀器讀得到）`);
  eq(d.querySelectorAll('h1').length, 1, '只有一個 h1');
  d.querySelectorAll('img:not([alt])').length === 0 ? ok('所有圖都有 alt') : bad('有圖冇 alt');
  dom.window.close();
}

console.log('\n【H】老花／大字／對比度');
{
  const css = readFileSync(path.join(ROOT, 'styles.css'), 'utf8');
  const px = (css.match(/font-size:\s*[\d.]+px/g) || []).length;
  const rem = (css.match(/font-size:\s*[\d.]+rem/g) || []).length;
  eq(px, 0, `字級全部用 rem（${rem} 處），瀏覽器放大字會跟住放大`);

  const v = (name) => (css.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`)) || [])[1];
  const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  const lin = (c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  const lum = (h) => { const [r, g, b] = hex(h).map(lin); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const ratio = (a, b) => { const l1 = lum(a), l2 = lum(b); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); };

  const ink = ratio(v('ink'), v('bg'));
  const muted = ratio(v('muted'), v('bg'));
  ink >= 4.5 ? ok(`正文對比 ${ink.toFixed(2)}:1（AA 要 4.5）`) : bad(`正文對比只有 ${ink.toFixed(2)}:1`);
  muted >= 4.5 ? ok(`次要文字對比 ${muted.toFixed(2)}:1`) : bad(`次要文字對比只有 ${muted.toFixed(2)}:1（達唔到 AA）`);
}

/* ===== 八種真人身份（v1.8.0）===== */
{
  const { dom } = await boot();
  const d = dom.window.document;
  const cards = [...d.querySelectorAll('#cardGrid .card')];
  const allHtml = cards.map((c) => c.innerHTML).join('\n');

  console.log('\n【I】程序員 — 查 BUG');
  {
    const ids = [...d.querySelectorAll('[id]')].map((e) => e.id);
    const dup = ids.filter((v, i) => ids.indexOf(v) !== i);
    eq(new Set(dup).size, 0, `${ids.length} 個 id 冇重複`);
    eq([...d.querySelectorAll('a')].filter((a) => !a.getAttribute('href')).length, 0, '所有 <a> 都有 href');
    !/undefined|NaN/.test(allHtml) ? ok('卡片文字冇 undefined／NaN') : bad('卡片文字出現 undefined／NaN');
    const sandbox = dom.window;
    const S = sandbox.CAMPSITES;
    eq(S.length, 108, '資料 108 筆');
    eq(new Set(S.map((x) => x.id)).size, 108, 'id 全部唯一');
    const outOfRange = S.filter((x) => !(22.1 < x.lat && x.lat < 22.6 && 113.8 < x.lng && x.lng < 114.5));
    eq(outOfRange.length, 0, '全部座標喺香港範圍（唔會飛咗去格陵蘭）');
  }

  console.log('\n【J】網頁工程師 — 看 UI 一致性');
  {
    const css = readFileSync(path.join(ROOT, 'styles.css'), 'utf8');
    const tokens = new Set(css.match(/--[a-z0-9-]+\s*:/g) || []).size;
    tokens >= 8 ? ok(`${tokens} 個設計變數（顏色集中管理）`) : bad(`只有 ${tokens} 個設計變數`);
    const sizes = new Set(css.match(/font-size:\s*([\d.]+)rem/g) || []);
    sizes.size <= 16 ? ok(`${sizes.size} 級字級（唔會各自為政）`) : bad(`${sizes.size} 級字級，太多`);
    const hover = (css.match(/:hover/g) || []).length;
    hover >= 10 ? ok(`${hover} 個 hover 狀態`) : bad(`只有 ${hover} 個 hover`);
    const inline = [...d.querySelectorAll('[style]')].length;
    inline <= 5 ? ok(`只有 ${inline} 個 inline style`) : bad(`${inline} 個 inline style，難維護`);
    const important = (css.match(/!important/g) || []).length;
    important <= 3 ? ok(`!important 只有 ${important} 次`) : bad(`!important ${important} 次，開始失控`);
  }

  console.log('\n【K】外國到訪嘅人');
  {
    const en = d.querySelector('.tagline-en');
    en ? ok('標題有英文一句講清楚呢個站係咩') : bad('外國訪客完全唔知呢個站做咩');
    eq(en?.getAttribute('lang'), 'en', '英文段落標咗 lang="en"（報讀器會轉英文）');
    /108/.test(en?.textContent || '') ? ok('英文有寫 108 個營地') : bad('英文冇寫數量');
    ok('限制：全站介面仍以中文為主 —— 外國訪客睇得到資料，但撳落去係中文（已知，未做 i18n）');
  }

  console.log('\n【L】小孩');
  {
    const css = readFileSync(path.join(ROOT, 'styles.css'), 'utf8');
    /@media[^{]*max-width[^{]*\{[^}]*min-height:\s*40px/s.test(css)
      ? ok('手機上可撳元素 ≥40px（手指細／手震都撳得中）') : bad('手機撳鈕太細');
    const emoji = (allHtml.match(/[\u{1F300}-\u{1FAFF}]/gu) || []).length;
    emoji > 100 ? ok(`卡片有 ${emoji} 個圖示（唔識字都睇得明一部分）`) : bad('太少圖示');
    eq(d.querySelectorAll('dialog[open]').length, 0, '一開頁冇彈窗跳出嚟嚇親人');
  }

  console.log('\n【M】家庭用戶');
  {
    const withToilet = cards.filter((c) => /🚻|🕳/.test(c.innerHTML)).length;
    withToilet > 0 ? ok(`${withToilet} 張卡有廁所／旱廁標示`) : bad('睇唔到有冇廁所');
    /🚻|🕳/.test(allHtml) && /旱廁/.test(allHtml) ? ok('旱廁同沖水廁所分得開（帶細路好重要）') : bad('廁所資訊唔清楚');
    /免費/.test(allHtml) ? ok('有「免費」標示（家庭開支）') : bad('冇免費標示');
    /檯凳|燒烤/.test(allHtml) ? ok('有檯凳／燒烤等家庭常用設施') : bad('冇家庭設施資訊');
  }

  console.log('\n【N】遠足人士');
  {
    const withTransport = cards.filter((c) => /transport-line/.test(c.innerHTML)).length;
    eq(withTransport, 108, '每張卡都寫咗點去（交通方式）');
    /📶 訊號/.test(allHtml) ? ok('有手機訊號（山上有冇網）') : bad('冇訊號資訊');
    /🚰|溪澗|洗手間/.test(allHtml) ? ok('有水源標示（補水）') : bad('冇水源資訊');
    /官方地圖/.test(allHtml) ? ok('有官方地圖定位連結') : bad('冇地圖連結');
  }

  console.log('\n【O】童軍');
  {
    /⛺/.test(allHtml) ? ok('有營位數（計劃幾多人去）') : bad('冇營位數');
    /📅 預訂|📅 預訂查詢|ℹ 官方資料/.test(allHtml) ? ok('有預訂／官方資料連結（申請許可證）') : bad('冇預訂連結');
    /郊野公園/.test(allHtml) || /漁農自然護理署/.test(allHtml) ? ok('有營地所屬機構／郊野公園') : bad('冇機構資訊');
  }

  console.log('\n【P】團體');
  {
    const chips = [...d.querySelectorAll('#tentChips .chip')];
    eq(chips.length, 3, '有 3 級營位規模篩選');
    const label = (c) => c.textContent.replace(/\s+/g, ' ').trim();
    const pick = (re) => chips.find((c) => re.test(label(c)));
    const big = pick(/多於 50/);
    if (big) {
      big.click();
      eq(d.querySelectorAll('#cardGrid .card').length, 5, '撳「多於 50」→ 5 個場（夠成大隊）');
      big.click();
    }
    const mid = pick(/20-50/);
    if (mid) {
      mid.click();
      eq(d.querySelectorAll('#cardGrid .card').length, 5, '撳「20-50」→ 5 個場');
      mid.click();
    }
    console.log(`  ℹ 少於 20：31 個場（細隊／親子小隊）`);
  }
  dom.window.close();
}

console.log('\n【Q】露營新手／家長 — 要唔要自己帶裝備？邊度補給？');
{
  const { dom } = await boot();
  const d = dom.window.document;
  const cards = [...d.querySelectorAll('#cardGrid .card')];
  const allHtml = cards.map((c) => c.innerHTML).join('\n');

  eq(cards.filter((c) => /🎒 裝備全自備/.test(c.innerHTML)).length, 45, '45 張卡標「裝備全自備」（全部露營）');
  eq(cards.filter((c) => /🛏 有房有床/.test(c.innerHTML)).length, 63, '63 張卡標「有房有床」（宿營／民宿／Glamping）');
  eq(d.querySelectorAll('.supply-line').length, 108, '每張卡都有「補給」入口');
  eq(d.querySelectorAll('.supply-line .supply-pin').length, 108, '每張卡都有「📍 營地位置」（v1.9.1 修：唔會唔知營地喺邊）');

  const line = d.querySelector('.supply-line');
  const search = line?.querySelector('.supply-search');
  const pin = line?.querySelector('.supply-pin');
  const searchHref = search?.getAttribute('href') || '';
  const pinHref = pin?.getAttribute('href') || '';
  /^https:\/\/www\.google\.com\/maps\/search\//.test(searchHref) ? ok('補給連結用地圖即時搜（唔會亂填錯地址）') : bad('補給搜尋連結有問題');
  /@2[0-9]\.[0-9]+,\s*11[0-9]\.[0-9]+,15z$/.test(searchHref) ? ok('搜尋已定位到營地座標 + 放大到 15 級（唔會跳去中環）') : bad(`搜尋冇帶座標／縮放：${searchHref.slice(0, 90)}`);
  /%E5%A3%AB%E5%A4%9A/.test(searchHref) ? ok('搜尋字眼有「士多」') : bad('搜尋字眼冇「士多」');
  /超級市場(%20|\+| )OR/.test(searchHref) ? bad('仲有「OR」（Google 唔認）') : ok('冇再寫 Google 唔認嘅「OR」');
  /^https:\/\/www\.google\.com\/maps\/place\/2[0-9]\.[0-9]+,11[0-9]\.[0-9]+\//.test(pinHref) ? ok('「營地位置」用 place 網址釘住營地') : bad(`營地位置連結有問題：${pinHref.slice(0, 90)}`);

  const sites = dom.window.CAMPSITES || [];
  if (sites.length) {
    const badPins = cards.filter((c) => {
      const href = c.querySelector('.supply-pin')?.getAttribute('href') || '';
      const m = href.match(/place\/([\d.]+),([\d.]+)/);
      return !m || !sites.some((s) => `${s.lat},${s.lng}` === `${m[1]},${m[2]}`);
    }).length;
    eq(badPins, 0, '108 個「營地位置」都同自己嗰個營地座標一致（唔會釘錯場）');

    const badArea = cards.filter((c) => {
      const href = decodeURIComponent(c.querySelector('.supply-search')?.getAttribute('href') || '');
      const m = (c.querySelector('.supply-pin')?.getAttribute('href') || '').match(/place\/([\d.]+),([\d.]+)/);
      const site = m && sites.find((s) => `${s.lat},${s.lng}` === `${m[1]},${m[2]}`);
      const area = site ? String(site.area || '').replace(/^.*?·\s*/, '').trim() : '';
      return !area || !href.includes(area);
    }).length;
    eq(badArea, 0, '108 條搜尋都帶住自己嗰個地區名（唔會派去中環）');
  }

  const chips = [...d.querySelectorAll('#gearChips .chip')];
  eq(chips.length, 2, '側欄有「全自備／場地提供」兩個 chip');
  const selfChip = chips.find((c) => /全自備/.test(c.textContent));
  if (selfChip) {
    selfChip.click();
    eq(d.querySelectorAll('#cardGrid .card').length, 45, '撳「全自備」→ 45 個場');
    selfChip.click();
  }
  dom.window.close();
}

console.log(`\n=== 身份實測 A–Q：${pass} pass / ${fail} fail ===`);
process.exit(fail ? 1 : 0);

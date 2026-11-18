import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => readFileSync(join(ROOT, f), 'utf8');

function extractHtmlInitBlock() {
  const html = read('index.html');
  const m = /<script>\s*(initStoreGate\([\s\S]*?\));\s*<\/script>/.exec(html);
  assert.ok(m, 'index.html <head> 必須包含 initStoreGate(...) 啟動區塊');
  return m[1];
}

function makeGateSandbox({
  referrer = '',
  standalone = false,
  navigatorStandalone = false,
  storageThrows = false,
  lang = 'zh-Hant-HK',
  dataLang = '',
  initialSession = {},
} = {}) {
  const sessionMap = new Map(Object.entries(initialSession));
  const timers = [];

  const makeEl = (tag) => {
    const attrs = new Map();
    const el = {
      tagName: String(tag).toUpperCase(),
      id: '',
      className: '',
      textContent: '',
      href: '',
      target: '',
      rel: '',
      hidden: false,
      children: [],
      get firstChild() {
        return this.children[0] || null;
      },
      setAttribute(k, v) {
        attrs.set(k, String(v));
        if (k === 'id') this.id = String(v);
      },
      getAttribute(k) {
        return attrs.has(k) ? attrs.get(k) : null;
      },
      removeAttribute(k) {
        attrs.delete(k);
      },
      appendChild(child) {
        this.children.push(child);
        return child;
      },
      removeChild(child) {
        const idx = this.children.indexOf(child);
        if (idx >= 0) this.children.splice(idx, 1);
        return child;
      },
    };
    return el;
  };

  const htmlEl = makeEl('html');
  if (lang) htmlEl.setAttribute('lang', lang);
  if (dataLang) htmlEl.setAttribute('data-lang', dataLang);
  const headEl = makeEl('head');
  const bodyEl = makeEl('body');
  htmlEl.appendChild(headEl);
  htmlEl.appendChild(bodyEl);

  const findById = (node, id) => {
    if (node.id === id) return node;
    for (const ch of node.children) {
      const hit = findById(ch, id);
      if (hit) return hit;
    }
    return null;
  };
  const collectByTag = (node, tag, out = []) => {
    if (node.tagName === tag.toUpperCase()) out.push(node);
    for (const ch of node.children) collectByTag(ch, tag, out);
    return out;
  };

  const doc = {
    referrer,
    documentElement: htmlEl,
    head: headEl,
    body: bodyEl,
    createElement: makeEl,
    getElementById: (id) => findById(htmlEl, id),
    addEventListener() {},
  };

  const sessionStorage = {
    getItem(k) {
      if (storageThrows) throw new Error('SecurityError');
      return sessionMap.has(k) ? sessionMap.get(k) : null;
    },
    setItem(k, v) {
      if (storageThrows) throw new Error('SecurityError');
      sessionMap.set(k, String(v));
    },
    removeItem(k) {
      if (storageThrows) throw new Error('SecurityError');
      sessionMap.delete(k);
    },
  };

  const win = {
    document: doc,
    navigator: { standalone: navigatorStandalone },
    location: { origin: 'https://hkcamping.vercel.app', href: 'https://hkcamping.vercel.app/', replace() {} },
    matchMedia: (q) => ({ matches: q === '(display-mode: standalone)' && standalone }),
    sessionStorage,
    localStorage: {
      getItem: () => null,
      setItem() {},
      removeItem() {},
    },
    setTimeout(fn, ms) {
      timers.push({ fn, ms });
      return timers.length;
    },
    clearTimeout() {},
    addEventListener() {},
  };
  win.window = win;
  win.self = win;
  win.top = win;
  win.parent = win;
  win.URL = URL;

  const ctx = vm.createContext(win);

  vm.runInContext(read('store_gate_v1.0.js'), ctx, { filename: 'store_gate_v1.0.js' });
  const initExpr = extractHtmlInitBlock();
  const decision = vm.runInContext(initExpr, ctx, { filename: 'index.html#head' });

  return { ctx, win, doc, htmlEl, headEl, bodyEl, sessionMap, timers, collectByTag, decision };
}

test('SG18：ScoutStoreGate.getAppStoreUrl("hkcamping") 回傳正確主站深連結', () => {
  const { win } = makeGateSandbox({ referrer: 'https://scoutappstore.vercel.app/' });
  assert.equal(typeof win.ScoutStoreGate.getAppStoreUrl, 'function');
  assert.equal(
    win.ScoutStoreGate.getAppStoreUrl('hkcamping'),
    'https://scoutappstore.vercel.app/?app=hkcamping'
  );
});

test('SG3／SG5：由 SCOUT APP STORE 進入 → 放行、寫入 session 通行證、同分頁重整繼續放行', () => {
  const first = makeGateSandbox({ referrer: 'https://scoutappstore.vercel.app/?app=hkcamping' });
  assert.equal(first.decision.allowed, true);
  assert.equal(first.decision.matchedPortalId, 'appstore');
  assert.equal(first.sessionMap.get('hkcamping.store_pass'), '1');
  assert.equal(first.htmlEl.getAttribute('data-store-gated'), null);
  assert.equal(first.doc.getElementById('scoutStoreGate'), null);

  const reload = makeGateSandbox({
    referrer: '',
    initialSession: { 'hkcamping.store_pass': '1' },
  });
  assert.equal(reload.decision.allowed, true);
  assert.equal(reload.decision.reason, 'session-pass');
  assert.equal(reload.doc.getElementById('scoutStoreGate'), null);
});

test('SG19：由通告圖書館進入（silentPortalIds: ["library"]）→ 靜默放行且不顯示攔截卡', () => {
  const env = makeGateSandbox({ referrer: 'https://scout-circulars.vercel.app/' });
  assert.equal(env.decision.allowed, true);
  assert.equal(env.decision.matchedPortalId, 'library');
  assert.equal(env.sessionMap.get('hkcamping.store_pass'), '1');
  assert.equal(env.doc.getElementById('scoutStoreGate'), null);
});

test('SG3／SG17／SG19：直打網址或由非 A 組白名單入口進入 → 攔截、隱藏底頁、只顯示 1 粒 APP STORE 掣且不自動秒跳', () => {
  const blockedReferrers = [
    '',
    'https://www.google.com/',
    'https://scoutmember.vercel.app/',
    'https://ecportal-troop.vercel.app/',
    'https://gemini-canvas.vercel.app/',
  ];
  for (const ref of blockedReferrers) {
    const env = makeGateSandbox({ referrer: ref });
    assert.equal(env.decision.allowed, false, `referrer=${ref || '(empty)'} 應被攔截`);
    assert.equal(env.decision.reason, 'missing-whitelist-entry');
    assert.equal(env.htmlEl.getAttribute('data-store-gated'), 'missing-whitelist-entry');

    const styleEl = env.doc.getElementById('scoutStoreGateStyle');
    assert.ok(styleEl, '應注入隱藏底頁樣式 #scoutStoreGateStyle');
    assert.match(styleEl.textContent, /html\[data-store-gated\]\s+body\s*>\s*:not\(#scoutStoreGate\)/);

    const gateOverlay = env.doc.getElementById('scoutStoreGate');
    assert.ok(gateOverlay, '應掛載 #scoutStoreGate 提示卡');
    const links = env.collectByTag(gateOverlay, 'a');
    assert.equal(links.length, 1, 'SG19：提示卡只准顯示 1 粒主站按鈕，唔准顯示圖書館按鈕');
    assert.equal(links[0].href, 'https://scoutappstore.vercel.app/');
    assert.doesNotMatch(links[0].textContent, /^\s*1\./, '單一按鈕唔應該有 1. 編號前綴');
    assert.equal(env.timers.length, 0, 'autoRedirectSeconds: 0 唔可以排程自動秒跳');
  }
});

test('SG2／SG7：已加入主畫面之獨立視窗 PWA（display-mode: standalone 及 iOS navigator.standalone）→ 無 Referer 亦直接放行', () => {
  const androidPwa = makeGateSandbox({ referrer: '', standalone: true });
  assert.equal(androidPwa.decision.allowed, true);
  assert.equal(androidPwa.decision.reason, 'standalone-pwa');
  assert.equal(androidPwa.doc.getElementById('scoutStoreGate'), null);

  const iosPwa = makeGateSandbox({ referrer: '', navigatorStandalone: true });
  assert.equal(iosPwa.decision.allowed, true);
  assert.equal(iosPwa.decision.reason, 'standalone-pwa');
  assert.equal(iosPwa.doc.getElementById('scoutStoreGate'), null);
});

test('私隱／無痕模式（sessionStorage 拋錯）：有合法 Referer 時照樣放行唔崩潰', () => {
  const env = makeGateSandbox({
    referrer: 'https://scoutappstore.vercel.app/',
    storageThrows: true,
  });
  assert.equal(env.decision.allowed, true);
  assert.equal(env.decision.matchedPortalId, 'appstore');
});

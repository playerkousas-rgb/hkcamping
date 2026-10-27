/**
 * smoke.test.mjs — 無瀏覽器嘅前端啟動測試（F14：可執行文件）
 *
 * 用極簡 fake DOM 喺 node vm 入面真實執行 data.js + app.js，
 * 捉 runtime error（例如改天氣列時打錯 id），唔使裝 jsdom。
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

class FakeEl {
  constructor(tag = 'div') {
    this.tagName = String(tag).toUpperCase();
    this.children = [];
    this._html = '';
    this.textContent = '';
    this.hidden = false;
    this.style = {};
    this.attrs = {};
    this.value = '';
    this.classList = {
      add() {}, remove() {}, contains() { return false; }, toggle() { return true; },
    };
  }
  set innerHTML(v) { this._html = String(v); }
  get innerHTML() { return this._html; }
  appendChild(c) { this.children.push(c); return c; }
  replaceChildren(...nodes) { this.children = nodes; }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  getAttribute(k) { return this.attrs[k]; }
  addEventListener() {}
  querySelector() { return new FakeEl(); }
  querySelectorAll() { return []; }
  scrollIntoView() {}
  remove() {}
}

class FakeDoc {
  constructor() { this.els = new Map(); }
  getElementById(id) {
    if (!this.els.has(id)) this.els.set(id, new FakeEl());
    return this.els.get(id);
  }
  createElement(tag) { return new FakeEl(tag); }
}

function boot() {
  const doc = new FakeDoc();
  const store = new Map();
  const localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };
  const sandbox = { console, document: doc, localStorage };
  vm.createContext(sandbox);
  vm.runInContext('var window = globalThis;', sandbox);
  // 刻意唔提供 window.L → 行地圖 fallback 分支
  vm.runInContext(readFileSync(join(ROOT, 'data.js'), 'utf8'), sandbox, { filename: 'data.js' });
  vm.runInContext(readFileSync(join(ROOT, 'app.js'), 'utf8'), sandbox, { filename: 'app.js' });
  return { sandbox, doc };
}

test('data.js 載入 108 筆，前端啟動無例外', () => {
  const { sandbox, doc } = boot();
  assert.equal(sandbox.CAMPSITES.length, 108);
  assert.match(doc.getElementById('resultCount').innerHTML, /共 <b>108<\/b> 個結果/);
  assert.equal(doc.getElementById('cardGrid').children.length, 108);
});

test('雙版號同頁尾版權（V1 / W1）', () => {
  const { doc } = boot();
  assert.equal(doc.getElementById('versionBadge').textContent, 'v1.0.0');
  assert.equal(doc.getElementById('appVersion').textContent, '1.0.0');
});

test('價格 null 顯示面議，唔會當成免費', () => {
  const { sandbox } = boot();
  const nullPrice = sandbox.CAMPSITES.filter((s) => s.price === null);
  assert.ok(nullPrice.length > 0);
  const free = sandbox.CAMPSITES.filter((s) => s.price === 0);
  assert.ok(free.length > 0);
  assert.notDeepEqual(nullPrice[0].price, free[0].price);
});

test('天氣列：嵌入嘅天文台快照會渲染週末 PSR', () => {
  const { sandbox, doc } = boot();
  assert.ok(sandbox.CAMP_WEATHER, 'data.js 應嵌入 window.CAMP_WEATHER');
  assert.ok(Array.isArray(sandbox.CAMP_WEATHER.weekendRainRisk));
  const bar = doc.getElementById('weatherBar');
  assert.equal(bar.hidden, false);
  assert.match(bar.className, /weather-bar psr-(low|mid|high)/);
  const texts = bar.children.map((c) => c.textContent).join(' | ');
  assert.match(texts, /週末天氣/);
  assert.match(texts, /降雨概率/);
  assert.match(texts, /天文台更新/);
  assert.ok(bar.children.length >= 5);
});

test('無天氣快照時天氣列自動隱藏（fail-closed）', () => {
  const doc = new FakeDoc();
  const store = new Map();
  const sandbox = {
    console,
    document: doc,
    localStorage: { getItem: (k) => store.get(k) ?? null, setItem: () => {}, removeItem: () => {} },
  };
  vm.createContext(sandbox);
  vm.runInContext('var window = globalThis;', sandbox);
  vm.runInContext(readFileSync(join(ROOT, 'data.js'), 'utf8'), sandbox, { filename: 'data.js' });
  vm.runInContext('window.CAMP_WEATHER = null;', sandbox);
  vm.runInContext(readFileSync(join(ROOT, 'app.js'), 'utf8'), sandbox, { filename: 'app.js' });
  assert.equal(doc.getElementById('weatherBar').hidden, true);
  assert.match(doc.getElementById('resultCount').innerHTML, /共 <b>108<\/b> 個結果/);
});

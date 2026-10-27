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
  assert.equal(doc.getElementById('versionBadge').textContent, 'v1.2.0');
  assert.equal(doc.getElementById('appVersion').textContent, '1.2.0');
});

test('約數標記：44 筆有銀碼卡片顯示「約」+ 警句，免費／面議唔會', () => {
  const { doc } = boot();
  const cards = doc.getElementById('cardGrid').children;
  const approx = cards.filter((c) => c.innerHTML.includes('約數 · 未逐筆核實'));
  assert.equal(approx.length, 44);
  assert.match(approx[0].innerHTML, /約 \$/);
  const free = cards.filter((c) => c.innerHTML.includes('>免費<'));
  assert.equal(free.length, 41);
  assert.ok(free.every((c) => !c.innerHTML.includes('約數 · 未逐筆核實')));
  const enquiry = cards.filter((c) => c.innerHTML.includes('面議／電話查詢'));
  assert.equal(enquiry.length, 23);
  assert.ok(enquiry.every((c) => !c.innerHTML.includes('約數 · 未逐筆核實')));
});

test('官方 CSDI 水源／營位徽章淨係出現喺 41 筆漁護署營地', () => {
  const { sandbox, doc } = boot();
  const cards = doc.getElementById('cardGrid').children;
  // 用「⛺ 營位」做標記，唔好用 .prep-badge（潮汐站徽章都用緊呢個 class）
  const withBadge = cards.filter((c) => c.innerHTML.includes('⛺ '));
  assert.equal(withBadge.length, 41);
  const seasonal = cards.filter((c) => c.innerHTML.includes('季節性溪澗'));
  assert.equal(seasonal.length, 23);       // CSDI: 23 個季節性水源
  const small = cards.filter((c) => c.innerHTML.includes('假日易滿'));
  assert.equal(small.length, 31);          // CSDI: 31 個少於 20 營位
  const afcd = sandbox.CAMPSITES.filter((x) => x.operator === '漁農自然護理署');
  assert.ok(afcd.every((x) => x.waterSource && x.tentSpace && x.countryPark));
  assert.equal(sandbox.CAMPSITES.filter((x) => x.priceSource === 'estimate').length, 44);
});

test('v1.2.0：該區天氣／潮汐／日出日落公式', () => {
  const { sandbox, doc } = boot();
  const A = sandbox.CAMPSITES;
  // 每個營地都有就近氣象站 + 雨量區
  assert.ok(A.every((x) => x.weatherStation && x.rainDistrict));
  // 75 個沿岸營地有潮汐站（其餘 null）
  assert.equal(A.filter((x) => x.tideStation).length, 75);
  // conditions 快照：18 區雨量、27 站氣溫、8 潮汐站
  const C = sandbox.CAMP_CONDITIONS;
  assert.equal(C.districtWeather.rainfall.length, 18);
  assert.equal(C.districtWeather.temperature.length, 27);
  assert.equal(Object.keys(C.tides.stations).length, 8);
  // 潮汐 seed 抽查（QUB 2026-10-27 應對得上官方 0342/1026/1509/2147）
  const q = C.tides.stations.QUB.days['2026-10-27'];
  assert.equal(q.map((e) => e.time).join(','), '03:42,10:26,15:09,21:47');
  assert.equal(q.map((e) => e.type).join(','), 'L,H,L,H');
  // 日出日落純 JS 公式：對照 HKO 官方 SRS，容許 3 分鐘誤差
  const toMin = (t) => { const [a, b] = t.split(':').map(Number); return a * 60 + b; };
  for (const [d, r, s] of [
    ['2026-01-01', '07:03', '17:51'], ['2026-06-21', '05:39', '19:11'],
    ['2026-10-27', '06:25', '17:49'], ['2026-12-31', '07:02', '17:50'],
  ]) {
    const got = sandbox.__campSunTimes(d);
    assert.ok(Math.abs(toMin(got.rise) - toMin(r)) <= 3, `${d} 日出 ${got.rise} vs ${r}`);
    assert.ok(Math.abs(toMin(got.set) - toMin(s)) <= 3, `${d} 日落 ${got.set} vs ${s}`);
  }
  // 天氣列有日落提示
  assert.match(doc.getElementById('weatherBar').children.map((c) => c.textContent).join(' '), /🌇 日落/);
  // 卡片有「該區天氣」按鈕
  assert.match(doc.getElementById('cardGrid').children[0].innerHTML, /data-action="local"/);
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

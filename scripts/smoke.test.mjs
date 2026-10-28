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

function boot(seed = {}) {
  const doc = new FakeDoc();
  const store = new Map(Object.entries(seed));
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
  return { sandbox, doc, store };
}

test('data.js 載入 108 筆，前端啟動無例外', () => {
  const { sandbox, doc } = boot();
  assert.equal(sandbox.CAMPSITES.length, 108);
  assert.match(doc.getElementById('resultCount').innerHTML, /共 <b>108<\/b> 個結果/);
  assert.equal(doc.getElementById('cardGrid').children.length, 108);
});

test('雙版號同頁尾版權（V1 / W1）', () => {
  const { doc } = boot();
  // 唔寫死版號：以 package.json 為單一真相，每次升版都唔使改 test
  const pkgVersion = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).version;
  assert.equal(doc.getElementById('versionBadge').textContent, `v${pkgVersion}`);
  assert.equal(doc.getElementById('appVersion').textContent, pkgVersion);
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
  // 潮汐：唔鎖死某一日（build 會按快照日期裁走舊日子），改驗結構 + 覆蓋範圍
  const qDays = C.tides.stations.QUB.days;
  const qDates = Object.keys(qDays).sort();
  assert.ok(qDates.length >= 10, `QUB 潮汐日數應 ≥10（現 ${qDates.length}）`);
  for (const d of qDates) {
    assert.match(d, /^\d{4}-\d{2}-\d{2}$/);
    const ev = qDays[d];
    // 一日可以係 1–4 次（潮汐週期有時會啱啱跨出當日）
    assert.ok(ev.length >= 1 && ev.length <= 4, `${d} 高低潮事件數 ${ev.length}`);
    for (const e of ev) {
      assert.match(e.time, /^\d{2}:\d{2}$/, `${d} 時間格式 ${e.time}`);
      assert.ok(Number.isFinite(e.height) && e.height >= -1 && e.height <= 4, `${d} 高度 ${e.height}`);
      assert.ok(e.type === 'H' || e.type === 'L', `${d} 漲退 ${e.type}`);
    }
  }
  // 視窗要覆蓋「今日」（用快照自身日期，唔用 now）
  const anchor = new Date(Date.parse(sandbox.CAMP_CONDITIONS.fetchedAt) + 8 * 3600 * 1000)
    .toISOString().slice(0, 10);
  assert.ok(qDates.includes(anchor), `潮汐涵蓋快照當日 ${anchor}`);
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

test('v1.3.0：官方 OCF 分區預報（對每日同步穩健，唔鎖死某一日官方值）', () => {
  const { sandbox, doc } = boot();
  const A = sandbox.CAMPSITES;
  const O = sandbox.CAMP_OCF;
  assert.equal(Object.keys(O.stations).length, 12);
  assert.ok(O.notes.includes('未經人手修訂'));
  // 108 筆全部配對到有效站
  assert.ok(A.every((x) => x.ocfStation && O.stations[x.ocfStation]));

  // 每站日數：OCF 官方每日出 9–10 日，遇截數可能得 9 日 → 用下限，唔用 == 10
  const days = O.stations.SEK.daily;
  assert.ok(days.length >= 8, `每站至少 8 日預報（現 ${days.length}）`);

  // 日期要係 ISO 而且遞增
  const dates = days.map((d) => d.date);
  assert.ok(dates.every((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)), `日期格式：${dates[0]}`);
  assert.deepEqual([...dates], [...dates].sort(), '日期要遞增');

  // 數值合理性（唔比對官方某一日嘅實數，否則每日 00:30 同步就會爆 CI）
  for (const st of Object.values(O.stations)) {
    for (const d of st.daily) {
      assert.ok(d.rainPct === null || (d.rainPct >= 0 && d.rainPct <= 100),
        `${st.name} ${d.date} 降雨概率 ${d.rainPct}`);
      if (d.max !== null) assert.ok(d.max > -20 && d.max < 60, `${st.name} 最高溫 ${d.max}`);
      if (d.min !== null) assert.ok(d.min > -20 && d.min < 60, `${st.name} 最低溫 ${d.min}`);
      if (d.max !== null && d.min !== null) assert.ok(d.max >= d.min, `${st.name} ${d.date} max<min`);
    }
  }

  // TWN／SKW 官方長期只提供溫度、冇降雨概率 → 要容錯成 null
  assert.ok(O.stations.TWN.daily.every((d) => d.rainPct === null));
  assert.ok(O.stations.SKW.daily.every((d) => d.rainPct === null));

  // 九日時間軸渲染日數 = 最多營地嗰個站嘅日數
  const used = {};
  A.forEach((s) => { used[s.ocfStation] = (used[s.ocfStation] || 0) + 1; });
  const top = Object.keys(used).sort((a, b) => used[b] - used[a])[0];
  const scroll = doc.getElementById('forecastScroll');
  assert.equal(scroll.children.length, O.stations[top].daily.length);
  const first = scroll.children[0].children.map((c) => c.textContent).join('|');
  assert.match(first, /今日/);
  assert.match(first, /🌧/);
  assert.match(first, /🌇/);
  // 地區選擇器有 option
  assert.ok(doc.getElementById('forecastRegion').children.length >= 10);
});

test('v1.4.1：OCF 面板用合成快照渲染（降雨分級／溫度四捨五入／無 PoP 容錯）', () => {
  // 完全確定性嘅測試：唔讀當日官方快照，CI 唔會因為數據更新而紅
  const day = (date, rainPct, rainLabel, weather, max, min) =>
    ({ date, rainPct, rainLabel, weather, max, min });
  const daily = [
    day('2026-01-01', 5, '< 10%', 50, 21.4, 15.6),    // low  → 適合
    day('2026-01-02', 45, '40%', 62, 19.9, 14.4),     // mid  → 帶雨具
    day('2026-01-03', 65, '60%', 63, 18.2, 13.1),     // high → 唔適宜
    day('2026-01-04', null, null, 60, 20, 14),        // 官方無 PoP
  ];
  const stations = {};
  ['TKL', 'TPO', 'SEK', 'SHA', 'TWN', 'LFS', 'TUN', 'CCH', 'SKW', 'HKS', 'JKB', 'HKO']
    .forEach((code, i) => {
      stations[code] = { code, name: `測試站${i}`, daily: daily.map((d) => ({ ...d })) };
    });

  const doc = new FakeDoc();
  const store = new Map();
  const sandbox = {
    console,
    document: doc,
    localStorage: { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: () => {} },
  };
  vm.createContext(sandbox);
  vm.runInContext('var window = globalThis;', sandbox);
  vm.runInContext(readFileSync(join(ROOT, 'data.js'), 'utf8'), sandbox, { filename: 'data.js' });
  vm.runInContext(`window.CAMP_OCF = ${JSON.stringify({
    fetchedAt: new Date().toISOString(), stations, notes: '測試快照（未經人手修訂）',
  })};`, sandbox);
  vm.runInContext(readFileSync(join(ROOT, 'app.js'), 'utf8'), sandbox, { filename: 'app.js' });

  const scroll = doc.getElementById('forecastScroll');
  assert.equal(scroll.children.length, 4, '4 日快照應渲染 4 格');
  const text = (i) => scroll.children[i].children.map((c) => c.textContent).join('|');

  assert.match(text(0), /今日/);
  assert.match(text(0), /< 10%/);
  assert.match(text(0), /21° \/ 16°/, '溫度要四捨五入');
  assert.match(text(0), /適合/);

  assert.match(text(1), /40%/);
  assert.match(text(1), /帶雨具/);

  assert.match(text(2), /60%/);
  assert.match(text(2), /唔適宜/);

  assert.match(text(3), /降雨概率 —/, '官方無 PoP 要顯示 —，唔可以當 0');
  assert.doesNotMatch(text(3), /\b0%/);
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

test('v1.4.0：週末唔落雨排行用 OCF 官方站，按降雨概率升序', () => {
  const { doc } = boot();
  const panel = doc.getElementById('weekendRankPanel');
  assert.equal(panel.hidden, false);
  const rows = doc.getElementById('weekendRankList').children;
  assert.ok(rows.length >= 8, `排行榜應覆蓋 ≥8 個分區站（現 ${rows.length}）`);
  // 每行：名次／站名／降雨％／溫度／營地數／例子
  const pcts = rows.map((r) => Number((r.children[2].textContent.match(/(\d+)%/) || [])[1]));
  assert.ok(pcts.every(Number.isFinite), '每行都要有降雨概率');
  assert.deepEqual(pcts, [...pcts].sort((a, b) => a - b), '要由低至高排');
  assert.match(rows[0].children[4].textContent, /\d+ 個營地/);
  assert.match(doc.getElementById('weekendRankDates').textContent, /本週末 \d{2}\/\d{2}/);
});

test('v1.4.0：我的足跡由 localStorage 讀取，卡片有「去過」徽章', () => {
  const { doc } = boot({
    hkcamp_footprints: JSON.stringify({ a01: { first: '2026-10-01', last: '2026-10-20' } }),
  });
  assert.equal(doc.getElementById('footCount').textContent, 1);
  assert.equal(doc.getElementById('footClear').hidden, false);
  const cards = doc.getElementById('cardGrid').children;
  const visited = cards.filter((c) => c.innerHTML.includes('class="foot-btn on"'));
  assert.equal(visited.length, 1);
  assert.match(visited[0].innerHTML, /👣 去過 · 上次/);
  assert.match(visited[0].innerHTML, /2026-10-20/);
  // 未去過嘅卡片：徽章容器仍然 hidden，唔會顯示
  const notVisited = cards.filter((c) => c.innerHTML.includes('class="foot-btn "'));
  assert.equal(notVisited.length, 107);
  assert.ok(notVisited.every((c) => c.innerHTML.includes('foot-line" hidden')));
});

test('v1.4.0：入站人次喺本機累計，唔會假裝全站數字', () => {
  const { doc } = boot({
    hkcamp_visits: JSON.stringify({ n: 4, first: '2026-10-01', last: '2026-10-26' }),
  });
  const text = doc.getElementById('visitCount').textContent;
  assert.match(text, /你第 5 次到訪/);
  assert.match(text, /首次 2026-10-01/);
  assert.match(text, /本機紀錄/);
});

test('v1.6.0：設施用詞分組 — 燒烤／廁所／攀石等只出一個 chip，數量係聯集', () => {
  const { sandbox, doc } = boot();
  const chips = doc.getElementById('tagChips').children;
  const names = chips.map((c) => c.innerHTML.split(' <')[0]);

  // 真．同義詞唔可以再獨立成 chip
  for (const legacy of ['燒烤', '燒烤爐', '燒烤場', '攀石牆', '攀岩牆', '攀石場', '停車場', '草坪']) {
    assert.ok(!names.includes(legacy), `「${legacy}」唔應該再獨立成 chip`);
  }
  // 但實質唔同嘅一定要分開（v1.6.1）
  for (const keep of ['旱廁', '獨立浴室', '中央廚房', '熱水淋浴']) {
    assert.ok(names.includes(keep), `「${keep}」必須保持獨立 chip，唔准合併`);
  }

  const A = sandbox.CAMPSITES;
  const members = {
    '燒烤設施': ['燒烤', '燒烤爐', '燒烤場'],
    '廁所': ['廁所'],                       // 只計沖水廁所，旱廁另計
    '攀石': ['攀石牆', '攀岩牆', '攀石場'],
    '繩網': ['繩網', '繩網陣', '挑戰網陣'],
  };
  for (const [group, group_members] of Object.entries(members)) {
    const chip = chips.find((c) => c.innerHTML.startsWith(group));
    assert.ok(chip, `要有「${group}」chip`);
    const expect = A.filter((s) =>
      [...s.facilities, ...s.tags].some((t) => group_members.includes(t))).length;
    const got = Number((chip.innerHTML.match(/chip-count">(\d+)/) || [])[1]);
    assert.equal(got, expect, `${group} 數量應為同義詞聯集 ${expect}（現 ${got}）`);
  }
});

test('v1.6.0：交通用詞只有「港鐵」，冇「地鐵／東鐵」', () => {
  const { sandbox } = boot();
  const bad = sandbox.CAMPSITES.filter((s) =>
    s.transport.some((t) => ['地鐵', '東鐵', '西鐵', '馬鐵', '輕鐵'].includes(t)));
  assert.equal(bad.length, 0, `舊稱：${bad.map((s) => `${s.id} ${s.name}`).join('、')}`);
  assert.ok(sandbox.CAMPSITES.some((s) => s.transport.includes('港鐵')));
});

test('v1.6.0：康文署 6 筆連 SmartPLAY 同自己場地頁，唔再全部同一個萬能連結', () => {
  const { sandbox } = boot();
  const lcsd = sandbox.CAMPSITES.filter((s) => s.id.startsWith('l'));
  assert.equal(lcsd.length, 6);
  for (const s of lcsd) {
    assert.ok(s.bookingUrl.includes('smartplay.lcsd.gov.hk'), `${s.id} bookingUrl 應為 SmartPLAY`);
    assert.ok(!s.bookingUrl.includes('/clpss/'), `${s.id} 唔應該用舊 CLPSS`);
    assert.match(s.infoUrl, /lcsd\.gov\.hk\/tc\/(camp|campsites|watersport)\//, `${s.id} infoUrl 要指向自己場地`);
  }
  // 每個場地頁唔應該完全一樣
  const uniqInfo = new Set(lcsd.map((s) => s.infoUrl));
  assert.equal(uniqInfo.size, lcsd.length, '6 個場地要有 6 個唔同嘅官方頁');
});


test('v1.6.1：旱廁同沖水廁所分開 — 篩選獨立、數量正確、卡片有警告徽章', () => {
  const { sandbox, doc } = boot();
  const A = sandbox.CAMPSITES;
  const chips = doc.getElementById('tagChips').children;
  const chipCount = (label) => {
    const c = chips.find((x) => x.innerHTML.startsWith(label + ' '));
    return c ? Number((c.innerHTML.match(/chip-count">(\d+)/) || [])[1]) : null;
  };

  const dry = A.filter((s) => s.facilities.includes('旱廁'));
  const flush = A.filter((s) => s.facilities.includes('廁所'));
  assert.equal(dry.length, 16, '旱廁應為 16 筆');
  assert.equal(flush.length, 32, '沖水廁所應為 32 筆');
  assert.equal(A.filter((s) => s.facilities.includes('旱廁') && s.facilities.includes('廁所')).length, 0,
    '冇營地可以同時係旱廁同沖水廁所');

  assert.equal(chipCount('廁所'), 32, '「廁所」chip 只可以計沖水廁所');
  assert.equal(chipCount('旱廁'), 16, '「旱廁」要係獨立 chip');

  // 卡片：旱廁要有警告樣式，沖水廁所係普通樣式
  const cards = doc.getElementById('cardGrid').children;
  const dryCards = cards.filter((c) => c.innerHTML.includes('🕳 旱廁（無沖水）'));
  const flushCards = cards.filter((c) => c.innerHTML.includes('🚻 沖水廁所'));
  assert.equal(dryCards.length, 16);
  assert.equal(flushCards.length, 32);
  assert.match(dryCards[0].innerHTML, /prep-badge warn" title="旱廁/);
  assert.ok(!flushCards.some((c) => c.innerHTML.includes('旱廁')));
});

test('v1.6.1：獨立浴室（民宿私人）同浴室（營地公用）分開', () => {
  const { sandbox, doc } = boot();
  const A = sandbox.CAMPSITES;
  const chips = doc.getElementById('tagChips').children;
  const names = chips.map((c) => c.innerHTML.split(' <')[0]);
  assert.ok(names.includes('浴室'));
  assert.ok(names.includes('獨立浴室'));
  assert.equal(A.filter((s) => s.facilities.includes('浴室')).length, 1);
  assert.equal(A.filter((s) => s.facilities.includes('獨立浴室')).length, 5);
  // 民宿嘅私人浴室唔應該被當成營地公用浴室
  assert.ok(A.filter((s) => s.facilities.includes('獨立浴室'))
    .every((s) => s.type === '民宿'));
});

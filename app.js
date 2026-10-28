/* ===== 香港營地資料庫 — 前端邏輯 ===== */
(function () {
  'use strict';

  const SITES = Array.isArray(window.CAMPSITES) ? window.CAMPSITES : [];
  // 雙版號：package.json / index.html meta / 本常數 / VERSIONS.md 四處要同步（V1）
  const APP_VERSION = '1.7.0';

  /* ---------- 報料表單（v1.7.0）----------
   * 貼上 Google Apps Script Web App 嘅 /exec 網址；**留空＝整個功能隱藏**，
   * 未部署都唔會出一個撳完冇反應嘅死撳鈕（F：防呆）。
   * 部署步驟見 apps-script/report-form/README.md。
   *
   * 安全性：呢個網址本身就係公開嘅（任何人都 POST 得），所以：
   *   - 唔可以當 secret，前端亦冇任何 key（A 系列）
   *   - 所有驗證喺 GAS 側再做一次（長度、類型白名單、honeypot、限流）
   *   - 用原生 <form method="POST" target="_blank">，唔用 fetch → 冇 CORS 問題、
   *     斷網／JS 出錯都有瀏覽器自己嘅錯誤頁，唔會靜靜死咗
   */
  const REPORT_ENDPOINT = '';

  const TYPE_META = {
    '露營': { color: '#2e7d32', short: '露' },
    'Glamping': { color: '#ef6c00', short: 'G' },
    '宿營': { color: '#1565c0', short: '宿' },
    '民宿': { color: '#6a1b9a', short: '民' },
  };
  const SIGNAL_ORDER = ['良好', '一般', '微弱', '無'];

  /* ---------- 設施／特色用詞分組（v1.6.0）----------
   * 問題：資料層同一樣嘢有幾個寫法（燒烤／燒烤爐／燒烤場、廁所／旱廁、攀石牆／攀岩牆／攀石場…），
   * 側欄就會出幾個 chip，用戶撳「燒烤爐」見唔到有「燒烤場」嘅營地 → 以為資料矛盾。
   * 做法：**資料層保留官方精確用詞**（卡片照顯示「旱廁」等實情），
   *       **篩選層收斂成一個 chip**，count 同配對都用全部同義詞。
   */
  const FACILITY_GROUPS = {
    // 只合併「真正同一樣嘢」；有實質差別嘅一律唔准合併（見下方 NO_MERGE）。
    '燒烤設施': ['燒烤', '燒烤爐', '燒烤場'],
    '廁所': ['廁所', '洗手間'],            // 沖水廁所（屋企式）
    '停車位': ['停車位', '停車場'],
    '廚房': ['廚房', '自助廚房'],          // 可以自己煮嘢食
    '泳池': ['泳池', '室外泳池'],
    '攀石': ['攀石牆', '攀岩牆', '攀石場'],
    '草地': ['草地', '草坪', '營地草坪'],
    '繩網': ['繩網', '繩網陣', '挑戰網陣'],
    '球場': ['球場', '籃球場', '足球場'],
  };
  /* 唔准同任何嘢合併嘅設施：實質差別好大，合併就會誤導。
   * 旱廁 = 得個窿／無沖水；廁所 = 沖水。獨立浴室 = 民宿屋內私人浴室；浴室 = 營地公用。
   * 中央廚房 = 通常職員／到會用，未必畀營友自己煮。熱水淋浴 = 有熱水沖涼（同浴室兩件事）。 */
  const NO_MERGE = ['旱廁', '獨立浴室', '中央廚房', '熱水淋浴', '淋浴'];
  const GROUP_OF = {};
  Object.entries(FACILITY_GROUPS).forEach(([group, members]) => {
    members.forEach((m) => { GROUP_OF[m] = group; });
  });
  // 任何設施／標籤 → 篩選層嘅代表詞（唔在分組表就原樣返回）
  const canonTag = (t) => GROUP_OF[t] || t;
  const FAV_KEY = 'hkcamp_favourites';
  const FOOT_KEY = 'hkcamp_footprints';   // 我的足跡：{ id: { first, last } }
  const VISIT_KEY = 'hkcamp_visits';      // 入站人次（本機累計）

  // 通訊辦郊野公園流動網絡覆蓋層（地理資訊地圖）— 政府宣傳「通訊準備夠 郊遊安全樂悠悠」嘅查詢入口
  const OFCA_COVERAGE_URL = 'https://www.map.gov.hk/gm/map/search/faci/__OFCA_MOBILE?lg=tc';
  // 地理資訊地圖座標深鏈（政府官方地圖，營地位置一按即達）
  const geoInfoUrl = (s) => `https://www.map.gov.hk/gm/geo:${s.lat},${s.lng}?lg=tc`;

  /* ---------- 日出日落（純 JS 天文公式，NOAA/SunCalc；HKT） ----------
   * 已用 HKO 官方 SRS 2026 五個錨點驗證，最大誤差 3 分鐘。
   * 零 API、任何年份都用得、file:// 都用得。
   */
  const RAD = Math.PI / 180;
  const DAY_MS = 86400000, J1970 = 2440588, J2000 = 2451545, J0 = 0.0009;
  const OBLIQ = RAD * 23.4397;
  const toJulian = (ms) => ms / DAY_MS - 0.5 + J1970;
  const fromJulian = (j) => (j + 0.5 - J1970) * DAY_MS;
  const toDays = (ms) => toJulian(ms) - J2000;
  const solarMeanAnomaly = (d) => RAD * (357.5291 + 0.98560028 * d);
  const eclipticLongitude = (M) => {
    const C = RAD * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M));
    return M + C + RAD * 102.9372 + Math.PI;
  };
  const declination = (L) => Math.asin(Math.sin(OBLIQ) * Math.sin(L));
  const julianCycle = (d, lw) => Math.round(d - J0 - lw / (2 * Math.PI));
  const approxTransit = (Ht, lw, n) => J0 + (Ht + lw) / (2 * Math.PI) + n;
  const solarTransitJ = (ds, M, L) => J2000 + ds + 0.0053 * Math.sin(M) - 0.0069 * Math.sin(2 * L);
  const hourAngle = (h, phi, dec) =>
    Math.acos((Math.sin(h) - Math.sin(phi) * Math.sin(dec)) / (Math.cos(phi) * Math.cos(dec)));

  function sunTimesHKT(dateStr, lat = 22.3, lng = 114.2) {
    const parts = String(dateStr || '').split('-').map(Number);
    if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return null;
    const [y, m, d] = parts;
    const lw = RAD * -lng, phi = RAD * lat, h0 = RAD * -0.833;
    const n = julianCycle(toDays(Date.UTC(y, m - 1, d)), lw);
    const ds = approxTransit(0, lw, n);
    const M = solarMeanAnomaly(ds);
    const L = eclipticLongitude(M);
    const dec = declination(L);
    const Jnoon = solarTransitJ(ds, M, L);
    const Jset = solarTransitJ(approxTransit(hourAngle(h0, phi, dec), lw, n), M, L);
    const Jrise = Jnoon - (Jset - Jnoon);
    const fmt = (ms) => {
      const dt = new Date(ms + 8 * 3600000);
      return `${String(dt.getUTCHours()).padStart(2, '0')}:${String(dt.getUTCMinutes()).padStart(2, '0')}`;
    };
    return { rise: fmt(fromJulian(Jrise)), set: fmt(fromJulian(Jset)) };
  }
  // 畀 smoke test 用（唔影響 UI）
  window.__campSunTimes = sunTimesHKT;

  const todayHK = () => {
    const d = new Date(Date.now() + 8 * 3600000);
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
  };
  const hkDateFromCompact = (s) => {
    const v = String(s || '');
    return v.length === 8 ? `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}` : v;
  };

  /* ---------- OCF 自動分區九日預報（ocf-forecast.json，由 build-data.mjs 嵌入） ---------- */
  const OCF = (window.CAMP_OCF && typeof window.CAMP_OCF === 'object') ? window.CAMP_OCF : null;
  const WEEKDAY_SHORT = ['日', '一', '二', '三', '四', '五', '六'];

  // HKO OCF 天氣圖標 → 中文描述 + emoji（官方 help_e.html 圖標定義）
  const OCF_WEATHER = {
    50: ['☀️', '天晴'], 51: ['🌤', '大致天晴'], 52: ['⛅', '部分時間有陽光'],
    53: ['🌦', '有幾陣驟雨'], 54: ['🌧', '間中有驟雨'], 60: ['☁️', '多雲'],
    62: ['🌧', '微雨'], 63: ['🌧', '中雨或大雨'], 80: ['🌦', '局部地區驟雨'],
    70: ['🌙', '天晴（夜）'], 74: ['🌙', '大致天晴（夜）'],
  };
  const ocfWeather = (code) => OCF_WEATHER[code] || ['🌡', '天氣未詳'];
  const rainClass = (pct) => pct === null ? 'na' : pct >= 60 ? 'high' : pct >= 40 ? 'mid' : 'low';
  const fmtForecastDay = (iso) => {
    const [y, m, d] = iso.split('-').map(Number);
    const wd = WEEKDAY_SHORT[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
    return { md: `${m}/${d}`, wd: `星期${wd}` };
  };

  function ocfDaily(site, dateStr) {
    if (!OCF || !site || !site.ocfStation) return null;
    const st = OCF.stations?.[site.ocfStation];
    if (!st) return null;
    return {
      station: st.name,
      code: site.ocfStation,
      day: (st.daily || []).find((d) => d.date === dateStr) || null,
    };
  }

  /* ---------- 週末（下一個星期六＋星期日）----------
   * 只用 OCF 快照實際有嘅日期，避免「預測咗一日官方未出」。
   * 今日係星期日就當今日；否則取下一個星期六（今日星期六就係今日）。
   */
  const addDays = (iso, n) => {
    const [y, m, d] = iso.split('-').map(Number);
    const t = new Date(Date.UTC(y, m - 1, d) + n * 86400000);
    return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}`;
  };
  const dowOf = (iso) => {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  };
  function ocfDates() {
    if (!OCF || !OCF.stations) return [];
    return [...new Set(Object.values(OCF.stations)
      .flatMap((st) => (st.daily || []).map((d) => d.date)))].sort();
  }
  function weekendDates() {
    const dates = ocfDates();
    if (!dates.length) return [];
    const today = todayHK();
    const todayDow = dowOf(today);
    let sat = today;
    if (todayDow !== 6 && todayDow !== 0) sat = addDays(today, 6 - todayDow);
    if (todayDow === 0) return dates.includes(today) ? [today] : [];
    const sun = addDays(sat, 1);
    const out = [sat, sun].filter((d) => dates.includes(d));
    return out.length ? out : dates.filter((d) => d >= today && dowOf(d) === 6).slice(0, 1);
  }
  const WEEKEND = weekendDates();
  const WEEKEND_LABEL = WEEKEND.length
    ? WEEKEND.map((d) => `${d.slice(5, 7)}/${d.slice(8, 10)}`).join('–')
    : '';

  // 某個 OCF 站喺週末嘅最高降雨概率（官方冇提供就 null，唔會當 0）
  function stationWeekendRain(code) {
    if (!OCF || !code || !WEEKEND.length) return null;
    const st = OCF.stations?.[code];
    if (!st) return null;
    const vals = WEEKEND
      .map((date) => (st.daily || []).find((d) => d.date === date)?.rainPct)
      .filter((v) => typeof v === 'number');
    return vals.length ? Math.max(...vals) : null;
  }
  const siteWeekendRain = (site) => stationWeekendRain(site && site.ocfStation);

  /* ---------- 該區天氣 + 潮汐（conditions.json，由 build-data.mjs 嵌入） ---------- */
  const CONDITIONS = (window.CAMP_CONDITIONS && typeof window.CAMP_CONDITIONS === 'object')
    ? window.CAMP_CONDITIONS : null;
  const TIDE_STATION_NAMES = {
    QUB: '鰂魚涌', KLW: '高流灣', TPK: '大埔滘', CCH: '長洲',
    SPW: '石壁', TAO: '大澳', CLK: '赤鱲角東', TBT: '尖鼻咀',
  };

  function districtReading(site) {
    if (!CONDITIONS || !CONDITIONS.districtWeather) return null;
    const dw = CONDITIONS.districtWeather;
    const temp = (dw.temperature || []).find((x) => x.station === site.weatherStation);
    const rain = (dw.rainfall || []).find((x) => x.district === site.rainDistrict);
    return {
      station: site.weatherStation || '—',
      tempC: temp ? temp.c : null,
      rainMm: rain ? rain.mm : null,
      rainDistrict: site.rainDistrict || '—',
      updateTime: dw.updateTime || CONDITIONS.fetchedAt,
    };
  }

  function tideReading(site, dateStr) {
    if (!CONDITIONS || !CONDITIONS.tides || !site.tideStation) return null;
    const st = CONDITIONS.tides.stations?.[site.tideStation];
    const events = st?.days?.[dateStr];
    if (!events || !events.length) return null;
    return { code: site.tideStation, name: st.name || TIDE_STATION_NAMES[site.tideStation], events };
  }

  function isStale(iso, maxHours = 3) {
    const t = Date.parse(iso || '');
    return !Number.isFinite(t) || Date.now() - t > maxHours * 3600 * 1000;
  }

  /* ---------- 天氣（天文台快照，由 build-data.mjs 嵌入 data.js） ---------- */
  // 來源：data/auto/weather.json（每日 GitHub Actions 更新）。冇快照就自動隱藏天氣功能。
  const WEATHER = (window.CAMP_WEATHER && typeof window.CAMP_WEATHER === 'object')
    ? window.CAMP_WEATHER : null;
  const PSR_RANK = { '低': 1, '中': 2, '高': 3 };

  function weekendForecast() {
    if (!WEATHER) return [];
    const risk = Array.isArray(WEATHER.weekendRainRisk) ? WEATHER.weekendRainRisk : [];
    const days = risk.length
      ? risk
      : (Array.isArray(WEATHER.forecast) ? WEATHER.forecast : [])
          .filter((d) => d.week === '星期六' || d.week === '星期日');
    return days.slice(0, 4);
  }

  const psrLevel = (days) =>
    days.reduce((max, d) => Math.max(max, PSR_RANK[d.psr] || 0), 0);

  const WEEKEND_DAYS = weekendForecast();
  const WEEKEND_LEVEL = psrLevel(WEEKEND_DAYS);
  const WEEKEND_PSR_CLASS =
    WEEKEND_LEVEL >= 3 ? 'psr-high' : WEEKEND_LEVEL === 2 ? 'psr-mid' : WEEKEND_LEVEL === 1 ? 'psr-low' : '';
  const WEEKEND_PSR_TEXT =
    WEEKEND_LEVEL >= 3 ? '高' : WEEKEND_LEVEL === 2 ? '中' : WEEKEND_LEVEL === 1 ? '低' : '不詳';

  /* ---------- 狀態 ---------- */
  const state = {
    types: new Set(),
    districts: new Set(),
    transports: new Set(),
    tags: new Set(),
    signals: new Set(),
    freeOnly: false,
    maxPrice: 1500,
    query: '',
    sort: 'default',
    favOnly: false,
    footOnly: false,
    mapVisible: true,
  };

  const readJson = (key, fallback) => {
    try {
      const v = JSON.parse(localStorage.getItem(key) || 'null');
      return v == null ? fallback : v;
    } catch { return fallback; }
  };

  const savedFavs = readJson(FAV_KEY, []);
  const favs = new Set(Array.isArray(savedFavs) ? savedFavs.filter((id) => typeof id === 'string') : []);
  // 私隱模式／無痕視窗會令 setItem 直接拋錯；拋咗就會連個撳鈕都死，所以一定要包。
  const saveFavs = () => {
    try { localStorage.setItem(FAV_KEY, JSON.stringify([...favs])); } catch { /* 私隱模式：收藏只留喺記憶體 */ }
  };

  // 我的足跡：只記低「去過邊個營地 + 第一次／最後一次日期」，全部留喺瀏覽器。
  const footprints = (() => {
    const raw = readJson(FOOT_KEY, {});
    const out = {};
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
    Object.entries(raw).forEach(([id, v]) => {
      if (!v || typeof v !== 'object') return;
      const first = String(v.first || v.last || '');
      const last = String(v.last || v.first || '');
      if (!first && !last) return;
      out[id] = { first, last };
    });
    return out;
  })();
  const saveFootprints = () => {
    try { localStorage.setItem(FOOT_KEY, JSON.stringify(footprints)); } catch { /* 私隱模式 */ }
  };
  const footCount = () => Object.keys(footprints).length;

  /* ---------- 資料衍生選項 ---------- */
  const uniq = (arr) => [...new Set(arr)].filter(Boolean);
  const districts = uniq(SITES.map((s) => s.district));
  const transports = uniq(SITES.flatMap((s) => s.transport));
  // 篩選層用代表詞（燒烤爐／燒烤場 → 燒烤設施），排序後再顯示
  const allTags = uniq(SITES.flatMap((s) => [...s.facilities, ...s.tags]).map(canonTag));
  const signals = SIGNAL_ORDER.filter((sig) => SITES.some((s) => s.signal === sig));
  const types = Object.keys(TYPE_META).filter((t) => SITES.some((s) => s.type === t));

  /* ---------- 篩選 ---------- */
  function matches(s, skipGroup) {
    if (skipGroup !== 'type' && state.types.size && !state.types.has(s.type)) return false;
    if (skipGroup !== 'district' && state.districts.size && !state.districts.has(s.district)) return false;
    if (skipGroup !== 'transport' && state.transports.size &&
        !s.transport.some((t) => state.transports.has(t))) return false;
    if (skipGroup !== 'tag' && state.tags.size &&
        ![...s.facilities, ...s.tags].map(canonTag).some((t) => state.tags.has(t))) return false;
    if (skipGroup !== 'signal' && state.signals.size && !state.signals.has(s.signal)) return false;

    if (skipGroup !== 'price') {
      if (state.freeOnly && s.price !== 0) return false;
      if (!state.freeOnly && s.price > state.maxPrice) return false;
    }
    if (state.favOnly && !favs.has(s.id)) return false;
    if (state.footOnly && !footprints[s.id]) return false;

    if (state.query.trim()) {
      const q = state.query.trim().toLowerCase();
      const hay = [s.name, s.district, s.area, s.summary, s.signal, s.operator,
        ...s.facilities, ...s.tags, ...s.transport].join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  }

  function filtered(skipGroup) {
    return SITES.filter((s) => matches(s, skipGroup));
  }

  /* ---------- Chip 元件 ---------- */
  function makeChip(label, set, value, count, hint) {
    const btn = document.createElement('button');
    btn.className = 'chip';
    btn.type = 'button';
    btn.setAttribute('aria-pressed', set.has(value) ? 'true' : 'false');
    btn.innerHTML = `${label}` + (count != null ? ` <span class="chip-count">${count}</span>` : '');
    if (hint) btn.title = hint;
    btn.addEventListener('click', () => {
      set.has(value) ? set.delete(value) : set.add(value);
      render();
    });
    return btn;
  }

  function renderFilters() {
    const mount = (id, values, set, group) => {
      const host = document.getElementById(id);
      host.innerHTML = '';
      const pool = filtered(group);
      values.forEach((v) => {
        const count = pool.filter((s) => {
          if (group === 'type') return s.type === v;
          if (group === 'district') return s.district === v;
          if (group === 'transport') return s.transport.includes(v);
          if (group === 'tag') return [...s.facilities, ...s.tags].map(canonTag).includes(v);
          if (group === 'signal') return s.signal === v;
          return false;
        }).length;
        const members = FACILITY_GROUPS[v];
        const hint = group === 'tag' && members ? `包含：${members.join('／')}` : '';
        host.appendChild(makeChip(v, set, v, count, hint));
      });
    };

    mount('typeChips', types, state.types, 'type');
    mount('districtChips', districts, state.districts, 'district');
    mount('transportChips', transports, state.transports, 'transport');
    mount('tagChips', allTags, state.tags, 'tag');
    mount('signalChips', signals, state.signals, 'signal');
    document.getElementById('favCount').textContent = favs.size;
    document.getElementById('favToggle').setAttribute('aria-pressed', state.favOnly ? 'true' : 'false');

    const footEl = document.getElementById('footCount');
    if (footEl) footEl.textContent = footCount();
    const footToggle = document.getElementById('footToggle');
    if (footToggle) footToggle.setAttribute('aria-pressed', state.footOnly ? 'true' : 'false');
    const footClear = document.getElementById('footClear');
    if (footClear) footClear.hidden = footCount() === 0;
  }

  /* ---------- 地圖 ---------- */
  let map = null, markerLayer = null, markerById = {};
  const leafletReady = typeof window.L !== 'undefined';

  function initMap() {
    if (!leafletReady) {
      document.getElementById('map').hidden = true;
      document.getElementById('mapFallback').hidden = false;
      document.getElementById('toggleMapText').hidden = true;
      return;
    }
    map = L.map('map', { scrollWheelZoom: false }).setView([22.38, 114.12], 10);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);
    markerLayer = L.layerGroup().addTo(map);
  }

  function pinIcon(site) {
    const meta = TYPE_META[site.type] || { color: '#555', short: '?' };
    // 週末降雨概率：優先用該營地所屬 OCF 分區站（官方分區預報），冇就退回全港預測。
    // 只係「落雨機會」，唔係逐營地實測，popup 同排行榜都有寫明。
    const pct = siteWeekendRain(site);
    const cls = pct === null ? WEEKEND_PSR_CLASS : `psr-${rainClass(pct)}`;
    const label = pct === null
      ? `週末降雨概率（全港）：${WEEKEND_PSR_TEXT}`
      : `${OCF?.stations?.[site.ocfStation]?.name || site.ocfStation}站週末最高降雨概率：${pct}%（${WEEKEND_LABEL}）`;
    const dot = cls
      ? `<i class="weather-dot ${cls}" title="${label}"></i>`
      : '';
    return L.divIcon({
      className: '',
      html: `<div class="pin-wrap"><div class="map-pin" style="background:${meta.color}"><span>${meta.short}</span></div>${dot}</div>`,
      iconSize: [26, 26],
      iconAnchor: [13, 26],
      popupAnchor: [0, -24],
    });
  }

  function renderMap(sites) {
    if (!leafletReady || !state.mapVisible) return;
    markerLayer.clearLayers();
    markerById = {};
    if (!sites.length) return;

    const bounds = [];
    sites.forEach((s) => {
      const marker = L.marker([s.lat, s.lng], { icon: pinIcon(s) });
      const booking = s.booking && s.bookingUrl
        ? `<br><a class="popup-link" href="${s.bookingUrl}" target="_blank" rel="noopener">前往預訂頁面 ↗</a>` : '';
      const info = (!s.bookingUrl && s.infoUrl)
        ? `<br><a class="popup-link" href="${s.infoUrl}" target="_blank" rel="noopener">${s.booking ? '預訂查詢（官網）' : '官方資料'} ↗</a>` : '';
      const pct = siteWeekendRain(s);
      const pcls = pct === null ? WEEKEND_PSR_CLASS : `psr-${rainClass(pct)}`;
      const weatherLine = pcls
        ? `<div class="popup-weather"><i class="weather-dot ${pcls}"></i> ${
          pct === null
            ? `週末降雨概率（全港預測）：${WEEKEND_PSR_TEXT}`
            : `${OCF?.stations?.[s.ocfStation]?.name || s.ocfStation}站（${s.ocfStation}）週末最高降雨概率：${pct}%`
        }${WEEKEND_LABEL ? ` · ${WEEKEND_LABEL}` : ''}</div>`
        : '';
      marker.bindPopup(
        `<div class="popup-title">${s.name}</div>
         <div class="popup-meta">${s.type} · ${s.operator || ''} · ${s.district} ${s.area} · ${priceText(s)}</div>
         ${weatherLine}
         <a class="popup-link" href="https://www.google.com/maps?q=${s.lat},${s.lng}" target="_blank" rel="noopener">Google 地圖導航 ↗</a><br><a class="popup-link" href="${OFCA_COVERAGE_URL}" target="_blank" rel="noopener">📶 通訊辦覆蓋地圖 ↗</a>${booking}${info}`
      );
      markerLayer.addLayer(marker);
      markerById[s.id] = marker;
      bounds.push([s.lat, s.lng]);
    });
    map.invalidateSize();
    if (bounds.length === 1) map.setView(bounds[0], 13);
    else map.fitBounds(bounds, { padding: [34, 34], maxZoom: 14 });
  }

  function flyTo(id) {
    const marker = markerById[id];
    if (!marker || !map) return;
    map.setView(marker.getLatLng(), 15, { animate: true });
    marker.openPopup();
    document.getElementById('mapWrap').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /* ---------- 卡片 ---------- */
  function priceText(s) {
    if (s.price === null || s.price === undefined) return '面議／電話查詢';
    if (s.price === 0) return '免費';
    // priceSource = estimate 即係未逐筆核實嘅約數 → 前面加「約」
    const approx = s.priceSource === 'estimate' ? '約 ' : '';
    return `${approx}$${s.price} ${s.priceUnit || ''}`.trim();
  }

  /* 官方 CSDI 欄位 → 出發前準備提示（只喺漁護署營地有值） */
  function prepBadges(s) {
    if (!s.waterSource && !s.tentSpace) return '';
    let water = '';
    if (s.waterSource) {
      const seasonal = s.waterSource.includes('季節性');
      const label = seasonal ? '⚠️ 季節性溪澗（旱季可能無水）'
        : s.waterSource.includes('洗手間') ? '🚻 洗手間' : '🚰 水喉';
      water = `<span class="prep-badge ${seasonal ? 'warn' : ''}">${label}</span>`;
    }
    const small = s.tentSpace && s.tentSpace.includes('少於');
    const tent = s.tentSpace
      ? `<span class="prep-badge ${small ? 'warn' : ''}">⛺ ${s.tentSpace} 營位${small ? ' · 假日易滿' : ''}</span>`
      : '';
    return `<div class="prep-badges">${water}${tent}</div>`;
  }

  /* 廁所類型徽章（v1.6.1）：
   * 旱廁（得個窿、無沖水）同沖水廁所係兩件事，唔可以混為一談，
   * 所以卡片會分開標示，旱廁用警告色提醒要自備水／濕紙巾。
   */
  function toiletBadge(s) {
    const all = [...s.facilities, ...s.tags];
    const dry = all.includes('旱廁');
    const flush = all.includes('廁所');
    if (!dry && !flush) return '';
    const parts = [];
    if (dry) parts.push('<span class="prep-badge warn" title="旱廁：通常只係一個坑／無沖水，請自備水、濕紙巾同消毒用品">🕳 旱廁（無沖水）</span>');
    if (flush) parts.push('<span class="prep-badge" title="沖水廁所">🚻 沖水廁所</span>');
    return `<div class="prep-badges">${parts.join('')}</div>`;
  }

  function renderCards(sites) {
    const grid = document.getElementById('cardGrid');
    const empty = document.getElementById('emptyState');
    grid.innerHTML = '';
    empty.hidden = sites.length > 0;

    sites.forEach((s) => {
      const card = document.createElement('article');
      card.className = 'card';
      const tags = [...s.facilities, ...s.tags].slice(0, 5);
      const isFav = favs.has(s.id);
      const visit = footprints[s.id] || null;
      card.innerHTML = `
        <div class="card-top">
          <span class="type-badge type-${s.type}">${s.type}</span>
          <span class="card-tools">
            <button class="foot-btn ${visit ? 'on' : ''}" type="button" aria-pressed="${visit ? 'true' : 'false'}"
              title="${visit ? `已標記去過 ${visit.last}（再撳取消）` : '標記去過（只存喺呢個瀏覽器）'}"
              aria-label="標記去過 ${s.name}">👣</button>
            <button class="fav-btn" title="加入我的最愛" aria-label="收藏 ${s.name}">${isFav ? '⭐' : '☆'}</button>
          </span>
        </div>
        <h3>${s.name}</h3>
        <div class="place">📍 ${s.district} · ${s.area}${s.operator ? ` · 🏛 ${s.operator}` : ''}</div>
        <div class="place signal-dot">📶 訊號：${s.signal || '不詳'}</div>
        <div class="price-line">
          <span class="price ${s.price === 0 ? 'free' : ''}">${priceText(s)}</span>
          ${s.booking ? '<span class="price-unit">· 需預訂</span>'
            : `<span class="price-unit">· ${s.type === '民宿' ? '訂房請先電話查詢' : '免預訂／先到先得'}</span>`}
        </div>
        ${s.priceSource === 'estimate'
          ? '<div class="price-caveat">約數 · 未逐筆核實，落訂前請向場地官網／電話確認</div>' : ''}
        ${toiletBadge(s)}
        ${prepBadges(s)}
        <div class="prep-badges foot-line"${visit ? '' : ' hidden'}>
          <span class="prep-badge foot">👣 去過 · 上次 <span class="foot-last">${visit ? visit.last : ''}</span></span>
        </div>
        ${s.tideStation ? `<div class="prep-badges"><span class="prep-badge tide">🌊 潮汐站：${TIDE_STATION_NAMES[s.tideStation] || s.tideStation}</span></div>` : ''}
        <p class="summary">${s.summary}</p>
        <div class="mini-tags">${tags.map((t) => `<span class="mini-tag">${t}</span>`).join('')}</div>
        <div class="card-actions">
          <button data-action="local">🌡 該區天氣</button>
          <button data-action="locate">📍 地圖位置</button>
          <a href="https://www.google.com/maps?q=${s.lat},${s.lng}" target="_blank" rel="noopener">🗺 導航</a>
          <a href="${OFCA_COVERAGE_URL}" target="_blank" rel="noopener" title="通訊辦郊野公園流動網絡覆蓋調查（地理資訊地圖）">📶 覆蓋查詢</a>
          <a href="${geoInfoUrl(s)}" target="_blank" rel="noopener" title="地政總署地理資訊地圖定位">🏛 官方地圖</a>
          ${s.booking && s.bookingUrl ? `<a href="${s.bookingUrl}" target="_blank" rel="noopener">📅 預訂</a>` : ''}
          ${s.booking && !s.bookingUrl && s.infoUrl ? `<a href="${s.infoUrl}" target="_blank" rel="noopener">📅 預訂查詢</a>` : ''}
          ${!s.booking && s.infoUrl ? `<a href="${s.infoUrl}" target="_blank" rel="noopener">ℹ 官方資料</a>` : ''}
          ${REPORT_ENDPOINT ? `<button data-action="report" type="button" title="發現資料過時／有錯？報畀我哋知">✏️ 報料</button>` : ''}
        </div>`;

      card.querySelector('.fav-btn').addEventListener('click', (e) => {
        favs.has(s.id) ? favs.delete(s.id) : favs.add(s.id);
        saveFavs();
        e.currentTarget.textContent = favs.has(s.id) ? '⭐' : '☆';
        renderFilters();
      });

      // 我的足跡：再撳一次取消；只寫 localStorage，冇帳號、冇上傳
      card.querySelector('.foot-btn').addEventListener('click', (e) => {
        let now = null;
        if (footprints[s.id]) {
          delete footprints[s.id];
        } else {
          footprints[s.id] = { first: todayHK(), last: todayHK() };
          now = footprints[s.id];
        }
        saveFootprints();
        e.currentTarget.classList.toggle('on', !!now);
        e.currentTarget.setAttribute('aria-pressed', now ? 'true' : 'false');
        e.currentTarget.title = now ? `已標記去過 ${now.last}（再撳取消）` : '標記去過（只存喺呢個瀏覽器）';
        const line = card.querySelector('.foot-line');
        const last = card.querySelector('.foot-last');
        if (line) line.hidden = !now;
        if (last) last.textContent = now ? now.last : '';
        if (state.footOnly) render();
        else renderFilters();
      });
      card.querySelector('[data-action="locate"]').addEventListener('click', () => flyTo(s.id));
      const reportBtn = card.querySelector('[data-action="report"]');
      if (reportBtn) reportBtn.addEventListener('click', () => openReport(s));
      card.querySelector('[data-action="local"]').addEventListener('click', () => {
        localSiteId = s.id;
        renderLocalConditions(s);
        const panel = document.getElementById('localPanel');
        if (panel) {
          panel.hidden = false;
          panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      });
      grid.appendChild(card);
    });
  }

  /* ---------- 排序 ---------- */
  function sortSites(sites) {
    const list = [...sites];
    if (state.sort === 'price-asc') {
      list.sort((a, b) =>
        (a.price === null) - (b.price === null) ||
        (a.price ?? 0) - (b.price ?? 0) ||
        a.name.localeCompare(b.name, 'zh-Hant')
      );
    }
    if (state.sort === 'name') list.sort((a, b) => a.name.localeCompare(b.name, 'zh-Hant'));
    return list;
  }

  /* ---------- 主渲染 ---------- */
  function activeFilterCount() {
    return state.types.size + state.districts.size + state.transports.size +
      state.tags.size + state.signals.size +
      (state.freeOnly ? 1 : 0) + (state.favOnly ? 1 : 0) + (state.footOnly ? 1 : 0) +
      (state.maxPrice < 1500 ? 1 : 0) + (state.query.trim() ? 1 : 0);
  }

  function render() {
    renderFilters();
    const sites = sortSites(filtered());
    document.getElementById('resultCount').innerHTML =
      `共 <b>${sites.length}</b> 個結果（資料庫總數 ${SITES.length} 筆）`;
    renderMap(sites);
    renderCards(sites);
    const n = activeFilterCount();
    document.getElementById('filterActiveCount').textContent = n > 0 ? n : '';
  }

  /* ---------- 事件綁定 ---------- */
  function bindEvents() {
    document.getElementById('searchInput').addEventListener('input', (e) => {
      state.query = e.target.value;
      render();
    });
    document.getElementById('sortSelect').addEventListener('change', (e) => {
      state.sort = e.target.value;
      render();
    });
    document.getElementById('freeOnly').addEventListener('change', (e) => {
      state.freeOnly = e.target.checked;
      render();
    });
    const priceSlider = document.getElementById('maxPrice');
    priceSlider.addEventListener('input', (e) => {
      state.maxPrice = Number(e.target.value);
      document.getElementById('maxPriceLabel').textContent =
        state.maxPrice >= 1500 ? '$1500 或以上' : `$${state.maxPrice} 或以下`;
      render();
    });
    document.getElementById('favToggle').addEventListener('click', () => {
      state.favOnly = !state.favOnly;
      render();
    });

    const footToggle = document.getElementById('footToggle');
    if (footToggle) {
      footToggle.addEventListener('click', () => {
        state.footOnly = !state.footOnly;
        render();
      });
    }
    const footClear = document.getElementById('footClear');
    if (footClear) {
      footClear.addEventListener('click', () => {
        if (!footCount()) return;
        if (typeof window.confirm === 'function' &&
            !window.confirm('清除全部「我的足跡」紀錄？（只影響呢個瀏覽器）')) return;
        Object.keys(footprints).forEach((id) => delete footprints[id]);
        saveFootprints();
        state.footOnly = false;
        render();
      });
    }

    const clearAll = () => {
      state.types.clear(); state.districts.clear(); state.transports.clear();
      state.tags.clear(); state.signals.clear();
      state.freeOnly = false; state.favOnly = false; state.footOnly = false;
      state.maxPrice = 1500; state.query = '';
      document.getElementById('freeOnly').checked = false;
      document.getElementById('maxPrice').value = 1500;
      document.getElementById('maxPriceLabel').textContent = '$1500 或以上';
      document.getElementById('searchInput').value = '';
      render();
    };
    document.getElementById('clearAll').addEventListener('click', clearAll);
    document.getElementById('emptyClear').addEventListener('click', clearAll);

    // 該區天氣面板收起
    document.getElementById('localClose').addEventListener('click', () => {
      document.getElementById('localPanel').hidden = true;
    });

    // 手機版側欄
    const sidebar = document.getElementById('sidebar');
    const toggle = document.getElementById('filterToggle');
    toggle.addEventListener('click', () => {
      const open = sidebar.classList.toggle('open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    document.getElementById('sidebarClose').addEventListener('click', () => {
      sidebar.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
    });

    // 地圖顯示切換
    document.getElementById('toggleMapText').addEventListener('click', (e) => {
      state.mapVisible = !state.mapVisible;
      document.getElementById('mapWrap').style.display = state.mapVisible ? '' : 'none';
      e.target.textContent = state.mapVisible ? '▣ 隱藏地圖' : '▢ 顯示地圖';
      if (state.mapVisible && map) setTimeout(() => map.invalidateSize(), 50);
    });
  }

  /* ---------- Header 統計 ---------- */
  function renderHeaderStats() {
    const host = document.getElementById('headerStats');
    Object.entries(TYPE_META).forEach(([type]) => {
      const n = SITES.filter((s) => s.type === type).length;
      if (!n) return;
      const pill = document.createElement('span');
      pill.className = 'stat-pill';
      pill.innerHTML = `${type} <b>${n}</b>`;
      host.appendChild(pill);
    });
    const free = document.createElement('span');
    free.className = 'stat-pill';
    free.innerHTML = `免費 <b>${SITES.filter((s) => s.price === 0).length}</b>`;
    host.appendChild(free);
  }

  /* ---------- 天氣列（P3：前端食 data/auto/weather.json） ---------- */
  const fmtDay = (s) => {
    const v = String(s || '');
    return v.length === 8 ? `${v.slice(4, 6)}/${v.slice(6, 8)}` : v;
  };
  const fmtStamp = (iso) => {
    const d = new Date(iso || '');
    return Number.isFinite(d.getTime())
      ? `${d.toISOString().slice(0, 16).replace('T', ' ')} UTC` : '時間不詳';
  };

  function renderWeather() {
    const bar = document.getElementById('weatherBar');
    if (!bar) return;
    if (!WEATHER || !WEEKEND_DAYS.length) { bar.hidden = true; return; }

    const warnings = Array.isArray(WEATHER.activeWarnings) ? WEATHER.activeWarnings : [];
    const lows = WEEKEND_DAYS.map((d) => Number(d.minTemp)).filter(Number.isFinite);
    const highs = WEEKEND_DAYS.map((d) => Number(d.maxTemp)).filter(Number.isFinite);
    const temp = lows.length && highs.length
      ? ` · ${Math.min(...lows)}–${Math.max(...highs)}°C` : '';
    const first = WEEKEND_DAYS[0];
    const last = WEEKEND_DAYS[WEEKEND_DAYS.length - 1];
    const range = first.date === last.date
      ? fmtDay(first.date) : `${fmtDay(first.date)}–${fmtDay(last.date)}`;
    const stale = isStale(WEATHER.fetchedAt, 36);

    bar.hidden = false;
    bar.className = `weather-bar ${WEEKEND_PSR_CLASS}`;
    bar.replaceChildren();

    // 全部用 textContent，唔用 innerHTML：天文台資料屬外部輸入（A11 輸入消毒）
    const add = (tag, cls, text) => {
      const el = document.createElement(tag);
      if (cls) el.className = cls;
      el.textContent = text;
      bar.appendChild(el);
      return el;
    };

    add('span', 'weather-lead', '🌦 週末天氣（全港預測）');
    add('span', 'psr-badge', `降雨概率 ${WEEKEND_PSR_TEXT}`);
    add('span', 'weather-detail',
      `${range} · ${WEEKEND_DAYS.map((d) => `${d.week} ${d.psr}`).join('／')}${temp}`);

    // 週末日落（官方 SRS 驗證過嘅純 JS 公式）
    const sun = sunTimesHKT(hkDateFromCompact(first.date));
    if (sun) {
      const oneHourBefore = `${String(Math.max(0, Number(sun.set.slice(0, 2)) - 1)).padStart(2, '0')}${sun.set.slice(2)}`;
      add('span', 'weather-sun', `🌇 日落 ${sun.set} · 建議 ${oneHourBefore} 前紮營`);
    }

    if (warnings.length) {
      add('span', 'weather-warn', `⚠ 生效警告：${warnings.map((w) => w.name).join('、')}`);
    }
    add('span', 'weather-meta',
      `${stale ? '⚠ 快照可能過期 · ' : ''}天文台更新 ${WEATHER.hkoUpdateTime || fmtStamp(WEATHER.fetchedAt)}（抓取 ${fmtStamp(WEATHER.fetchedAt)}）`);

    const link = add('a', 'weather-link', '九天預報 ↗');
    link.href = 'https://www.hko.gov.hk/tc/wxinfo/currwx/fnd.htm';
    link.target = '_blank';
    link.rel = 'noopener';
  }

  /* ---------- 該區天氣 + 潮汐面板（v1.2.0） ---------- */
  let localSiteId = null;   // 用戶揀咗邊個營地睇該區天氣

  function renderLocalConditions(site) {
    const host = document.getElementById('localConditions');
    if (!host) return;
    host.replaceChildren();

    if (!site) {
      const hint = document.createElement('p');
      hint.className = 'local-hint';
      hint.textContent = '👆 撳卡片嘅「該區天氣」睇該區實況、潮汐同日出日落。';
      host.appendChild(hint);
      return;
    }

    const stale = !CONDITIONS || isStale(CONDITIONS.districtWeather?.updateTime || CONDITIONS.fetchedAt, 3);
    const dr = districtReading(site);
    const sun = sunTimesHKT(todayHK(), site.lat, site.lng);
    const weekendDay = WEEKEND_DAYS.length ? hkDateFromCompact(WEEKEND_DAYS[0].date) : todayHK();
    const tideToday = tideReading(site, todayHK());
    const tideWeekend = tideReading(site, weekendDay);

    const mk = (tag, cls, text) => {
      const el = document.createElement(tag);
      if (cls) el.className = cls;
      if (text != null) el.textContent = text;
      return el;
    };

    const head = mk('div', 'local-head');
    head.appendChild(mk('strong', '', `📍 ${site.name}`));
    head.appendChild(mk('span', 'local-tag', `${site.district} · ${site.area}`));
    if (stale) head.appendChild(mk('span', 'local-stale', '⚠ 快照可能過期'));
    host.appendChild(head);
    host.appendChild(mk('p', 'local-disclaimer',
      '以下係就近自動氣象站／潮汐站嘅官方實況，唔係營地實地測量；山區與海邊可以有明顯差異。'));

    const grid = mk('div', 'local-grid');

    // 1. 該區實況
    const box1 = mk('section', 'local-box');
    box1.appendChild(mk('h4', '', '🌡 該區實況'));
    if (dr && (dr.tempC !== null || dr.rainMm !== null)) {
      const big = mk('div', 'local-big', dr.tempC !== null ? `${dr.tempC}°C` : '—');
      box1.appendChild(big);
      box1.appendChild(mk('div', 'local-sub', `就近氣象站：${dr.station}（一分鐘平均氣溫）`));
      box1.appendChild(mk('div', 'local-sub',
        `${dr.rainDistrict} 過去一小時雨量：${dr.rainMm !== null ? `${dr.rainMm} mm` : '—'}`));
      const link = mk('a', 'local-link', '天文台分區天氣 ↗');
      link.href = 'https://www.hko.gov.hk/tc/wxinfo/currwx/rhrread.htm';
      link.target = '_blank'; link.rel = 'noopener';
      box1.appendChild(link);
    } else {
      box1.appendChild(mk('div', 'local-sub', '暫無該區實況數據'));
    }
    grid.appendChild(box1);

    // 2. 日出日落
    const box2 = mk('section', 'local-box');
    box2.appendChild(mk('h4', '', '🌇 今日日光'));
    if (sun) {
      box2.appendChild(mk('div', 'local-big', sun.set));
      box2.appendChild(mk('div', 'local-sub', `日出 ${sun.rise} · 日落 ${sun.set}（HKT）`));
      const setup = `${String(Math.max(0, Number(sun.set.slice(0, 2)) - 1)).padStart(2, '0')}${sun.set.slice(2)}`;
      box2.appendChild(mk('div', 'local-warn', `建議 ${setup} 前紮好營，摸黑開營好危險`));
      const link = mk('a', 'local-link', '天文台日出日沒表 ↗');
      link.href = 'https://www.hko.gov.hk/tc/gts/astronomy/SRS.htm';
      link.target = '_blank'; link.rel = 'noopener';
      box2.appendChild(link);
    } else {
      box2.appendChild(mk('div', 'local-sub', '未能計算日光時間'));
    }
    grid.appendChild(box2);

    // 2b. 該區未來九日（OCF 官方分區預報）
    const ocfSt = OCF?.stations?.[site.ocfStation];
    if (ocfSt && Array.isArray(ocfSt.daily) && ocfSt.daily.length) {
      const boxOcf = mk('section', 'local-box local-box-wide');
      boxOcf.appendChild(mk('h4', '', `📅 未來九日（${ocfSt.name}站 · 天文台 OCF）`));
      const strip = mk('div', 'local-forecast-strip');
      ocfSt.daily.slice(0, 9).forEach((d) => {
        const [emoji, label] = ocfWeather(d.weather);
        const cell = mk('div', `lfc-day ${rainClass(d.rainPct)}`);
        const { md, wd } = fmtForecastDay(d.date);
        cell.appendChild(mk('span', 'lfc-date', `${md} ${wd.replace('星期', '週')}`));
        cell.appendChild(mk('span', 'lfc-icon', emoji));
        cell.appendChild(mk('span', 'lfc-temp',
          d.max !== null && d.min !== null ? `${Math.round(d.max)}°/${Math.round(d.min)}°` : '—'));
        cell.appendChild(mk('span', 'lfc-rain', d.rainLabel || '—'));
        cell.title = `${label}｜最高 ${d.max ?? '—'}°C｜最低 ${d.min ?? '—'}°C｜降雨概率 ${d.rainLabel ?? '官方無提供'}`;
        strip.appendChild(cell);
      });
      boxOcf.appendChild(strip);
      const note = mk('a', 'local-link', 'OCF 官方說明（自動預報，可能同正式預報唔同）↗');
      note.href = 'https://maps.weather.gov.hk/ocf/help_e.html';
      note.target = '_blank'; note.rel = 'noopener';
      boxOcf.appendChild(note);
      grid.appendChild(boxOcf);
    }

    // 3. 潮汐
    const box3 = mk('section', 'local-box');
    box3.appendChild(mk('h4', '', '🌊 潮汐（就近站）'));
    if (tideToday || tideWeekend) {
      const st = tideToday || tideWeekend;
      box3.appendChild(mk('div', 'local-sub', `就近潮汐站：${st.name}（HKO 官方預測）`));
      const renderEvents = (label, tr, dateStr) => {
        if (!tr) return;
        const row = mk('div', 'tide-row');
        row.appendChild(mk('span', 'tide-label', label));
        const list = mk('span', 'tide-list');
        tr.events.forEach((ev) => {
          const chip = mk('span', `tide-chip ${ev.type === 'H' ? 'high' : 'low'}`,
            `${ev.type === 'H' ? '漲' : '退'} ${ev.time} (${ev.height.toFixed(2)}m)`);
          list.appendChild(chip);
        });
        row.appendChild(list);
        box3.appendChild(row);
      };
      const shortDate = (iso) => `${iso.slice(5, 7)}/${iso.slice(8, 10)}`;
      renderEvents(`今日 ${shortDate(todayHK())}`, tideToday, todayHK());
      if (weekendDay !== todayHK()) renderEvents(`週末 ${shortDate(weekendDay)}`, tideWeekend, weekendDay);
      box3.appendChild(mk('div', 'local-warn',
        '退潮先適合行近岸／礁石；潮漲唔好喺沙洲或低窪紮營。'));
      const link = mk('a', 'local-link', '天文台潮汐預報 ↗');
      link.href = 'https://www.hko.gov.hk/tc/tide/etide_main.htm';
      link.target = '_blank'; link.rel = 'noopener';
      box3.appendChild(link);
    } else {
      box3.appendChild(mk('div', 'local-sub', '呢個營地唔喺沿岸，或暫無潮汐數據'));
    }
    grid.appendChild(box3);

    host.appendChild(grid);
  }

  /* ---------- 九日該區預報時間軸（v1.3.0） ---------- */
  let forecastCode = null;   // 目前揀咗邊個 OCF 站

  function renderForecastRegionOptions() {
    const sel = document.getElementById('forecastRegion');
    if (!sel) return;
    sel.replaceChildren();
    if (!OCF || !OCF.stations) return;

    // 只列出 data.csv 實際用到嘅站，並按營地數量排序
    const used = {};
    SITES.forEach((s) => { if (s.ocfStation) used[s.ocfStation] = (used[s.ocfStation] || 0) + 1; });
    const codes = Object.keys(OCF.stations)
      .filter((c) => used[c])
      .sort((a, b) => used[b] - used[a]);
    if (!codes.length) return;

    if (!forecastCode || !codes.includes(forecastCode)) forecastCode = codes[0];
    codes.forEach((code) => {
      const opt = document.createElement('option');
      opt.value = code;
      opt.textContent = `${OCF.stations[code].name}（${used[code]} 個營地）`;
      sel.appendChild(opt);
    });
    sel.value = forecastCode;
    sel.addEventListener('change', (e) => {
      forecastCode = e.target.value;
      renderForecast();
    });
  }

  function renderForecast() {
    const host = document.getElementById('forecastScroll');
    const meta = document.getElementById('forecastSource');
    if (!host) return;
    host.replaceChildren();

    if (!OCF || !OCF.stations || !forecastCode) {
      const p = document.createElement('p');
      p.className = 'forecast-empty';
      p.textContent = '暫無分區預報數據（GitHub Actions 每日更新）。';
      host.appendChild(p);
      return;
    }
    const st = OCF.stations[forecastCode];
    if (!st || !Array.isArray(st.daily) || !st.daily.length) {
      const p = document.createElement('p');
      p.className = 'forecast-empty';
      p.textContent = '呢個站暫無預報數據。';
      host.appendChild(p);
      return;
    }

    if (meta) {
      const t = String(st.modelTime || OCF.fetchedAt || '');
      meta.textContent = `站點：${st.name} · 模型 ${t.length === 10 ? `${t.slice(0, 4)}-${t.slice(4, 6)}-${t.slice(6, 8)} ${t.slice(8)}:00` : t}`;
    }

    const today = todayHK();
    const stale = isStale(OCF.fetchedAt, 30);

    st.daily.forEach((d, i) => {
      const [emoji, label] = ocfWeather(d.weather);
      const { md, wd } = fmtForecastDay(d.date);
      const card = document.createElement('div');
      card.className = `forecast-day ${i === 0 ? 'today' : ''}`;
      if (/星期六|星期日/.test(wd)) card.classList.add('weekend');

      const add = (tag, cls, text) => {
        const el = document.createElement(tag);
        if (cls) el.className = cls;
        if (text != null) el.textContent = text;
        card.appendChild(el);
        return el;
      };

      add('div', 'fc-date', i === 0 ? `今日 ${md}` : `${md} ${wd}`);
      add('div', 'fc-icon', emoji);
      add('div', 'fc-weather', d.weather ? label : '—');
      add('div', 'fc-temp',
        d.max !== null && d.min !== null ? `${Math.round(d.max)}° / ${Math.round(d.min)}°` : '—');

      const rain = add('div', `fc-rain ${rainClass(d.rainPct)}`,
        d.rainLabel ? `🌧 ${d.rainLabel}` : '🌧 降雨概率 —');
      if (d.rainPct === null) rain.title = '呢個站官方無提供降雨概率';
      if (d.rainPct !== null && d.rainPct >= 60) {
        add('div', 'fc-warn', '⚠️ 唔適宜');
      } else if (d.rainPct !== null && d.rainPct >= 40) {
        add('div', 'fc-warn mild', '帶雨具');
      } else {
        add('div', 'fc-warn ok', '適合');
      }

      // 該區日落（沿用純 JS 天文公式）
      const sun = sunTimesHKT(d.date);
      if (sun) add('div', 'fc-sun', `🌇 ${sun.set}`);

      // 該營地潮汐（如有）
      const coastal = SITES.find((s) => s.ocfStation === forecastCode && s.tideStation);
      if (coastal) {
        const tr = tideReading(coastal, d.date);
        if (tr) {
          const low = tr.events.filter((e) => e.type === 'L').map((e) => e.time).join('/');
          const high = tr.events.filter((e) => e.type === 'H').map((e) => e.time).join('/');
          add('div', 'fc-tide', `🌊 退 ${low || '—'} · 漲 ${high || '—'}`);
        }
      }

      if (d.date === today) card.classList.add('current');
      host.appendChild(card);
    });

    if (stale) {
      const warn = document.createElement('p');
      warn.className = 'forecast-stale';
      warn.textContent = `⚠️ 快照抓取時間 ${fmtStamp(OCF.fetchedAt)}，可能已過期，請以天文台正式預報為準。`;
      host.appendChild(warn);
    }
  }

  /* ---------- 週末唔落雨排行（v1.4.0） ----------
   * 參考台灣營火部落「本週末邊區唔落雨」嘅概念，但只用天文台 OCF 官方分區預報，
   * 唔會自己估雨量；每行可撳去上方九日時間軸睇該站詳情。
   */
  function stationsInUse() {
    const map = {};
    SITES.forEach((s) => {
      if (!s.ocfStation) return;
      (map[s.ocfStation] = map[s.ocfStation] || []).push(s);
    });
    return map;
  }

  function renderWeekendRank() {
    const panel = document.getElementById('weekendRankPanel');
    const host = document.getElementById('weekendRankList');
    const dates = document.getElementById('weekendRankDates');
    if (!panel || !host) return;
    host.replaceChildren();

    if (!OCF || !OCF.stations || !WEEKEND.length) {
      panel.hidden = true;
      return;
    }

    const byStation = stationsInUse();
    const rows = Object.keys(OCF.stations)
      .filter((code) => byStation[code])
      .map((code) => {
        const st = OCF.stations[code] || {};
        const days = WEEKEND
          .map((d) => (st.daily || []).find((x) => x.date === d))
          .filter(Boolean);
        const maxs = days.map((d) => d.max).filter((v) => typeof v === 'number');
        const mins = days.map((d) => d.min).filter((v) => typeof v === 'number');
        return {
          code,
          name: st.name || code,
          pct: stationWeekendRain(code),
          count: byStation[code].length,
          samples: byStation[code].slice(0, 2).map((s) => s.name),
          max: maxs.length ? Math.max(...maxs) : null,
          min: mins.length ? Math.min(...mins) : null,
        };
      })
      .filter((r) => r.pct !== null)
      .sort((a, b) => a.pct - b.pct || b.count - a.count ||
        a.name.localeCompare(b.name, 'zh-Hant'));

    if (!rows.length) {
      panel.hidden = true;
      return;
    }

    panel.hidden = false;
    if (dates) dates.textContent = `本週末 ${WEEKEND_LABEL} · 按降雨概率由低至高`;

    rows.forEach((r, i) => {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = `rank-row ${rainClass(r.pct)}`;
      row.title = `撳一下睇「${r.name}」站嘅九日預報`;
      const add = (tag, cls, text) => {
        const el = document.createElement(tag);
        if (cls) el.className = cls;
        if (text != null) el.textContent = text;
        row.appendChild(el);
        return el;
      };
      add('span', 'rank-no', String(i + 1));
      add('span', 'rank-name', r.name);
      add('span', 'rank-rain', `🌧 ${r.pct}%`);
      add('span', 'rank-temp',
        r.max !== null && r.min !== null ? `${Math.round(r.max)}° / ${Math.round(r.min)}°` : '—');
      add('span', 'rank-count', `${r.count} 個營地`);
      add('span', 'rank-samples', r.samples.join('、'));
      row.addEventListener('click', () => {
        forecastCode = r.code;
        const sel = document.getElementById('forecastRegion');
        if (sel) sel.value = r.code;
        renderForecast();
        const fc = document.getElementById('forecastPanel');
        if (fc) fc.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      host.appendChild(row);
    });
  }

  /* ---------- 入站人次（v1.4.0） ----------
   * 全站真實人次：Vercel Web Analytics（`/_vercel/insights/script.js`，喺 Vercel Dashboard 開）。
   * 頁面顯示：本機累計入站次數（localStorage），同一 browser session 只計一次。
   * 純靜態、零後端、零 secret、無 cookie；唔會假裝全站數字。
   */
  function initVisitCounter() {
    const el = document.getElementById('visitCount');
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem(VISIT_KEY) || '{}') || {}; } catch { saved = {}; }
    let n = Math.max(0, Math.floor(Number(saved.n) || 0));
    const first = saved.first ? String(saved.first) : todayHK();

    let counted = false;
    try {
      if (typeof sessionStorage !== 'undefined' && sessionStorage) {
        counted = sessionStorage.getItem('hkcamp_visit_counted') === '1';
        if (!counted) sessionStorage.setItem('hkcamp_visit_counted', '1');
      }
    } catch { counted = false; }

    if (!counted) {
      n += 1;
      try {
        localStorage.setItem(VISIT_KEY, JSON.stringify({ n, first, last: todayHK() }));
      } catch { /* 私隱模式：唔影響網站運作 */ }
    }

    if (!el) return;
    el.textContent = n > 0
      ? `👣 入站人次：你第 ${n} 次到訪（本機紀錄，首次 ${first}）`
      : '👣 入站人次統計中';
    el.title = '「入站人次」喺呢度顯示嘅係你喺呢個瀏覽器嘅累計到訪次數，只存喺本機、唔會上傳；'
      + '全站真實人次由 Vercel Web Analytics 以無 cookie 方式統計（詳見 README）。';
  }

  /* ---------- 報料表單（v1.7.0）---------- */
  function openReport(site) {
    const dlg = document.getElementById('reportDialog');
    const form = document.getElementById('reportForm');
    if (!dlg || !form || !REPORT_ENDPOINT) return;
    form.action = REPORT_ENDPOINT;
    const setVal = (name, v) => { if (form.elements[name]) form.elements[name].value = v; };
    setVal('siteId', site.id);
    setVal('siteName', site.name);
    const title = document.getElementById('reportSiteName');
    if (title) title.textContent = site.name;
    const detail = form.elements.detail;
    if (detail) detail.value = '';
    const msg = document.getElementById('reportDone');
    if (msg) msg.hidden = true;
    if (typeof dlg.showModal === 'function') dlg.showModal();
    else dlg.setAttribute('open', '');
  }

  function initReportDialog() {
    const dlg = document.getElementById('reportDialog');
    const form = document.getElementById('reportForm');
    if (!dlg || !form) return;
    const close = () => {
      if (typeof dlg.close === 'function') dlg.close();
      else dlg.removeAttribute('open');
    };
    document.getElementById('reportCancel')?.addEventListener('click', close);
    dlg.addEventListener('click', (e) => { if (e.target === dlg) close(); });
    // target="_blank"：送出後官網唔會被導走，用戶返到原本個位
    form.addEventListener('submit', () => {
      const msg = document.getElementById('reportDone');
      if (msg) msg.hidden = false;
      setTimeout(close, 300);
    });
  }

  /* ---------- 版號顯示（W1 / V1） ---------- */
  function renderVersion() {
    const badge = document.getElementById('versionBadge');
    const foot = document.getElementById('appVersion');
    if (badge) badge.textContent = `v${APP_VERSION}`;
    if (foot) foot.textContent = APP_VERSION;
  }

  /* ---------- 啟動 ---------- */
  renderVersion();
  initVisitCounter();
  initReportDialog();
  renderWeather();
  renderForecastRegionOptions();
  renderForecast();
  renderWeekendRank();
  if (!SITES.length) {
    document.getElementById('resultCount').textContent = '⚠ 未能載入 data.js，請先執行 node build-data.mjs';
  } else {
    initMap();
    bindEvents();
    renderHeaderStats();
    render();
  }
})();

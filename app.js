/* ===== 香港營地資料庫 — 前端邏輯 ===== */
(function () {
  'use strict';

  const SITES = Array.isArray(window.CAMPSITES) ? window.CAMPSITES : [];
  // 雙版號：package.json / index.html meta / 本常數 / VERSIONS.md 四處要同步（V1）
  const APP_VERSION = '1.2.0';

  const TYPE_META = {
    '露營': { color: '#2e7d32', short: '露' },
    'Glamping': { color: '#ef6c00', short: 'G' },
    '宿營': { color: '#1565c0', short: '宿' },
    '民宿': { color: '#6a1b9a', short: '民' },
  };
  const SIGNAL_ORDER = ['良好', '一般', '微弱', '無'];
  const FAV_KEY = 'hkcamp_favourites';

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
    mapVisible: true,
  };

  const favs = new Set(JSON.parse(localStorage.getItem(FAV_KEY) || '[]'));
  const saveFavs = () => localStorage.setItem(FAV_KEY, JSON.stringify([...favs]));

  /* ---------- 資料衍生選項 ---------- */
  const uniq = (arr) => [...new Set(arr)].filter(Boolean);
  const districts = uniq(SITES.map((s) => s.district));
  const transports = uniq(SITES.flatMap((s) => s.transport));
  const allTags = uniq(SITES.flatMap((s) => [...s.facilities, ...s.tags]));
  const signals = SIGNAL_ORDER.filter((sig) => SITES.some((s) => s.signal === sig));
  const types = Object.keys(TYPE_META).filter((t) => SITES.some((s) => s.type === t));

  /* ---------- 篩選 ---------- */
  function matches(s, skipGroup) {
    if (skipGroup !== 'type' && state.types.size && !state.types.has(s.type)) return false;
    if (skipGroup !== 'district' && state.districts.size && !state.districts.has(s.district)) return false;
    if (skipGroup !== 'transport' && state.transports.size &&
        !s.transport.some((t) => state.transports.has(t))) return false;
    if (skipGroup !== 'tag' && state.tags.size &&
        ![...s.facilities, ...s.tags].some((t) => state.tags.has(t))) return false;
    if (skipGroup !== 'signal' && state.signals.size && !state.signals.has(s.signal)) return false;

    if (skipGroup !== 'price') {
      if (state.freeOnly && s.price !== 0) return false;
      if (!state.freeOnly && s.price > state.maxPrice) return false;
    }
    if (state.favOnly && !favs.has(s.id)) return false;

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
  function makeChip(label, set, value, count) {
    const btn = document.createElement('button');
    btn.className = 'chip';
    btn.type = 'button';
    btn.setAttribute('aria-pressed', set.has(value) ? 'true' : 'false');
    btn.innerHTML = `${label}` + (count != null ? ` <span class="chip-count">${count}</span>` : '');
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
          if (group === 'tag') return [...s.facilities, ...s.tags].includes(v);
          if (group === 'signal') return s.signal === v;
          return false;
        }).length;
        host.appendChild(makeChip(v, set, v, count));
      });
    };

    mount('typeChips', types, state.types, 'type');
    mount('districtChips', districts, state.districts, 'district');
    mount('transportChips', transports, state.transports, 'transport');
    mount('tagChips', allTags, state.tags, 'tag');
    mount('signalChips', signals, state.signals, 'signal');
    document.getElementById('favCount').textContent = favs.size;
    document.getElementById('favToggle').setAttribute('aria-pressed', state.favOnly ? 'true' : 'false');
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
    // 週末降雨概率係全港預測，用右上角一點標示（唔係逐營地實測）
    const dot = WEEKEND_PSR_CLASS
      ? `<i class="weather-dot ${WEEKEND_PSR_CLASS}" title="週末降雨概率（全港）：${WEEKEND_PSR_TEXT}"></i>`
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
      const weatherLine = WEEKEND_PSR_CLASS
        ? `<div class="popup-weather"><i class="weather-dot ${WEEKEND_PSR_CLASS}"></i> 週末降雨概率（全港預測）：${WEEKEND_PSR_TEXT}</div>`
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
      card.innerHTML = `
        <div class="card-top">
          <span class="type-badge type-${s.type}">${s.type}</span>
          <button class="fav-btn" title="加入我的最愛" aria-label="收藏 ${s.name}">${isFav ? '⭐' : '☆'}</button>
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
        ${prepBadges(s)}
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
        </div>`;

      card.querySelector('.fav-btn').addEventListener('click', (e) => {
        favs.has(s.id) ? favs.delete(s.id) : favs.add(s.id);
        saveFavs();
        e.currentTarget.textContent = favs.has(s.id) ? '⭐' : '☆';
        renderFilters();
      });
      card.querySelector('[data-action="locate"]').addEventListener('click', () => flyTo(s.id));
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
      (state.freeOnly ? 1 : 0) + (state.favOnly ? 1 : 0) +
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

    const clearAll = () => {
      state.types.clear(); state.districts.clear(); state.transports.clear();
      state.tags.clear(); state.signals.clear();
      state.freeOnly = false; state.favOnly = false;
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

  /* ---------- 版號顯示（W1 / V1） ---------- */
  function renderVersion() {
    const badge = document.getElementById('versionBadge');
    const foot = document.getElementById('appVersion');
    if (badge) badge.textContent = `v${APP_VERSION}`;
    if (foot) foot.textContent = APP_VERSION;
  }

  /* ---------- 啟動 ---------- */
  renderVersion();
  renderWeather();
  if (!SITES.length) {
    document.getElementById('resultCount').textContent = '⚠ 未能載入 data.js，請先執行 node build-data.mjs';
  } else {
    initMap();
    bindEvents();
    renderHeaderStats();
    render();
  }
})();

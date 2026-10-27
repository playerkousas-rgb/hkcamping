/* ===== 香港營地資料庫 — 前端邏輯 ===== */
(function () {
  'use strict';

  const SITES = Array.isArray(window.CAMPSITES) ? window.CAMPSITES : [];

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
    return L.divIcon({
      className: '',
      html: `<div class="map-pin" style="background:${meta.color}"><span>${meta.short}</span></div>`,
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
      marker.bindPopup(
        `<div class="popup-title">${s.name}</div>
         <div class="popup-meta">${s.type} · ${s.operator || ''} · ${s.district} ${s.area} · ${priceText(s)}</div>
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
    return s.price === 0 ? '免費' : `$${s.price} ${s.priceUnit || ''}`.trim();
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
        <p class="summary">${s.summary}</p>
        <div class="mini-tags">${tags.map((t) => `<span class="mini-tag">${t}</span>`).join('')}</div>
        <div class="card-actions">
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

  /* ---------- 啟動 ---------- */
  if (!SITES.length) {
    document.getElementById('resultCount').textContent = '⚠ 未能載入 data.js，請先執行 node build-data.mjs';
  } else {
    initMap();
    bindEvents();
    renderHeaderStats();
    render();
  }
})();

/**
 * 氣象站座標表（v1.10.0）
 *
 * 來源：香港天文台「氣象站資料」 https://www.hko.gov.hk/tc/cis/stn.htm
 * 緯度／經度由官方度分秒換算成十進制：22°18'07" = 22 + 18/60 + 07/3600 = 22.30194
 *
 * 為咩要座標：v1.9.2 之前用「地區名關鍵字」配站，會撞名 ——
 * 例：大嶼山「大浪灣」命中咗石澳「大浪灣」嘅規則，結果配咗去筲箕灣（37 km 外）。
 * v1.10.0 起一律用「營地座標 → 直線最近嘅站」，規則簡單、可驗證、冇撞名。
 */

const R = 6371; // 地球半徑（km）

/** 兩點直線距離（Haversine） */
export function haversineKm(lat1, lng1, lat2, lng2) {
  const p1 = (lat1 * Math.PI) / 180;
  const p2 = (lat2 * Math.PI) / 180;
  const dp = p2 - p1;
  const dl = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** 喺座標表入面搵最近嘅站；回傳 { name, km } */
export function nearestStation(lat, lng, coords) {
  let best = null;
  for (const [name, p] of Object.entries(coords)) {
    if (!Number.isFinite(p.lat) || !Number.isFinite(p.lng)) continue;
    const km = haversineKm(lat, lng, p.lat, p.lng);
    if (!best || km < best.km) best = { name, km };
  }
  return best;
}

export const round1 = (n) => Math.round(n * 10) / 10;

/**
 * 天文台 rhrread「該區實況」27 個氣溫站（同 conditions.json 嘅 station 名一模一樣）
 * 注意：呢啲係市區／沿岸站，冇山地站（昂坪、大帽山唔在內），所以山區仍然係參考值。
 */
export const HKO_STATION_COORDS = {
  '香港天文台': { lat: 22.30194, lng: 114.17417 },
  '京士柏': { lat: 22.31194, lng: 114.17278 },
  '黃竹坑': { lat: 22.24778, lng: 114.17361 },
  '打鼓嶺': { lat: 22.52861, lng: 114.15667 },
  '流浮山': { lat: 22.46889, lng: 113.98361 },
  '大埔': { lat: 22.44833, lng: 114.17722 },
  '沙田': { lat: 22.4025, lng: 114.21 },
  '屯門': { lat: 22.38583, lng: 113.96417 },
  '將軍澳': { lat: 22.31583, lng: 114.25556 },
  '西貢': { lat: 22.37556, lng: 114.27444 },
  '長洲': { lat: 22.20111, lng: 114.02667 },
  '赤鱲角': { lat: 22.30944, lng: 113.92194 },
  '青衣': { lat: 22.34417, lng: 114.11 },
  '石崗': { lat: 22.43611, lng: 114.08472 },
  '荃灣可觀': { lat: 22.38361, lng: 114.10778 },
  '荃灣城門谷': { lat: 22.37556, lng: 114.12667 },
  '香港公園': { lat: 22.27833, lng: 114.16222 },
  '筲箕灣': { lat: 22.28167, lng: 114.23611 },
  '九龍城': { lat: 22.335, lng: 114.18472 },
  '跑馬地': { lat: 22.27056, lng: 114.18361 },
  '黃大仙': { lat: 22.33944, lng: 114.20528 },
  '赤柱': { lat: 22.21417, lng: 114.21861 },
  '觀塘': { lat: 22.31861, lng: 114.22472 },
  '深水埗': { lat: 22.33583, lng: 114.13694 },
  '啟德跑道公園': { lat: 22.305, lng: 114.21694 },
  '元朗公園': { lat: 22.44083, lng: 114.01833 },
  '大美督': { lat: 22.47528, lng: 114.2375 },
};

/**
 * 天文台「自動分區天氣預報」(OCF) 12 個站嘅官方位置（同上面一樣出自 stn.htm）。
 *
 * ⚠ 注意：OCF 原始檔（ocf-forecast.json）自己帶嘅 Latitude/Longitude 唔可靠 ——
 * 佢將「西貢（SEK）」寫成 22.436, 114.085，其實係「石崗」站嘅位置（差 20 公里），
 * 所以配站一律用呢張表，唔用快照入面嘅座標。
 *
 * 註：天文台仲有「昂坪（NGP）」站（22.259, 113.913），但只有氣溫、冇降雨概率，
 * 所以唔可以參加呢個「落雨」配對。
 */
export const OCF_STATION_COORDS = {
  TKL: { lat: 22.52861, lng: 114.15667 }, // 打鼓嶺
  TPO: { lat: 22.44833, lng: 114.17722 }, // 大埔（元洲仔）
  SEK: { lat: 22.37556, lng: 114.27444 }, // 西貢
  SHA: { lat: 22.4025, lng: 114.21 },      // 沙田
  TWN: { lat: 22.38361, lng: 114.10778 },  // 荃灣
  LFS: { lat: 22.46889, lng: 113.98361 },  // 流浮山
  TUN: { lat: 22.38583, lng: 113.96417 },  // 屯門
  CCH: { lat: 22.20111, lng: 114.02667 },  // 長洲
  SKW: { lat: 22.28167, lng: 114.23611 },  // 筲箕灣
  HKS: { lat: 22.24778, lng: 114.17361 },  // 黃竹坑
  JKB: { lat: 22.31583, lng: 114.25556 },  // 將軍澳
  HKO: { lat: 22.30194, lng: 114.17417 },  // 香港天文台
};

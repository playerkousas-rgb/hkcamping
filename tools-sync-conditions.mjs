/**
 * tools-sync-conditions.mjs — 該區天氣 + 潮汐官方快照
 *
 * 資料源（全部 keyless，香港天文台 open data；已實測 2026-10-27）：
 *   1. weather.php?dataType=rhrread&lang=tc
 *      → 本港地區天氣報告：27 個自動氣象站氣溫 + 18 區過去一小時雨量 + 濕度/UV/警告
 *   2. opendata.php?dataType=HLT&station=XXX&year=YYYY&month=M&rformat=json
 *      → 天文漲潮和退潮的時間和高度（HKO 已計好，唔使自己用調和常數估）
 *
 * 站點只用仲運作嘅 8 個（官方網頁標明 CMW 芝麻灣 1997 關閉、LOP 樂安排 1999 關閉，
 * 該兩站預測誤差較大，故不採用）。
 *
 * 設計原則（來源隔離）：只寫 data/auto/conditions.json，絕不改 data.csv。
 * 用法：node tools-sync-conditions.mjs
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const AUTO_DIR = join(dirname(fileURLToPath(import.meta.url)), 'data', 'auto');
mkdirSync(AUTO_DIR, { recursive: true });

const WEATHER_URL = 'https://data.weather.gov.hk/weatherAPI/opendata/weather.php?dataType=rhrread&lang=tc';
const OPENDATA = 'https://data.weather.gov.hk/weatherAPI/opendata/opendata.php';
const HEADERS = { 'User-Agent': 'hk-camp-db-sync/1.2' };

// 8 個仍運作嘅潮汐站（code → 中文名 + 大概覆蓋範圍）
export const TIDE_STATIONS = {
  QUB: '鰂魚涌',
  KLW: '高流灣',
  TPK: '大埔滘',
  CCH: '長洲',
  SPW: '石壁',
  TAO: '大澳',
  CLK: '赤鱲角東',
  TBT: '尖鼻咀',
};

async function getJson(url) {
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`HTTP ${res.status} — ${url}`);
  return res.json();
}

/**
 * HLT 每行：["MM","DD","HHmm","h","HHmm","h","HHmm","h","HHmm","h"]
 * 高低潮交替；第一個同第二個比較即可判定邊個係高潮，之後交替。
 */
function parseHltRow(row) {
  const [, day, ...pairs] = row;
  const events = [];
  for (let i = 0; i < pairs.length; i += 2) {
    const time = pairs[i];
    const height = pairs[i + 1];
    if (!time || height === '') continue;
    events.push({
      time: `${time.slice(0, 2)}:${time.slice(2)}`,
      height: Number(height),
    });
  }
  if (!events.length) return { day, events: [] };
  // 判定第一個係高定低：同第二個比較；只有一個時用絕對高度（>1.5m 當高潮）
  const firstIsHigh = events.length > 1
    ? events[0].height > events[1].height
    : events[0].height > 1.5;
  events.forEach((e, i) => { e.type = (i % 2 === 0) === firstIsHigh ? 'H' : 'L'; });
  return { day, events };
}

async function fetchTides(year, month, code) {
  const url = `${OPENDATA}?dataType=HLT&station=${code}&year=${year}&month=${month}&rformat=json`;
  const json = await getJson(url);
  const out = {};
  for (const row of (json.data || [])) {
    const { day, events } = parseHltRow(row);
    if (events.length) out[`${year}-${String(month).padStart(2, '0')}-${day}`] = events;
  }
  return out;
}

try {
  console.log('抓取天文台本地天氣報告（rhrread）…');
  const rhr = await getJson(WEATHER_URL);

  const districtWeather = {
    source: WEATHER_URL,
    updateTime: rhr.updateTime || null,
    recordTime: rhr.temperature?.recordTime || null,
    rainfallPeriod: {
      start: rhr.rainfall?.startTime || null,
      end: rhr.rainfall?.endTime || null,
    },
    // 18 區過去一小時雨量（mm）
    rainfall: (rhr.rainfall?.data || []).map((d) => ({ district: d.place, mm: d.max })),
    // 27 個自動氣象站一分鐘平均氣溫（°C）
    temperature: (rhr.temperature?.data || []).map((d) => ({ station: d.place, c: d.value })),
    humidity: (rhr.humidity?.data || []).map((d) => ({ station: d.place, percent: d.value })),
    uv: rhr.uvindex?.data || [],
    warningMessage: rhr.warningMessage || '',
    icon: rhr.icon || [],
  };

  const now = new Date();
  const hkNow = new Date(now.getTime() + 8 * 3600 * 1000);
  const year = hkNow.getUTCFullYear();
  const month = hkNow.getUTCMonth() + 1;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;

  console.log(`抓取 ${year}/${month} 同 ${nextYear}/${nextMonth} 潮汐（8 站）…`);
  const tides = {
    source: `${OPENDATA}?dataType=HLT&station=<code>&year=<year>&month=<month>&rformat=json`,
    fetchedAt: now.toISOString(),
    stations: {},
  };
  for (const [code, name] of Object.entries(TIDE_STATIONS)) {
    const cur = await fetchTides(year, month, code).catch((e) => {
      console.warn(`  ⚠ ${code} ${year}/${month} 失敗：${e.message}`); return {};
    });
    const nxt = await fetchTides(nextYear, nextMonth, code).catch((e) => {
      console.warn(`  ⚠ ${code} ${nextYear}/${nextMonth} 失敗：${e.message}`); return {};
    });
    tides.stations[code] = { name, days: { ...cur, ...nxt } };
    console.log(`  ✅ ${code} ${name}：${Object.keys(tides.stations[code].days).length} 日`);
  }

  const out = {
    fetchedAt: now.toISOString(),
    districtWeather,
    tides,
  };
  writeFileSync(join(AUTO_DIR, 'conditions.json'), JSON.stringify(out, null, 2));
  console.log(`✅ 已寫入 data/auto/conditions.json（${districtWeather.rainfall.length} 區雨量／${districtWeather.temperature.length} 站氣溫／8 潮汐站）`);
} catch (e) {
  console.error('❌ 該區天氣／潮汐同步失敗，保留舊快照：', e.message);
  process.exit(1);
}

/**
 * tools-sync-ocf.mjs — 天文台「自動分區天氣預報」(OCF) 九日快照
 *
 * 資料源（2026-10-27 實測）：
 *   https://maps.weather.gov.hk/ocf/dat/<StationCode>.xml
 *   檔名係 .xml 但內容其實係 JSON，內含：
 *     - DailyForecast[]：未來 9–10 日嘅 ForecastChanceOfRain／ForecastDailyWeather／
 *       ForecastMaximumTemperature／ForecastMinimumTemperature
 *     - HourlyWeatherForecast[]：逐小時溫度／濕度／風向／風速
 *
 * 官方說明（https://maps.weather.gov.hk/ocf/help_e.html）：
 *   - 多模型共識預報系統，輸出會先用香港及珠三角氣象站觀測數據校正，
 *     再按各模型過往表現加權合成。
 *   - 每日更新兩次（約中午同午夜）。
 *   - PoP 分六級：<10%、20%、40%、60%、80%、>90%，誤差約 10 次／100 次。
 *   - ⚠️ 呢個係「電腦自動生成、未經人手修訂」嘅預報，可能同天文台正式預報
 *     或個別站點實測唔同。前端必須標明「僅供參考，以天文台正式預報為準」。
 *
 * 站點 code 係實測有效嘅 12 個；CLK／WCH／CLC／PNG 已證實 404，唔好用。
 * TWN（荃灣）／SKW（筲箕灣）只有溫度，冇降雨概率同天氣圖標 → 容錯留 null。
 *
 * 設計原則（來源隔離）：只寫 data/auto/ocf-forecast.json，絕唔改 data.csv。
 * 用法：node tools-sync-ocf.mjs
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const AUTO_DIR = join(dirname(fileURLToPath(import.meta.url)), 'data', 'auto');
mkdirSync(AUTO_DIR, { recursive: true });

const BASE = 'https://maps.weather.gov.hk/ocf/dat';
const HEADERS = { 'User-Agent': 'hk-camp-db-sync/1.3' };

/** code → 中文名 + 大概座標（座標取自 OCF JSON 本身） */
export const OCF_STATIONS = {
  TKL: '打鼓嶺', TPO: '大埔', SEK: '西貢', SHA: '沙田',
  TWN: '荃灣', LFS: '流浮山', TUN: '屯門', CCH: '長洲',
  SKW: '筲箕灣', HKS: '黃竹坑', JKB: '將軍澳', HKO: '香港天文台',
};

const rainToPct = (s) => {
  if (s == null || s === '') return null;
  const v = String(s).trim();
  if (v.startsWith('<')) return 5;      // "< 10%"
  if (v.startsWith('>')) return 95;     // "> 90%"
  const n = Number(v.replace('%', ''));
  return Number.isFinite(n) ? n : null;
};

function parseStation(code, raw) {
  const daily = (raw.DailyForecast || []).map((d) => {
    const date = String(d.ForecastDate || '');
    return {
      date: date.length === 8 ? `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}` : date,
      rainPct: rainToPct(d.ForecastChanceOfRain),
      rainLabel: d.ForecastChanceOfRain ?? null,
      weather: Number.isFinite(d.ForecastDailyWeather) ? d.ForecastDailyWeather : null,
      max: Number.isFinite(d.ForecastMaximumTemperature) ? d.ForecastMaximumTemperature : null,
      min: Number.isFinite(d.ForecastMinimumTemperature) ? d.ForecastMinimumTemperature : null,
    };
  }).filter((d) => d.date);

  // 逐小時只保留每日 08:00 / 14:00 / 20:00 三個代表時段，慳位又夠用
  const hourly = (raw.HourlyWeatherForecast || [])
    .filter((h) => /08$|14$|20$/.test(String(h.ForecastHour || '')))
    .map((h) => ({
      hour: String(h.ForecastHour),
      temp: Number.isFinite(h.ForecastTemperature) ? h.ForecastTemperature : null,
      rh: Number.isFinite(h.ForecastRelativeHumidity) ? h.ForecastRelativeHumidity : null,
      wind: Number.isFinite(h.ForecastWindSpeed) ? h.ForecastWindSpeed : null,
      weather: Number.isFinite(h.ForecastWeather) ? h.ForecastWeather : null,
    }));

  return {
    code,
    name: OCF_STATIONS[code] || code,
    lat: raw.Latitude ?? null,
    lng: raw.Longitude ?? null,
    modelTime: raw.ModelTime ?? null,
    lastModified: raw.LastModified ?? null,
    daily,
    hourly,
  };
}

async function fetchStation(code) {
  const url = `${BASE}/${code}.xml`;
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  // 官方檔名係 .xml 但內容係 JSON；有時會包一層 ```json 標記，剝走
  const cleaned = text.replace(/^\s*```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
  const json = JSON.parse(cleaned);
  if (!json || !Array.isArray(json.DailyForecast)) {
    throw new Error('回應冇 DailyForecast（可能係 Error Page）');
  }
  return parseStation(code, json);
}

try {
  console.log('抓取天文台 OCF 自動分區九日預報…');
  const stations = {};
  const failed = [];
  for (const code of Object.keys(OCF_STATIONS)) {
    try {
      const st = await fetchStation(code);
      stations[code] = st;
      console.log(`  ✅ ${code} ${st.name}：${st.daily.length} 日`);
    } catch (e) {
      failed.push(`${code}(${e.message})`);
      console.warn(`  ⚠ ${code} 失敗：${e.message}`);
    }
  }

  // fail-closed：成功站點太少就當失敗，保留舊快照
  if (Object.keys(stations).length < 8) {
    throw new Error(`只得 ${Object.keys(stations).length} 個站成功，低於最低 8 個`);
  }

  const out = {
    fetchedAt: new Date().toISOString(),
    source: `${BASE}/<StationCode>.xml`,
    notes: '天文台自動分區天氣預報（ARWF）：多模型共識 + 本地觀測校正，每日更新兩次；電腦自動生成、未經人手修訂，可能同天文台正式預報唔同。PoP 只表示落雨機會，唔代表雨量／時間／持續時間。',
    officialNotesUrl: 'https://maps.weather.gov.hk/ocf/help_e.html',
    failed,
    stations,
  };
  writeFileSync(join(AUTO_DIR, 'ocf-forecast.json'), JSON.stringify(out, null, 2));
  console.log(`✅ 已寫入 data/auto/ocf-forecast.json（${Object.keys(stations).length} 站）`);
  if (failed.length) console.warn(`⚠ 失敗站點：${failed.join('、')}`);
} catch (e) {
  console.error('❌ OCF 同步失敗，保留舊快照：', e.message);
  process.exit(1);
}

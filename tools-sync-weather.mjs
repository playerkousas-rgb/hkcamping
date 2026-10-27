/**
 * tools-sync-weather.mjs — 香港天文台開放數據快照
 *
 * 全部 keyless（來源：playerkousas-rgb/api 文件庫實測）：
 *   - warnsum：現時天氣警告（風球/暴雨/雷暴/山泥傾瀉等）
 *   - fnd：九天預報，含 PSR 降雨概率（低/中/高）→ 「週末落唔落雨」功能
 *
 * 輸出：data/auto/weather.json（前端可直接讀取，或由 GitHub Actions 定時刷新）
 * 用法：node tools-sync-weather.mjs
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const AUTO_DIR = join(dirname(fileURLToPath(import.meta.url)), 'data', 'auto');
mkdirSync(AUTO_DIR, { recursive: true });

const BASE = 'https://data.weather.gov.hk/weatherAPI/opendata/weather.php';
const headers = { 'User-Agent': 'hk-camp-db-sync/1.0' };

async function getJson(dataType) {
  const res = await fetch(`${BASE}?dataType=${dataType}&lang=tc`, { headers });
  if (!res.ok) throw new Error(`${dataType} HTTP ${res.status}`);
  return res.json();
}

try {
  const [warnsum, fnd] = await Promise.all([getJson('warnsum'), getJson('fnd')]);

  const warnings = Object.values(warnsum || {}).map((w) => ({
    code: w.code,
    name: w.name,
    actionCode: w.actionCode,
  }));

  const forecast = (fnd.weatherForecast || []).map((d) => ({
    date: d.forecastDate,
    week: d.week,
    weather: d.forecastWeather,
    minTemp: d.forecastMintemp?.value,
    maxTemp: d.forecastMaxtemp?.value,
    minRh: d.forecastMinrh?.value,
    maxRh: d.forecastMaxrh?.value,
    icon: d.ForecastIcon,
    psr: d.PSR, // 降雨概率：低 / 中 / 高
    wind: d.forecastWind,
  }));

  // 衍生：未來兩個星期六日的降雨風險（PSR 高=不宜，低=適合）
  const weekend = forecast.filter((d) => ['星期六', '星期日'].includes(d.week)).slice(0, 4);

  const out = {
    source: '香港天文台 open data (data.weather.gov.hk)',
    fetchedAt: new Date().toISOString(),
    hkoUpdateTime: fnd.updateTime,
    activeWarnings: warnings,
    forecast,
    weekendRainRisk: weekend,
  };
  writeFileSync(join(AUTO_DIR, 'weather.json'), JSON.stringify(out, null, 2));
  console.log(`✅ 天氣快照已更新（${forecast.length} 日預報，${warnings.length} 個生效警告）`);
  for (const d of weekend) console.log(`   ${d.date} ${d.week}：${d.weather}（${d.minTemp}-${d.maxTemp}°C，降雨概率：${d.psr}）`);
} catch (e) {
  console.error('❌ 天氣同步失敗，保留舊快照：', e.message);
  process.exit(1);
}

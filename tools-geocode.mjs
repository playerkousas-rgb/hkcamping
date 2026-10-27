/**
 * tools-geocode.mjs — 用 Nominatim 查找營地座標（結果快取到 geocache.json）
 * 用法：node tools-geocode.mjs
 * 遵守 Nominatim 使用政策：每秒最多 1 個請求
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const CACHE_FILE = new URL('./geocache.json', import.meta.url);
const cache = existsSync(CACHE_FILE)
  ? JSON.parse(readFileSync(CACHE_FILE, 'utf8'))
  : {};

const QUERIES = [
  // 名稱, Nominatim 查詢字串
  ['gilwell', 'Gilwell Campsite, Hong Kong'],
  ['pokhong', 'Pok Hong Campsite, Sha Tin, Hong Kong'],
  ['baptist', 'Hong Kong Baptist Assembly, Fanling'],
  ['highrock', 'High Rock Christian Camp, Sha Tin, Hong Kong'],
  ['breakthrough', 'Breakthrough Youth Village, Sha Tin'],
  ['shekpik', 'Shek Pik, Lantau Island, Hong Kong'],
  ['outwardbound', 'Outward Bound Hong Kong, Tai Mong Tsai'],
  ['tungchungcamp', 'Tung Chung, Lantau Island, Hong Kong'],
  ['taitongplk', 'Tai Tong Holiday Camp, Yuen Long'],
  ['skorc', 'Sai Kung Outdoor Recreation Centre, Hong Kong'],
  ['chonghing', 'Chong Hing Water Sports Centre, Sai Kung'],
  ['caritascc', 'Caritas Chan Chun Ha, Cheung Chau'],
  ['lmhv', 'Lady MacLehose Holiday Village, Sai Kung'],
  ['lymp', 'Lei Yue Mun Park, Chai Wan'],
  ['tktorc', 'Tso Kung Tam Outdoor Recreation Centre, Tsuen Wan'],
  ['plkptc', 'Po Leung Kuk Pak Tam Chung Holiday Camp'],
  ['wks', 'Wu Kai Sha Youth Village, Ma On Shan'],
  ['hkfygsk', 'HKFYG Sai Kung Outdoor Training Camp'],
  ['puio', 'Pui O Campsite, Lantau'],
  ['tpc', 'Tung Ping Chau, Hong Kong'],
  ['leadmine', 'Lead Mine Pass, Hong Kong'],
  ['cheungsheung', 'Cheung Sheung, Sai Kung, Hong Kong'],
  ['wantsai', 'Wan Tsai, Hoi Ha, Sai Kung'],
  ['taimongtsai', 'Tai Mong Tsai, Sai Kung, Hong Kong'],
  ['shamchung', 'Sham Chung, Sai Kung'],
  ['yuntun', 'Ngong Ping, Ma On Shan, Hong Kong'],
  ['paklap', 'Pak Lap, Sai Kung, Hong Kong'],
  ['hamtin', 'Ham Tin Wan, Sai Kung'],
  ['fanlau', 'Fan Lau, Lantau'],
  ['mancheungpo', 'Man Cheung Po, Lantau'],
  ['ngongpingl', 'Ngong Ping, Lantau Island'],
  ['shaplong', 'Shap Long, Lantau'],
  ['pakfutin', 'Pak Fu Tin, Lantau'],
  ['samachung', 'Sam A Chung, Plover Cove'],
  ['chungpui', 'Chung Pui, Tai Po'],
  ['konghaau', 'Plover Cove Reservoir, Tai Po'],
  ['twisk', 'Route Twisk, Tai Mo Shan'],
  ['hoiha', 'Hoi Ha Wan, Sai Kung'],
  ['polin', 'Po Lin Monastery, Ngong Ping'],
];

async function geocode(q) {
  const url = 'https://nominatim.openstreetmap.org/search?' +
    new URLSearchParams({ q, format: 'json', limit: 1 });
  const res = await fetch(url, { headers: { 'User-Agent': 'hk-camp-db-research/1.0 (research)' } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${q}`);
  const data = await res.json();
  return data[0] ? { lat: Number(data[0].lat), lng: Number(data[0].lon), name: data[0].display_name } : null;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

for (const [key, q] of QUERIES) {
  if (cache[key]) { console.log(`skip ${key} (cached)`); continue; }
  process.stdout.write(`querying ${key} ... `);
  try {
    const result = await geocode(q);
    cache[key] = result;
    console.log(result ? `${result.lat},${result.lng}` : 'NO MATCH');
  } catch (e) {
    console.log('ERROR', e.message);
    cache[key] = null;
  }
  writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
  await sleep(1100);
}
console.log('\n===== geocache.json 已更新 =====');

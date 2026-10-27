/**
 * tools-geocode2.mjs — 第二批：改用中文名稱 / 更精準詞組
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const CACHE_FILE = new URL('./geocache.json', import.meta.url);
const cache = existsSync(CACHE_FILE) ? JSON.parse(readFileSync(CACHE_FILE, 'utf8')) : {};

const QUERIES = [
  ['pokhong2', '博康營地 沙田'],
  ['baptist2', '香港浸會園 粉嶺'],
  ['highrock2', '靈基營 沙田'],
  ['shekpik2', '石壁 大嶼山'],
  ['tungchung2', '香港遊樂場協會東涌戶外康樂營'],
  ['taitong2', '大棠山道 元朗'],
  ['caritas2', '明愛陳震夏郊野學園 長洲'],
  ['plkptc2', '保良局北潭涌度假營'],
  ['wks2', '烏溪沙青年新村'],
  ['hkfygsk2', '香港青年協會賽馬會西貢戶外訓練營'],
  ['cheungsheung2', '嶂上 西貢'],
  ['wantsai2', '灣仔半島 西貢'],
  ['shamchung2', '深涌 西貢'],
  ['samachung2', '三椏村 船灣'],
  ['chonghing2', '創興水上活動中心'],
  ['pakfutin2', '白富田 大嶼山'],
  ['ngongpingmos2', '昂平 馬鞍山'],
  ['paklap2', '白臘村 萬宜水庫'],
  ['hoiha2', '海下灣 西貢'],
  ['twisk2', '荃錦營地 大帽山'],
  ['shaplong2', '十塱 貝澳'],
  ['mancheungpo2', '萬丈布 昂坪'],
  ['chungpui2', '涌背 汀角路'],
  ['konghaau2', '降下坳 大美督'],
  ['taimongtsai2', '大網仔營地 西貢'],
  ['redcross2', '香港紅十字會石壁營'],
  ['plktt2', '保良局賽馬會大棠渡假村'],
];

async function geocode(q) {
  const url = 'https://nominatim.openstreetmap.org/search?' +
    new URLSearchParams({ q, format: 'json', limit: 1 });
  const res = await fetch(url, { headers: { 'User-Agent': 'hk-camp-db-research/1.0 (research)' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return data[0] ? { lat: Number(data[0].lat), lng: Number(data[0].lon), name: data[0].display_name } : null;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

for (const [key, q] of QUERIES) {
  process.stdout.write(`${key} ... `);
  try {
    const result = await geocode(q);
    cache[key] = result;
    console.log(result ? `${result.lat},${result.lng} | ${result.name.slice(0, 60)}` : 'NO MATCH');
  } catch (e) {
    console.log('ERROR', e.message);
    cache[key] = null;
  }
  writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
  await sleep(1150);
}
console.log('done');

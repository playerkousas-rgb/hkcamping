/**
 * tools-geocode3.mjs — 第三批：漁護署 41 營地名稱逐一查詢 + 補漏
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const CACHE_FILE = new URL('./geocache.json', import.meta.url);
const cache = existsSync(CACHE_FILE) ? JSON.parse(readFileSync(CACHE_FILE, 'utf8')) : {};

const QUERIES = [
  ['a01', '流水響營地'], ['a02', '鶴藪營地'], ['a03', '涌背營地'], ['a04', '三椏涌營地'],
  ['a05', '東平洲營地'], ['a06', '灣仔南營地'], ['a07', '灣仔西營地'], ['a08', '嶂上營地'],
  ['a09', '猴塘溪營地'], ['a10', '大灘營地'], ['a11', '黃石營地'], ['a12', '北潭凹營地'],
  ['a13', '西灣營地 西貢'], ['a14', '浪茄灣營地'], ['a15', '白臘營地'], ['a16', '元五墳營地'],
  ['a17', '曝罟灣營地'], ['a18', '怡庭營地'], ['a19', '水浪窩營地'], ['a20', '昂平營地 馬鞍山'],
  ['a21', '東龍洲營地'], ['a22', '鉛礦坳營地'], ['a23', '扶輪公園營地'], ['a24', '荃錦營地'],
  ['a25', '河背營地'], ['a26', '田夫仔營地'], ['a27', '南山營地 大嶼山'], ['a28', '白富田營地'],
  ['a29', '十塱營地'], ['a30', '籮箕灣營地'], ['a31', '石欖洲營地'], ['a32', '大浪灣營地 大嶼山'],
  ['a33', '狗嶺涌營地'], ['a34', '萬丈布營地'], ['a35', '牙鷹角營地'], ['a36', '煎魚灣營地'],
  ['a37', '昂坪營地 大嶼山'], ['a38', '降下坳營地'], ['a39', '石壁營地 大嶼山'],
  ['a40', '鹹田灣營地'], ['a41', '大網仔營地'],
  ['baptist3', '浸會園 粉嶺'],
  ['pokhong3', '香港女童軍總會博康營地'],
  ['plkptc3', '北潭涌度假營'],
  ['caritas_ck', '長洲明愛陳震夏郊野學園'],
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

let matched = 0;
for (const [key, q] of QUERIES) {
  process.stdout.write(`${key} (${q}) ... `);
  try {
    const result = await geocode(q);
    cache[key] = result;
    if (result) { matched++; console.log(`${result.lat},${result.lng} | ${result.name.slice(0, 70)}`); }
    else console.log('NO MATCH');
  } catch (e) {
    console.log('ERROR', e.message);
    cache[key] = null;
  }
  writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
  await sleep(1150);
}
console.log(`\nmatched ${matched}/${QUERIES.length}`);

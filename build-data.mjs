/**
 * build-data.mjs
 * 把 data.csv 轉換成網站使用的 data.js
 * 用法：node build-data.mjs
 *
 * 工作流程：
 *   1. 用 Excel / Google Sheet 編輯 data.csv
 *   2. 跑 node build-data.mjs
 *   3. commit data.csv 與 data.js，push 到 GitHub，Vercel 自動部署
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CSV_PATH = join(__dirname, 'data.csv');
const OUT_PATH = join(__dirname, 'data.js');

/** 簡易但正確的 CSV parser（支援引號包覆與逗號、雙引號跳脫） */
function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  const pushField = () => {
    row.push(field);
    field = '';
  };
  const pushRow = () => {
    pushField();
    rows.push(row);
    row = [];
  };

  const src = text.replace(/^\uFEFF/, ''); // 去掉 Excel BOM
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      pushField();
    } else if (ch === '\n') {
      pushRow();
    } else if (ch === '\r') {
      // 忽略，等 \n 處理
    } else {
      field += ch;
    }
  }
  if (field.length > 0 || row.length > 0) pushRow();
  return rows;
}

const splitList = (value) =>
  String(value || '')
    .split(/[;；]/)
    .map((s) => s.trim())
    .filter(Boolean);

/**
 * 漁護署官方快照（CSDI）→ 用營地名稱配對，補「判斷唔到」嘅客觀欄位。
 * 呢啲係官方數據，唔係人手估算：水源類型直接影響要唔要自攜食水。
 */
const norm = (s) => String(s || '')
  .replace(/[（(][^）)]*[）)]/g, '')   // 去括號，如「大浪灣營地（大嶼山）」
  .replace(/[()\s]/g, '')
  .replace(/營地$/, '');

const AFCD_PATH = join(__dirname, 'data', 'auto', 'afcd-campsites.json');
const afcdByName = new Map();
if (existsSync(AFCD_PATH)) {
  try {
    const snap = JSON.parse(readFileSync(AFCD_PATH, 'utf8'));
    for (const c of (snap.campsites || [])) {
      afcdByName.set(norm(c.name), {
        siteId: c.siteId || '',
        countryPark: c.countryPark || '',
        waterSource: c.waterSource || '',
        tentSpace: String(c.tentSpace || '').replace(/\s+/g, ' ').trim(),
      });
    }
  } catch (e) {
    console.warn(`⚠ afcd-campsites.json 無法解析，跳過官方欄位：${e.message}`);
  }
}

/**
 * 該區天氣配對（v1.2.0）
 * rhrread 嘅 27 個自動氣象站 + 18 區雨量 → 每個營地按 district / area 配對就近站。
 * 呢個配對係人工策展嘅「就近參考」，唔係營地實測；前端必須標明。
 */
const DISTRICT_STATION = {
  '北區': '打鼓嶺', '大埔區': '大埔', '西貢區': '西貢', '沙田區': '沙田',
  '荃灣區': '荃灣可觀', '元朗區': '元朗公園', '屯門區': '屯門',
  '離島區': '長洲', '東區': '筲箕灣', '南區': '黃竹坑',
};
const AREA_STATION_RULES = [
  ['大美督', '大美督'], ['船灣', '大美督'], ['東平洲', '大美督'],
  ['馬鞍山', '沙田'], ['烏溪沙', '沙田'], ['昂平', '西貢'],
  ['東涌', '赤鱲角'], ['大嶼山昂坪', '赤鱲角'], ['梅窩', '長洲'],
  ['南丫', '長洲'], ['坪洲', '長洲'], ['長洲', '長洲'],
  ['大澳', '赤鱲角'], ['東龍洲', '西貢'], ['赤柱', '赤柱'],
  ['柴灣', '筲箕灣'], ['薄扶林', '黃竹坑'],
  ['大棠', '元朗公園'], ['大帽山', '荃灣可觀'], ['城門', '荃灣城門谷'],
];
const RAIN_ALIAS = {
  '北區': '北區', '大埔區': '大埔', '西貢區': '西貢', '沙田區': '沙田',
  '荃灣區': '荃灣', '元朗區': '元朗', '屯門區': '屯門',
  '離島區': '離島區', '東區': '東區', '南區': '南區',
};

/**
 * 潮汐站配對（v1.2.0）
 * 8 個仍運作嘅 HKO 潮汐站，按 area 關鍵字配對；配唔到就 null（唔顯示潮汐）。
 * 呢個係「就近站參考」，尤其東平洲／西貢東呢類無站地區誤差較大，前端必須標明。
 */
const TIDE_RULES = [
  // 西貢東／糧船灣／萬宜 → 高流灣
  ['浪茄', 'KLW'], ['白腊', 'KLW'], ['鹹田', 'KLW'], ['大浪西', 'KLW'],
  ['萬宜', 'KLW'], ['糧船灣', 'KLW'], ['西貢東', 'KLW'], ['曝罟', 'KLW'],
  ['大浪灣', 'SPW'],
  // 吐露港／大埔／沙田／馬鞍山 → 大埔滘
  ['東平洲', 'TPK'], ['船灣', 'TPK'], ['大美督', 'TPK'], ['荔枝莊', 'TPK'],
  ['汀角', 'TPK'], ['馬鞍山', 'TPK'], ['烏溪沙', 'TPK'], ['海下', 'TPK'],
  ['灣仔半島', 'TPK'], ['猴塘溪', 'TPK'], ['大灘', 'TPK'], ['黃石', 'TPK'],
  // 后海灣／元朗／屯門 → 尖鼻咀
  ['大棠', 'TBT'], ['田夫仔', 'TBT'], ['河背', 'TBT'], ['大欖', 'TBT'],
  // 大嶼山西／南 → 大澳／石壁／赤鱲角東
  ['大澳', 'TAO'], ['煎魚灣', 'TAO'], ['牙鷹角', 'TAO'], ['萬丈布', 'TAO'],
  ['狗嶺涌', 'TAO'], ['昂坪', 'TAO'],
  ['石壁', 'SPW'], ['籮箕灣', 'SPW'], ['芝麻灣', 'SPW'], ['十塱', 'SPW'],
  ['塘福', 'SPW'], ['下長沙', 'SPW'], ['貝澳', 'SPW'], ['南山', 'CCH'],
  ['東涌', 'CLK'], ['䃟石灣', 'CLK'], ['白富田', 'CLK'], ['石欖洲', 'CLK'],
  // 長洲／南丫／坪洲 → 長洲
  ['長洲', 'CCH'], ['南丫', 'CCH'], ['坪洲', 'CCH'], ['梅窩', 'CCH'],
  // 維港兩岸 → 鰂魚涌
  ['柴灣', 'QUB'], ['筲箕灣', 'QUB'], ['赤柱', 'QUB'], ['聖士提反', 'QUB'],
];
function stationFor(obj) {
  for (const [kw, st] of AREA_STATION_RULES) if (obj.area.includes(kw)) return st;
  return DISTRICT_STATION[obj.district] || '香港天文台';
}
function tideStationFor(obj) {
  for (const [kw, code] of TIDE_RULES) if (obj.area.includes(kw)) return code;
  return null;
}

/**
 * OCF 自動分區預報配對（v1.3.0）
 * 12 個 HKO OCF 站（實測有效 code）→ 每個營地按 district / area 配對就近站。
 * 呢個係「就近站參考」，山區／外島同站點可以有明顯差異；前端必須標明。
 */
const OCF_DISTRICT = {
  '北區': 'TKL',    // 打鼓嶺
  '大埔區': 'TPO',  // 大埔
  '西貢區': 'SEK',  // 西貢
  '沙田區': 'SHA',  // 沙田
  '荃灣區': 'TWN',  // 荃灣
  '元朗區': 'LFS',  // 流浮山
  '屯門區': 'TUN',  // 屯門
  '離島區': 'CCH',  // 長洲
  '東區': 'SKW',    // 筲箕灣
  '南區': 'HKS',    // 黃竹坑
};
const OCF_AREA_RULES = [
  ['馬鞍山', 'SHA'], ['烏溪沙', 'SHA'],
  ['將軍澳', 'JKB'], ['飛鵝山', 'JKB'], ['井欄樹', 'JKB'],
  ['東涌', 'TWN'], ['大嶼山昂坪', 'TWN'], ['䃟石灣', 'TWN'],
  ['赤柱', 'HKS'], ['大潭', 'HKS'], ['聖士提反', 'HKS'], ['薄扶林', 'HKS'],
  ['柴灣', 'SKW'], ['大浪灣', 'SKW'],
  ['大棠', 'LFS'], ['大帽山', 'TWN'], ['城門', 'TWN'],
  ['大美督', 'TPO'], ['船灣', 'TPO'], ['東平洲', 'TPO'], ['荔枝莊', 'TPO'],
  ['白沙灣', 'SEK'], ['大網仔', 'SEK'], ['北潭', 'SEK'], ['萬宜', 'SEK'],
];
function ocfStationFor(obj) {
  for (const [kw, code] of OCF_AREA_RULES) if (obj.area.includes(kw)) return code;
  return OCF_DISTRICT[obj.district] || 'HKO';
}

const raw = readFileSync(CSV_PATH, 'utf8');
const [header, ...dataRows] = parseCSV(raw).filter((r) => r.some((c) => c.trim() !== ''));

const seenIds = new Set();
const records = dataRows.map((cols) => {
  const obj = {};
  header.forEach((h, i) => {
    obj[h.trim()] = (cols[i] ?? '').trim();
  });

  if (!obj.id) throw new Error('有資料列缺少 id');
  if (seenIds.has(obj.id)) throw new Error(`id 重複：${obj.id}`);
  seenIds.add(obj.id);

  const lat = Number(obj.lat);
  const lng = Number(obj.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new Error(`「${obj.name}」經緯度無效：${obj.lat},${obj.lng}`);
  }

  // priceSource：free=官方免費 / estimate=約數未核實 / enquiry=面議唔報價
  const priceSource = obj.priceSource || 'estimate';
  if (!['free', 'estimate', 'enquiry', 'official'].includes(priceSource)) {
    throw new Error(`「${obj.name}」priceSource 無效：${priceSource}`);
  }

  const afcd = obj.operator === '漁農自然護理署' ? afcdByName.get(norm(obj.name)) : null;

  return {
    id: obj.id,
    name: obj.name,
    type: obj.type, // 露營 | Glamping | 宿營 | 民宿
    operator: obj.operator || '',
    district: obj.district,
    area: obj.area,
    price: obj.price === '' ? null : Number(obj.price) || 0,
    priceUnit: obj.priceUnit,
    priceSource,
    // 以下 3 個只會喺漁護署 41 個官方營地有值（CSDI 快照），其餘為 null
    siteId: afcd?.siteId || null,
    countryPark: afcd?.countryPark || null,
    waterSource: afcd?.waterSource || null,
    tentSpace: afcd?.tentSpace || null,
    // v1.9.0：裝備要求（全自備／場地提供）同最近補給點（未核實就留空，唔亂填）
    gear: obj.gear || '',
    supply: obj.supply || '',
    // v1.2.0：該區天氣／潮汐配對（就近站，唔係營地實測）
    weatherStation: stationFor(obj),
    rainDistrict: RAIN_ALIAS[obj.district] || null,
    tideStation: tideStationFor(obj),
    ocfStation: ocfStationFor(obj),
    booking: obj.booking === '是',
    bookingUrl: obj.bookingUrl || '',
    infoUrl: obj.infoUrl || '',
    transport: splitList(obj.transport),
    facilities: splitList(obj.facilities),
    tags: splitList(obj.tags),
    signal: obj.signal, // 良好 | 一般 | 微弱 | 無
    lat,
    lng,
    summary: obj.summary,
  };
});

const banner =
  '// 此檔案由 build-data.mjs 自動產生，請勿直接編輯。\n' +
  '// 要改資料請編輯 data.csv，然後執行：node build-data.mjs\n' +
  `// 共 ${records.length} 筆；輸出不含時間戳，確保 CI 唔會出現假變更\n` +
  '// 天氣快照：data/auto/weather.json（每日 Actions 更新後 rebuild）\n\n';

// 天文台快照（data/auto/weather.json）由 build 嵌入 data.js：
// 前端唔使 fetch，直接雙擊 index.html（file://）都睇到週末降雨概率。
const WEATHER_PATH = join(__dirname, 'data', 'auto', 'weather.json');
let weather = null;
if (existsSync(WEATHER_PATH)) {
  try {
    weather = JSON.parse(readFileSync(WEATHER_PATH, 'utf8'));
  } catch (e) {
    console.warn(`⚠ weather.json 無法解析，前端天氣列會隱藏：${e.message}`);
  }
}

// 該區天氣 + 潮汐（data/auto/conditions.json），每日 Actions 更新
const CONDITIONS_PATH = join(__dirname, 'data', 'auto', 'conditions.json');
let conditions = null;
if (existsSync(CONDITIONS_PATH)) {
  try {
    conditions = JSON.parse(readFileSync(CONDITIONS_PATH, 'utf8'));
  } catch (e) {
    console.warn(`⚠ conditions.json 無法解析，該區天氣／潮汐會隱藏：${e.message}`);
  }
}

// 日出日落用純 JS 天文公式喺前端計（sunTimesHKT()，見 app.js），
// 任何年份都用得、零 API、file:// 都行；已用 HKO 官方 SRS 2026 值做驗證錨點。
// 天文台 OCF 自動分區九日預報（data/auto/ocf-forecast.json），每日 Actions 更新
const OCF_PATH = join(__dirname, 'data', 'auto', 'ocf-forecast.json');
let ocf = null;
if (existsSync(OCF_PATH)) {
  try {
    ocf = JSON.parse(readFileSync(OCF_PATH, 'utf8'));
  } catch (e) {
    console.warn(`⚠ ocf-forecast.json 無法解析，九日預報會隱藏：${e.message}`);
  }
}

/* ---------- S5 / S11 瘦身：前端只用一小部分資料，唔好整份快照嵌入 ---------- */
// 前端實際需要：
//   conditions → districtWeather（18 區雨量／氣溫）＋ 潮汐「今日～＋9 日後」
//   ocf        → 每站 daily（九日預報）；hourly 前端完全冇用 → 唔嵌入
//   weather    → 原封不動（本身只有 2KB）
// 視窗用「快照自己嘅 fetchedAt」做基準（唔用 now），否則 --check 一日就會假爆。
const hktDateOf = (iso) => {
  const t = Date.parse(iso || '');
  if (!Number.isFinite(t)) return null;
  return new Date(t + 8 * 3600 * 1000).toISOString().slice(0, 10);
};
const shiftDate = (iso, n) => {
  const [y, m, d] = iso.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d) + n * 86400000);
  return t.toISOString().slice(0, 10);
};

function slimConditions(src) {
  if (!src || typeof src !== 'object') return src;
  const anchor = hktDateOf(src.fetchedAt);
  const out = { fetchedAt: src.fetchedAt, districtWeather: src.districtWeather };
  if (!src.tides || typeof src.tides !== 'object') return out;
  const from = anchor ? shiftDate(anchor, -2) : null;   // 容許少少回看
  const to = anchor ? shiftDate(anchor, 20) : null;     // 九日預報＋週末一定夠
  const stations = {};
  for (const [code, st] of Object.entries(src.tides.stations || {})) {
    const days = {};
    for (const [d, events] of Object.entries(st.days || {})) {
      if (from && to && (d < from || d > to)) continue;
      days[d] = events;
    }
    stations[code] = { name: st.name, days };
  }
  out.tides = { ...src.tides, stations };
  return out;
}

function slimOcf(src) {
  if (!src || typeof src !== 'object') return src;
  const stations = {};
  for (const [code, st] of Object.entries(src.stations || {})) {
    stations[code] = {
      code: st.code, name: st.name, lat: st.lat, lng: st.lng,
      modelTime: st.modelTime, lastModified: st.lastModified,
      daily: st.daily,             // hourly／seed 等前端冇用 → 唔嵌入
    };
  }
  return {
    fetchedAt: src.fetchedAt, source: src.source, notes: src.notes,
    officialNotesUrl: src.officialNotesUrl, stations,
  };
}

const compact = (v) => JSON.stringify(v);

const output =
  banner +
  'window.CAMPSITES = ' + compact(records) + ';\n\n' +
  '// 天文台快照（data/auto/weather.json），由 GitHub Actions 每日更新後 rebuild\n' +
  'window.CAMP_WEATHER = ' + compact(weather) + ';\n\n' +
  '// 該區天氣 + 潮汐（data/auto/conditions.json），每日 Actions 更新\n' +
  'window.CAMP_CONDITIONS = ' + compact(slimConditions(conditions)) + ';\n\n' +
  '// 天文台 OCF 自動分區九日預報（data/auto/ocf-forecast.json），每日 Actions 更新\n' +
  'window.CAMP_OCF = ' + compact(slimOcf(ocf)) + ';\n';

// --check：只比較、唔寫檔，畀 guard / CI 用（F14 / S12）
if (process.argv.includes('--check')) {
  const current = existsSync(OUT_PATH) ? readFileSync(OUT_PATH, 'utf8') : '';
  if (current === output) {
    console.log(`✅ data.js 已同 data.csv 同步（${records.length} 筆）`);
    process.exit(0);
  }
  console.error('❌ data.js 過時或被人手改過，請執行 node build-data.mjs');
  process.exit(1);
}

writeFileSync(OUT_PATH, output, 'utf8');

const byType = records.reduce((acc, r) => {
  acc[r.type] = (acc[r.type] || 0) + 1;
  return acc;
}, {});
console.log(`✅ 成功產生 data.js：${records.length} 筆`, JSON.stringify(byType));

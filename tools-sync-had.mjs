/**
 * tools-sync-had.mjs — 民政總署牌照事務處「持牌酒店及賓館名單」同步
 *
 * 資料源（keyless，每月更新，2026-10 實測）：
 *   1. CSDI GeoJSON（1,807 間，全部含座標＋十八區分區，layer=LLHG）
 *      https://portal.csdi.gov.hk/csdi-webpage/file-api?dataset_id=had_rcd_1639475170528_37262...
 *   2. HAD CSV（含牌照號碼，用作增補）
 *      https://www.hadla.gov.hk/psi/licensed-hotels-and-guesthouses/licensed_hotels_and_guesthouses.csv
 *
 * 設計（沿用來源隔離）：只產生快照＋候選清單＋差異報告，唔改 data.csv。
 * 民宿/Glamping 資料擴充由人審閱候選清單後，先提升入 data.csv。
 *
 * 用法：node tools-sync-had.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const AUTO_DIR = join(ROOT, 'data', 'auto');
mkdirSync(AUTO_DIR, { recursive: true });

const GEOJSON_URL =
  'https://portal.csdi.gov.hk/csdi-webpage/file-api' +
  '?dataset_id=had_rcd_1639475170528_37262&format=geojson&layer_name=LLHG';
const CSV_URL =
  'https://www.hadla.gov.hk/psi/licensed-hotels-and-guesthouses/licensed_hotels_and_guesthouses.csv';

const RURAL_DISTRICTS = new Set(['離島', '西貢', '大埔', '北區', '荃灣', '屯門', '元朗', '沙田', '葵青']);
const LEISURE_RE = /渡假|度假|民宿|露營|營地|營舍|旅舍|村屋/;

// 地址 → 細區（對應資料庫 area 欄位用詞）
const AREA_RULES = [
  ['長洲', ['長洲']],
  ['南丫島', ['南丫', '榕樹灣', '索罟灣']],
  ['大澳', ['大澳']],
  ['梅窩／銀礦灣', ['梅窩', '銀礦灣', '銀鑛灣']],
  ['坪洲', ['坪洲']],
  ['貝澳', ['貝澳']],
  ['東涌', ['東涌']],
  ['昂坪', ['昂坪']],
  ['塘福', ['塘福']],
  ['大嶼山其他', ['大嶼山', '大嶼']],
  ['西貢', ['西貢']],
  ['大埔', ['大埔']],
  ['北區', ['粉嶺', '上水', '沙頭角', '打鼓嶺']],
  ['元朗', ['元朗', '錦田', '八鄉', '大棠']],
  ['荃灣', ['荃灣']],
  ['屯門', ['屯門']],
  ['沙田', ['沙田', '馬鞍山']],
];

function deriveArea(address) {
  for (const [area, kws] of AREA_RULES) {
    if (kws.some((k) => address.includes(k))) return area;
  }
  return '其他';
}

function parseCSV(text) {
  const rows = [];
  let row = [], field = '', inQ = false;
  const pushRow = () => { row.push(field); rows.push(row); row = []; field = ''; };
  for (const ch of text.replace(/^\uFEFF/, '')) {
    if (inQ) {
      if (ch === '"') inQ = false;
      else field += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n') pushRow();
    else if (ch !== '\r') field += ch;
  }
  if (field || row.length) pushRow();
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

/* ---------- 1. 抓 GeoJSON ---------- */
console.log('抓取 CSDI 持牌賓館 GeoJSON …');
const geoRes = await fetch(GEOJSON_URL, { headers: { 'User-Agent': 'hk-camp-db-sync/1.0' } });
if (!geoRes.ok) {
  console.error(`❌ CSDI 回應 ${geoRes.status}，終止（保留舊快照）`);
  process.exit(1);
}
const geo = await geoRes.json();

/* ---------- 2. 抓 CSV 取牌照號碼 ---------- */
console.log('抓取 HAD CSV（牌照號碼增補）…');
const csvRes = await fetch(CSV_URL, { headers: { 'User-Agent': 'hk-camp-db-sync/1.0' } });
if (!csvRes.ok) {
  console.error(`❌ HAD CSV 回應 ${csvRes.status}，終止（保留舊快照）`);
  process.exit(1);
}
const [csvHeader, ...csvLines] = parseCSV(await csvRes.text());
const ci = (name) => csvHeader.indexOf(name);
const licenceByName = new Map();
const licenceByNameAddr = new Map();
for (const line of csvLines) {
  const name = (line[ci('場所名稱')] || '').trim();
  const addr = (line[ci('場所地址')] || '').trim();
  const licence = (line[ci('Licence No.')] || '').trim();
  if (name) {
    licenceByName.set(name, licence);
    licenceByNameAddr.set(`${name}|${addr}`, licence);
  }
}

/* ---------- 3. 正規化 ---------- */
const all = geo.features.map((f) => {
  const p = f.properties;
  const name = (p.NAME_TC || '').trim();
  const address = (p.ADDRESS_TC || '').trim();
  const lat = Number(p.LATITUDE);
  const lng = Number(p.LONGITUDE);
  return {
    objectId: p.OBJECTID,
    name,
    nameEn: (p.NAME_EN || '').trim(),
    address,
    district: (p.SEARCH01_TC || '').trim(),
    area: deriveArea(address),
    phone: (p.NSEARCH02_TC || '').trim(),
    fax: (p.NSEARCH03_TC || '').trim(),
    email: (p.NSEARCH04_TC || '').trim(),
    lat: Number.isFinite(lat) ? lat : null,
    lng: Number.isFinite(lng) ? lng : null,
    licenceNo:
      licenceByNameAddr.get(`${name}|${address}`) || licenceByName.get(name) || '',
    lastUpdate: p.LASTUPDATE || '',
  };
});

const snapshot = {
  source: GEOJSON_URL,
  csvSource: CSV_URL,
  fetchedAt: new Date().toISOString(),
  count: all.length,
  withLicenceNo: all.filter((x) => x.licenceNo).length,
  premises: all,
};
writeFileSync(join(AUTO_DIR, 'had-guesthouses.json'), JSON.stringify(snapshot, null, 2));
console.log(`✅ 全庫快照 data/auto/had-guesthouses.json（${all.length} 間，${snapshot.withLicenceNo} 間有牌照號碼）`);

/* ---------- 4. 候選清單（鄉郊區＋渡假類名稱，剔除大型酒店） ---------- */
const HOTEL_RE = /酒店/;
const candidates = all.filter(
  (x) =>
    RURAL_DISTRICTS.has(x.district) &&
    LEISURE_RE.test(x.name) &&
    !HOTEL_RE.test(x.name) &&
    x.lat !== null
);
// 同名經營者通常持有多個單位牌照（每牌一處所），分組方便人工審閱
const grouped = new Map();
for (const c of candidates) {
  const key = `${c.area}|${c.name}`;
  if (!grouped.has(key)) {
    grouped.set(key, { name: c.name, area: c.area, district: c.district, units: 0, phones: new Set(), licences: [], sample: c });
  }
  const g = grouped.get(key);
  g.units += 1;
  if (c.phone) g.phones.add(c.phone);
  if (c.licenceNo) g.licences.push(c.licenceNo);
}
const groupedList = [...grouped.values()].sort((a, b) => a.area.localeCompare(b.area, 'zh') || b.units - a.units);
writeFileSync(
  join(AUTO_DIR, 'had-candidates.json'),
  JSON.stringify(
    {
      fetchedAt: snapshot.fetchedAt,
      note: '持牌賓館中與戶外/渡假相關的鄉郊候選（已剔除大型酒店），審閱後可提升入 data.csv（type=民宿，座標已備）',
      premisesCount: candidates.length,
      operatorCount: groupedList.length,
      operators: groupedList.map((g) => ({
        name: g.name,
        area: g.area,
        district: g.district,
        units: g.units,
        phones: [...g.phones],
        licences: g.licences,
        sampleLat: g.sample.lat,
        sampleLng: g.sample.lng,
      })),
      premises: candidates,
    },
    null,
    2
  )
);
console.log(`✅ 候選清單 data/auto/had-candidates.json（${groupedList.length} 個經營者／${candidates.length} 個持牌處所）`);

/* ---------- 5. 對照 data.csv ---------- */
const [dataHeaderLine, ...csvDataLines] = parseCSV(readFileSync(join(ROOT, 'data.csv'), 'utf8'));
const dataHeader = dataHeaderLine;
const dataRows = csvDataLines.map((line) => Object.fromEntries(dataHeader.map((h, i) => [h, line[i] ?? ''])));

// 5a. 民宿區域覆蓋：我哋 CSV 每個民宿 area 對應幾多間持牌處所
const minsuRows = dataRows.filter((r) => r.type === '民宿');
const areaCoverage = minsuRows.map((r) => {
  const areaName = r.area;
  const rule = AREA_RULES.find(([a]) => areaName.includes(a) || a.includes(areaName.replace(/區.*/, '')));
  const kws = rule ? rule[1] : [areaName.slice(0, 2)];
  const licensed = all.filter((x) => kws.some((k) => x.address.includes(k)));
  return { area: areaName, ourEntry: r.name, licensedCount: licensed.length, acknowledged: (r.tags || '').includes('合規提示') };
});

// 5b. 營舍/渡假村機構係咪同時持旅館牌照（合規加分項）
// 先剝走機構通稱前綴，用獨有名字部份配對，避免「保良局賽馬會」兩營地撞名
const ORG_PREFIX_RE =
  /^(香港|保良局|賽馬會|救世軍|香港中華基督教青年會|香港基督教女青年會|香港青年協會|香港童軍總會|香港女童軍總會|香港明愛|香港小童群益會|香港傷健協會|香港遊樂場協會|香港青年獎勵計劃|香港浸信會聯會|香港神託會|突破機構|香港紅十字會|香港外展訓練學校|女青年會|青年會|青協|明愛|童軍總會|女童軍總會)+/;
const distinctive = (name) => name.replace(/[（(].*?[）)]/g, '').replace(ORG_PREFIX_RE, '').trim();
const orgLicensed = dataRows
  .filter((r) => r.type === '宿營' || r.type === 'Glamping')
  .map((r) => {
    const key = distinctive(r.name);
    if (key.length < 2) return null;
    // 第一輪：剝前綴後完全相同（避免白普理營呢類同名異機構誤配）
    let hit = all.find((x) => distinctive(x.name) === key);
    // 第二輪：單向包含
    hit ||= all.find((x) => x.name.includes(key));
    return hit ? { ourName: r.name, licensedName: hit.name, licenceNo: hit.licenceNo || '（待補）' } : null;
  })
  .filter(Boolean);

// 5c. 民宿條目嘅合規警號：該區零持牌處所（已標「合規提示」嘅條目視作已確認，唔重複警告）
const complianceWarnings = areaCoverage.filter((x) => x.licensedCount === 0 && !x.acknowledged);

/* ---------- 6. 差異報告 ---------- */
const districtCount = {};
for (const x of all) districtCount[x.district] = (districtCount[x.district] || 0) + 1;
const lines = [
  '# 持牌酒店及賓館同步報告（牌照事務處）',
  '',
  `- 產生時間：${snapshot.fetchedAt}`,
  `- 官方最後更新（LASTUPDATE）：${all[0]?.lastUpdate || '不詳'}`,
  `- 全港持牌處所：${all.length} 間（${snapshot.withLicenceNo} 間已配對牌照號碼）`,
  `- 鄉郊渡假類候選：${groupedList.length} 個經營者／${candidates.length} 個持牌處所（見 had-candidates.json，座標已備可直接入 data.csv）`,
  '',
  '## 十八區分佈',
  '',
  '| 分區 | 持牌數 |', '|---|---|',
  ...Object.entries(districtCount).sort((a, b) => b[1] - a[1]).map(([k, v]) => `| ${k} | ${v} |`),
  '',
  '## 現有民宿分區嘅持牌供應量（合規覆核）',
  '',
  '| data.csv 民宿條目 | 細區 | 該區持牌處所數 |',
  '|---|---|---|',
  ...areaCoverage.map((x) => `| ${x.ourEntry} | ${x.area} | ${x.licensedCount} |`),
  '',
  '## ⚠️ 合規警示',
  '',
  ...(complianceWarnings.length
    ? [
        '以下 data.csv 民宿條目所屬細區喺官方名單中**零持牌處所**，當地標榜「民宿」嘅短期出租單位極可能屬第349章無牌經營，建議改寫為「區內無持牌民宿，住宿請選持牌賓館或營地」：',
        '',
        ...complianceWarnings.map((x) => `- ${x.ourEntry}（${x.area}）`),
      ]
    : ['_所有民宿條目所屬區域均有持牌處所_']),
  '',
  '## 營舍/渡假村同時持有旅館牌照（合規加分）',
  '',
  ...(orgLicensed.length
    ? ['| 資料庫名稱 | 持牌名稱 | 牌照號碼 |', '|---|---|---|',
       ...orgLicensed.map((x) => `| ${x.ourName} | ${x.licensedName} | ${x.licenceNo} |`)]
    : ['_今次無配對到_']),
  '',
  '## 候選明細（按經營者分組，每牌＝一個持牌處所）',
  '',
  `共 ${groupedList.length} 個經營者、${candidates.length} 個持牌處所；已剔除大型酒店。`,
  '',
  '| 細區 | 名稱 | 處所數 | 電話 | 參考座標 |',
  '|---|---|---|---|---|',
  ...groupedList.map(
    (g) => `| ${g.area} | ${g.name} | ${g.units} | ${[...g.phones].join('、') || '—'} | ${g.sample.lat},${g.sample.lng} |`
  ),
  '',
  '> 每個處所嘅完整地址同牌照號碼見 had-candidates.json；提升入 data.csv 時每個處所一列，用參考座標（同一經營者各單位位置接近）。',
  '',
];
lines.push('## 合規提醒', '',
  '- 香港《旅館業條例》第349章：少於連續28天嘅收費住宿須領旅館牌照，無牌經營最高罰50萬及監禁3年',
  '- 資料庫民宿分類只應列出持牌處所；Airbnb 無牌單位唔收錄',
  '- 候選提升流程：從 had-candidates.json 選取 → 複製座標同電話 → 加 row 入 data.csv（type=民宿，operator=民間營運，booking=否）→ node build-data.mjs',
  '');
writeFileSync(join(AUTO_DIR, 'had-diff-report.md'), lines.join('\n'));
const compactCoverage = {};
for (const x of areaCoverage) compactCoverage[x.area] = x.licensedCount;
console.log('📝 報告 data/auto/had-diff-report.md');
console.log('   民宿分區持牌量：', JSON.stringify(compactCoverage));
console.log(`   營舍持牌配對：${orgLicensed.length} 間｜合規警示：${complianceWarnings.length} 個`);

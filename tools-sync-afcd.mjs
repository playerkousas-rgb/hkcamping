/**
 * tools-sync-afcd.mjs — 漁護署 41 營地官方數據同步（CSDI GeoJSON）
 *
 * 資料源（keyless，海外可達，來源：playerkousas-rgb/api 文件庫實測）：
 *   portal.csdi.gov.hk CSDI file-api
 *
 * 設計原則（參考 scout-circulars 的「來源隔離」）：
 *   - 官方欄位（座標、水源、營位規模、郊野公園）→ 寫入 data/auto/，機器專用
 *   - 人工欄位（摘要、標籤、收費、訊號）→ 留在 data.csv，人手維護
 *   - 腳本只產生快照 + 差異報告，絕不直接改 data.csv，由人審閱後決定是否更新
 *
 * 用法：node tools-sync-afcd.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const AUTO_DIR = join(ROOT, 'data', 'auto');
mkdirSync(AUTO_DIR, { recursive: true });

const CSDI_URL =
  'https://portal.csdi.gov.hk/csdi-webpage/file-api' +
  '?dataset_id=afcd_rcd_1635133060194_82554' +
  '&format=geojson&layer_name=Campsites_Campsites_Ext_GDB';

/* ---------- 小工具 ---------- */
const norm = (s) =>
  String(s || '')
    .replace(/[（(][^）)]*[）)]/g, '') // 去掉括號內容，如「大浪灣營地（大嶼山）」
    .replace(/[()\s]/g, '')
    .replace(/營地$/, '');

function haversineM(a, b) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
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

/* ---------- 1. 抓 CSDI ---------- */
console.log('抓取 CSDI 營地 GeoJSON …');
const res = await fetch(CSDI_URL, { headers: { 'User-Agent': 'hk-camp-db-sync/1.0' } });
if (!res.ok) {
  console.error(`❌ CSDI 回應 ${res.status}，終止（保留舊快照）`);
  process.exit(1);
}
const geo = await res.json();
const official = geo.features.map((f) => {
  const p = f.properties;
  return {
    siteId: p.SITE_ID,
    name: p.SITE_NAME_TC,
    nameEn: p.SITE_NAME_EN,
    countryPark: p.COUNTRY_PARK_TC,
    waterSource: p.SOURCE_OF_WATER_TC,
    tentSpace: p.TENT_SPACE_TC,
    lat: f.geometry.coordinates[1],
    lng: f.geometry.coordinates[0],
  };
});

const snapshot = {
  source: CSDI_URL,
  fetchedAt: new Date().toISOString(),
  count: official.length,
  campsites: official,
};
writeFileSync(join(AUTO_DIR, 'afcd-campsites.json'), JSON.stringify(snapshot, null, 2));
console.log(`✅ 快照已寫入 data/auto/afcd-campsites.json（${official.length} 筆）`);

/* ---------- 2. 對照 data.csv ---------- */
const [header, ...lines] = parseCSV(readFileSync(join(ROOT, 'data.csv'), 'utf8'));
const col = (line, name) => line[header.indexOf(name)]?.trim() ?? '';
const csvRows = lines
  .map((line) => Object.fromEntries(header.map((h, i) => [h, line[i] ?? ''])))
  .filter((r) => r.operator === '漁農自然護理署');

const issues = [];
const enrich = [];
const usedOfficial = new Set();

for (const csv of csvRows) {
  const match = official.find((o) => norm(o.name) === norm(csv.name));
  if (!match) {
    issues.push(`⚠ CSV 有但 CSDI 配對唔到：${csv.name}（${csv.id}）`);
    continue;
  }
  usedOfficial.add(match.siteId);
  const drift = haversineM(
    { lat: Number(csv.lat), lng: Number(csv.lng) },
    { lat: match.lat, lng: match.lng }
  );
  if (drift > 100) {
    issues.push(
      `⚠ 座標偏差 ${Math.round(drift)}m：${csv.name} — CSV(${csv.lat},${csv.lng}) → CSDI(${match.lat},${match.lng})`
    );
  }
  enrich.push({
    id: csv.id,
    name: csv.name,
    siteId: match.siteId,
    countryPark: match.countryPark,
    waterSource: match.waterSource,
    tentSpace: match.tentSpace,
    coordDriftM: Math.round(drift),
  });
}
for (const o of official) {
  if (!usedOfficial.has(o.siteId)) issues.push(`⚠ CSDI 有但 CSV 缺少：${o.name}（${o.siteId}）`);
}

/* ---------- 3. 寫差異報告 ---------- */
const report = [
  `# 漁護署營地同步差異報告`,
  ``,
  `- 產生時間：${snapshot.fetchedAt}`,
  `- CSDI 官方營地數：${official.length}｜data.csv 漁護署列數：${csvRows.length}`,
  `- 配對成功：${enrich.length}`,
  ``,
  `## 需跟進事項（${issues.length}）`,
  ...(issues.length ? issues.map((x) => `- ${x}`) : ['✅ 全部營地名稱配對成功，所有座標偏差在 100m 以內']),
  ``,
  `## 官方欄位摘要（水源／營位規模，可供 CSV 加欄位用）`,
  ``,
  `| id | 營地 | 官方編號 | 郊野公園 | 水源 | 營位規模 | 座標偏差 |`,
  `|---|---|---|---|---|---|---|`,
  ...enrich.map((e) =>
    `| ${e.id} | ${e.name} | ${e.siteId} | ${e.countryPark} | ${e.waterSource} | ${e.tentSpace} | ${e.coordDriftM}m |`),
  '',
].join('\n');
writeFileSync(join(AUTO_DIR, 'afcd-diff-report.md', ), report);

console.log(`📝 差異報告：data/auto/afcd-diff-report.md`);
console.log(issues.length ? `\n${issues.join('\n')}` : '\n✅ 對照全部通過，無需跟進');

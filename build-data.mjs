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
import { readFileSync, writeFileSync } from 'node:fs';
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

  return {
    id: obj.id,
    name: obj.name,
    type: obj.type, // 露營 | Glamping | 宿營 | 民宿
    operator: obj.operator || '',
    district: obj.district,
    area: obj.area,
    price: obj.price === '' ? null : Number(obj.price) || 0,
    priceUnit: obj.priceUnit,
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
  `// 產生時間：${new Date().toISOString()}，共 ${records.length} 筆\n\n`;

writeFileSync(
  OUT_PATH,
  banner + 'window.CAMPSITES = ' + JSON.stringify(records, null, 2) + ';\n',
  'utf8'
);

const byType = records.reduce((acc, r) => {
  acc[r.type] = (acc[r.type] || 0) + 1;
  return acc;
}, {});
console.log(`✅ 成功產生 data.js：${records.length} 筆`, JSON.stringify(byType));

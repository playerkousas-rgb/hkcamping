#!/usr/bin/env node
/**
 * audit-data.mjs — 資料矛盾掃描（對應 README「資料用詞表」）
 *
 * 捉嘅係「同一樣嘢幾個寫法」同「欄位自相矛盾」，
 * 呢啲問題 guard 嘅體積／版權檢查捉唔到，但用戶一睇就覺得資料亂。
 *
 * 用法：node scripts/audit-data.mjs [--ci]
 *   exit 0 = 冇 ERROR（WARN 唔算失敗）
 *   exit 1 = 有 ERROR
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/* ---------- 極簡 CSV 解析（處理引號內逗號／分號） ---------- */
function parseCsv(text) {
  const rows = [];
  let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i += 1; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c !== '\r') field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const [head, ...body] = rows.filter((r) => r.length > 1);
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ''])));
}

const records = parseCsv(readFileSync(join(ROOT, 'data.csv'), 'utf8'));
const errors = [];
const warns = [];
const err = (m) => errors.push(m);
const warn = (m) => warns.push(m);
const list = (v) => String(v || '').split(';').filter(Boolean);

/* ---------- 1. 交通用詞：香港再無「地鐵／東鐵」呢啲舊稱，全部係港鐵 ---------- */
const LEGACY_TRANSPORT = ['地鐵', '東鐵', '西鐵', '馬鐵', '輕鐵', '港鐵東鐵', '火車'];
for (const r of records) {
  for (const t of list(r.transport)) {
    if (LEGACY_TRANSPORT.includes(t)) {
      err(`${r.id} ${r.name}：transport「${t}」係舊稱／錯稱，應寫「港鐵」`);
    }
  }
}

/* ---------- 2. 康文署連結：唔可以用舊 CLPSS 預訂入口（會轉駁到其他頁） ---------- */
for (const r of records) {
  if (r.id.startsWith('l')) {
    if (r.bookingUrl && !r.bookingUrl.includes('smartplay.lcsd.gov.hk')) {
      err(`${r.id} ${r.name}：康文署 bookingUrl 應為 SmartPLAY（現 ${r.bookingUrl}）`);
    }
    if (!r.bookingUrl) err(`${r.id} ${r.name}：康文署場地要有 bookingUrl（SmartPLAY）`);
    if (!r.infoUrl.includes('lcsd.gov.hk/tc/')) {
      err(`${r.id} ${r.name}：infoUrl 應指向康文署該場地頁（現 ${r.infoUrl}）`);
    }
  }
  for (const f of ['bookingUrl', 'infoUrl']) {
    const u = r[f];
    if (!u) continue;
    if (u.includes('/clpss/')) err(`${r.id}：${f} 用舊版 CLPSS 路徑（${u}）`);
    if (u.startsWith('http://')) warn(`${r.id}：${f} 用 http（${u}）— 如對方支援 https 應升級`);
  }
}

/* ---------- 3. 設施用詞：同一概念唔可以散成幾個 chip ---------- */
const FACILITY_GROUPS = {
  燒烤設施: ['燒烤', '燒烤爐', '燒烤場', '海景燒烤場'],
  廁所: ['廁所', '洗手間'],              // 沖水廁所（屋企式）
  停車位: ['停車位', '停車場'],
  廚房: ['廚房', '自助廚房'],            // 可以自己煮
  泳池: ['泳池', '室外泳池'],
  攀石: ['攀石牆', '攀岩牆', '攀石場'],
  草地: ['草地', '草坪', '營地草坪'],
  繩網: ['繩網', '繩網陣', '挑戰網陣'],
  球場: ['球場', '籃球場', '足球場'],
};
/* 實質差別大，唔准同任何嘢合併（合併就會誤導用戶） */
const NO_MERGE = {
  旱廁: '得個坑／無沖水，同沖水廁所係兩件事',
  獨立浴室: '民宿屋內私人浴室，同營地公用浴室唔同',
  中央廚房: '通常職員／到會專用，未必畀營友自己煮',
  熱水淋浴: '有熱水沖涼，同「有浴室」唔等於同一件事',
};
// app.js 要用同一張表（避免兩邊走樣）
const app = readFileSync(join(ROOT, 'app.js'), 'utf8');
for (const [group, members] of Object.entries(FACILITY_GROUPS)) {
  if (!app.includes(`'${group}'`)) err(`app.js 設施分組缺「${group}」，前後端用詞表唔一致`);
  const present = members.filter((m) =>
    records.some((r) => [...list(r.facilities), ...list(r.tags)].includes(m)));
  if (!present.includes(group) && present.length && !app.includes(`'${present[0]}'`)) {
    err(`app.js 分組「${group}」未包含「${present[0]}」`);
  }
}
// NO_MERGE：呢幾樣唔可以出現喺任何分組（否則篩選層就會誤導）
for (const [term, why] of Object.entries(NO_MERGE)) {
  for (const [group, members] of Object.entries(FACILITY_GROUPS)) {
    if (members.includes(term)) {
      err(`「${term}」唔准合併入「${group}」（${why}）`);
    }
  }
  const appGroups = (app.match(/const FACILITY_GROUPS = \{[\s\S]*?\n  \};/) || [''])[0];
  if (appGroups.includes(`'${term}'`)) {
    err(`app.js 把「${term}」編入分組（${why}）`);
  }
}
// app.js 嘅 NO_MERGE 清單要同 audit 一致
const appNoMerge = (app.match(/const NO_MERGE = \[([^\]]*)\]/) || [])[1] || '';
for (const term of Object.keys(NO_MERGE)) {
  if (!appNoMerge.includes(`'${term}'`)) err(`app.js NO_MERGE 缺「${term}」`);
}

// 裸寫「燒烤」（唔講爐定場）唔可以再出現喺篩選用嘅 facilities
for (const r of records) {
  if (list(r.facilities).includes('燒烤')) {
    err(`${r.id} ${r.name}：facilities 有裸寫「燒烤」，應寫「燒烤爐」或「燒烤場」`);
  }
}

/* ---------- 4. 欄位自相矛盾 ---------- */
for (const r of records) {
  const p = r.price === '' ? null : Number(r.price);
  if (r.priceSource === 'free' && p !== 0) err(`${r.id}：priceSource=free 但 price=${r.price ?? '空'}`);
  if (r.priceSource === 'free' && r.priceUnit !== '免費') err(`${r.id}：free 但 priceUnit=${r.priceUnit}`);
  if (r.priceSource === 'enquiry' && p !== null) err(`${r.id}：enquiry 但 price=${r.price}`);
  if (r.priceSource === 'estimate' && p === null) err(`${r.id}：estimate 但 price 空`);
  if (r.priceSource === 'official' && p === null) err(`${r.id}：official 但 price 空`);
  if (r.booking === '否' && r.bookingUrl) err(`${r.id}：booking=否 但有 bookingUrl`);
  if (r.booking === '是' && !r.bookingUrl && !r.infoUrl) err(`${r.id}：booking=是 但完全冇連結`);
  if (!['露營', '宿營', 'Glamping', '民宿'].includes(r.type)) err(`${r.id}：type「${r.type}」唔在四類之內`);
  if (r.type === '露營' && list(r.facilities).some((f) => f.includes('冷氣'))) {
    err(`${r.id}：露營場地唔應該有冷氣設施（${list(r.facilities).filter((f) => f.includes('冷氣')).join('、')}）`);
  }
  const lat = Number(r.lat), lng = Number(r.lng);
  if (!(lat > 22.1 && lat < 22.6 && lng > 113.8 && lng < 114.5)) {
    err(`${r.id}：座標 (${r.lat}, ${r.lng}) 唔在香港範圍`);
  }
}

/* ---------- 輸出 ---------- */
console.log('\n=== 資料矛盾掃描 ===');
console.log(`讀取 ${records.length} 筆 data.csv\n`);
if (errors.length) {
  console.log(`❌ ERROR ${errors.length} 項：`);
  errors.forEach((m) => console.log('  - ' + m));
} else {
  console.log('✅ ERROR 0 項');
}
if (warns.length) {
  console.log(`\n⚠️  WARN ${warns.length} 項（唔算失敗）：`);
  warns.slice(0, 12).forEach((m) => console.log('  - ' + m));
  if (warns.length > 12) console.log(`  … 另外 ${warns.length - 12} 項`);
}
process.exit(errors.length ? 1 : 0);

/**
 * 香港營地資料庫 — 報料／更正表單（Google Apps Script）
 *
 * 部署：見同目錄 README.md（5 步）。部署完把 /exec 網址貼落 app.js 嘅 REPORT_ENDPOINT。
 *
 * 設計原則（對照真理倉）：
 *   A — 前端冇任何 secret；呢個 /exec 本身就係公開網址，所以當「公開收集箱」設計。
 *   F — 所有驗證喺呢度（server 側）再做一次；前端 required/maxlength 只係方便，唔算數。
 *   W — 只寫入自己張 Sheet，公開頁面唔會顯示任何未經人手核對嘅內容。
 *
 * 防濫用（呢個係公開端點，一定會有人試）：
 *   1. 蜜罐欄位 hp：真人見唔到，機器人填咗就靜靜丟棄（照樣回「多謝」，唔好教佢點繞過）
 *   2. 長度上限：詳情 500 字、聯絡 60 字
 *   3. 類型白名單
 *   4. 同一個營地 + 同一段內容，10 分鐘內只收一次（CacheService）
 *   5. 公式注入：儲存格開頭係 = + - @ 就前置一個 ' （唔好俾人喺你張 Sheet 執行公式）
 */

var SHEET_NAME = '報料';
var HEADERS = ['時間', '營地ID', '營地名', '類型', '內容', '聯絡', '狀態', '來源'];
var TYPES = ['收費', '設施', '交通', '營業狀態', '預訂', '其他'];
var MAX_DETAIL = 500;
var MAX_CONTACT = 60;

function getSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
  }
  if (sh.getLastRow() === 0) {
    sh.appendRow(HEADERS);
    sh.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}

/** 第一次用先手動跑一次（Apps Script 編輯器 → 揀 setup → 執行） */
function setup() {
  var sh = getSheet_();
  SpreadsheetApp.getActiveSpreadsheet().toast('已準備好工作表：「' + sh.getName() + '」', '完成', 5);
}

/** 清走控制字元、頭尾空白、過長截斷、防公式注入 */
function clean_(v, max) {
  var s = String(v == null ? '' : v);
  s = s.replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim();
  if (max && s.length > max) s = s.slice(0, max);
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  return s;
}

function page_(title, bodyHtml) {
  var html = '<!DOCTYPE html><html lang="zh-HK"><head><meta charset="utf-8">'
    + '<meta name="viewport" content="width=device-width,initial-scale=1">'
    + '<title>' + title + '</title>'
    + '<style>body{font-family:"Noto Sans TC","PingFang HK","Microsoft JhengHei",sans-serif;'
    + 'max-width:520px;margin:12vh auto;padding:0 20px;line-height:1.7;color:#20302a}'
    + 'h1{font-size:1.25rem}a{color:#2e7d32}</style></head><body>'
    + '<h1>' + title + '</h1>' + bodyHtml
    + '</body></html>';
  return HtmlService.createHtmlOutput(html)
    .setTitle(title)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function doPost(e) {
  try {
    var p = (e && e.parameter) || {};

    // 1. 蜜罐：有值就當機器人。照樣扮成功，唔好話佢知被攔。
    if (String(p.hp || '').trim() !== '') {
      return page_('多謝報料', '<p>已收到，我哋會人手核對。</p>');
    }

    var siteId = clean_(p.siteId, 20);
    var siteName = clean_(p.siteName, 80);
    var type = clean_(p.type, 20);
    var detail = clean_(p.detail, MAX_DETAIL);
    var contact = clean_(p.contact, MAX_CONTACT);

    // 2. 必要欄位
    if (!detail) {
      return page_('未送出', '<p>內容係空白，請返上一頁再填一次。</p>');
    }
    if (!/^[a-z]\d{2}$/.test(siteId)) {   // 例如 a01 / l06 / n30
      return page_('未送出', '<p>營地代號格式唔啱，請由網站嘅「✏️ 報料」撳入嚟。</p>');
    }
    if (TYPES.indexOf(type) < 0) type = '其他';

    // 3. 10 分鐘內同一段內容只收一次（雙擊／狂撳／重送）
    var cache = CacheService.getScriptCache();
    var dedupeKey = 'r' + Utilities.base64EncodeWebSafe(
      Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, siteId + '|' + detail)
    ).slice(0, 24);
    if (cache.get(dedupeKey)) {
      return page_('多謝報料', '<p>同一段報料剛剛已經收到，唔使再送多次。</p>');
    }
    cache.put(dedupeKey, '1', 600);

    // 4. 寫入
    var sh = getSheet_();
    sh.appendRow([
      new Date(), siteId, siteName, type, detail, contact, '待處理', clean_(p.from, 20) || 'hkcamping',
    ]);

    // 5. 有得通知就通知（喺「專案設定 → 指令碼屬性」加 NOTIFY_EMAIL 就會發信）
    var notify = PropertiesService.getScriptProperties().getProperty('NOTIFY_EMAIL');
    if (notify) {
      MailApp.sendEmail(notify, '【營地資料庫】新報料：' + siteName,
        type + '｜' + siteName + '（' + siteId + '）\n\n' + detail
        + (contact ? '\n\n聯絡：' + contact : ''));
    }

    return page_('多謝報料 ✅',
      '<p><b>' + siteName + '</b>（' + siteId + '）嘅報料已經收到。</p>'
      + '<p>我哋會人手核對，確認後才更新網站 —— <b>報料唔會即時公開</b>，亦唔會顯示你嘅名。</p>'
      + '<p>呢個分頁可以閂得。</p>');
  } catch (err) {
    // 唔好將錯誤細節掉返去公開頁面（可能含 Sheet 名／帳戶資訊）
    console.error(err);
    return page_('送出失敗', '<p>伺服器忙緊，請遲幾分鐘再試一次。</p>');
  }
}

function doGet() {
  return page_('香港營地資料庫', '<p>呢個網址淨係用嚟接收網站上嘅「✏️ 報料」表單，直接開係冇嘢睇。</p>'
    + '<p>睇資料請返 <a href="https://hkcamping.vercel.app/">hkcamping</a>。</p>');
}

/** 選單：一鍵把「待處理」匯出成 CSV，方便貼落 data.csv */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('報料工具')
    .addItem('匯出待處理做 CSV', 'exportPending_')
    .addItem('初始化工作表', 'setup')
    .addToUi();
}

function exportPending_() {
  var sh = getSheet_();
  var last = sh.getLastRow();
  if (last < 2) {
    SpreadsheetApp.getActiveSpreadsheet().toast('暫時未有報料', '提示', 4);
    return;
  }
  var rows = sh.getRange(2, 1, last - 1, HEADERS.length).getValues()
    .filter(function (r) { return String(r[6]) === '待處理'; });
  if (!rows.length) {
    SpreadsheetApp.getActiveSpreadsheet().toast('冇待處理嘅報料', '提示', 4);
    return;
  }
  var csv = [['時間', '營地ID', '營地名', '類型', '內容', '聯絡']]
    .concat(rows.map(function (r) {
      return r.slice(0, 6).map(function (c) {
        var s = c instanceof Date
          ? Utilities.formatDate(c, 'Asia/Hong_Kong', 'yyyy-MM-dd HH:mm')
          : String(c);
        return '"' + s.replace(/"/g, '""') + '"';
      });
    }))
    .map(function (r) { return r.join(','); })
    .join('\n');
  var file = DriveApp.createFile('營地報料_' + Utilities.formatDate(new Date(), 'Asia/Hong_Kong', 'yyyyMMdd_HHmm')
    + '.csv', csv, MimeType.CSV);
  SpreadsheetApp.getActiveSpreadsheet().toast('已建立：' + file.getName(), '完成', 8);
}

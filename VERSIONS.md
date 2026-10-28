# 版本登記表（V3 — 檔號／內文雙版號）

> 本專案係多檔靜態站，無單一 `app_vX.Y.html`，所以「雙版號」落喺四個位置，
> 由 `scripts/guard.mjs` 自動對照，任何一處唔同步即 FAIL（F14 / F15）。

| 位置 | 寫法 |
|---|---|
| `package.json` | `"version": "X.Y.Z"` |
| `index.html` | `<meta name="version" content="X.Y.Z">` + header 版本徽章 `#versionBadge` |
| `app.js` | `const APP_VERSION = 'X.Y.Z';` + 頁尾 `#appVersion` |
| `VERSIONS.md` | 本表最底嗰列 `| X.Y.Z | … |` |

## 釋出紀錄

| 版本 | 日期 | 重點 | 對應規則 |
|---|---|---|---|
| 0.1.0 | 2026-10-27 | 初版上傳：108 筆營地、CSV → data.js、三支同步腳本、data/auto 首次快照 | — |
| 1.0.0 | 2026-10-27 | P0 補回每日／每月 workflows；P1 dist 產物 + vercel.json；P2 guard/CI/版權/雙版號；P3 天文台週末降雨列 | S / F / A / W / V / G / VL |
| 1.1.0 | 2026-10-27 | 未核實收費一律加「約」+ `priceSource` 欄；join CSDI 官方水源／營位規模／郊野公園落 41 筆營地；「訂營＋出發前準備」清單；價格排序單位警告 | F / A / W / V |
| 1.2.0 | 2026-10-27 | **該區天氣**（rhrread 18 區雨量 + 27 站氣溫配對）、**潮汐**（HLT 8 站官方高低潮）、**日出日落**（純 JS 天文公式，SRS 驗證誤差 ≤3 分鐘）；`tools-sync-conditions.mjs` 每日同步 | S / F / A / W / V |
| 1.3.0 | 2026-10-27 | **未來九日該區預報**（HKO OCF 自動分區天氣預報，12 站 × 10 日降雨概率／溫度／天氣），頂部時間軸 + 卡片面板；`tools-sync-ocf.mjs` 每日同步；加入「自動生成、未經人手修訂」官方免責 | S / F / A / W / V |
| 1.4.0 | 2026-10-27 | **入站人次**（Vercel Web Analytics 全站無 cookie 統計 + 頁尾本機累計）、**週末唔落雨排行**（OCF 分區站降雨概率，地圖 pin 同步）、**我的足跡**（localStorage，可篩選／清除）；README 補「我們平常用的系統」技術棧同台灣營火部落對照；guard 12 項、test 12 項 | S / F / A / W / V |
| 1.4.1 | 2026-10-28 | **修 CI 假失敗**：OCF smoke test 唔再鎖死「10 日／某一日官方實數」（每日 00:30 同步會令快照變 9 日、日期翻新 → main 上 guard CI 紅）；改為驗不變量 + 新增合成快照渲染測試（降雨分級／溫度四捨五入／無 PoP 容錯）；13/13 | F / V |
| 1.5.0 | 2026-10-28 | **瘦身機制（S 系列）落地**：`data.js` 由 396KB → **128KB**、`dist` 由 480KB → **212KB**（-56%）——embed 改 compact JSON、OCF 去掉冇用嘅 hourly／seed、潮汐只保留快照當日 −2 ~ ＋20 日（原本 61 日全嵌）；新增 `scripts/slim-report.mjs`（`npm run slim`）同 guard 第 13 項「瘦身預算」硬攔；`vercel.json` 加 `installCommand`（S3） | S / F / V |
| 1.6.0 | 2026-10-28 | **修資料矛盾（用戶實測發現）**：① 交通舊稱「地鐵／東鐵」→ 統一「港鐵」（香港再無「港鐵東鐵」）② 康文署 6 筆由舊 CLPSS 萬能連結 → SmartPLAY ＋各自場地頁 ③ 設施用詞碎片化（燒烤／燒烤爐／燒烤場等）→ 篩選層收斂為單一 chip（資料層保留官方精確用詞）；新增 `npm run audit`＋guard 第 14 項硬攔；test 16 個 | F / V |
| 1.6.1 | 2026-10-28 | **修正過度合併**：用戶指出旱廁（得個窿、無沖水）同沖水廁所完全兩回事 → 由「廁所」chip 拆返獨立；同理拆返 獨立浴室（民宿私人）／浴室（營地公用）、中央廚房（未必畀營友煮）／廚房；新增 `NO_MERGE` 白名單（audit 會 fail）＋卡片廁所類型徽章（旱廁用警告色） | F / V |
| 1.6.2 | 2026-10-28 | **「一般用戶」角度實測 → 捉到真 bug**：私隱模式／無痕視窗 `localStorage.setItem` 會拋 `SecurityError`，`saveFavs` 冇 try/catch → 一撳「收藏」成個 app 死（`saveFootprints`／入站人次本身有包，係呢個漏咗）；已補。新增 `npm run ui`（`scripts/ui-check.mjs`，jsdom 模擬斷網＋私隱模式＋撳 chip，21 項）；同時跑齊真理倉六角度：`guard` 14/14、`node --test` 18/18、三個變異測試證明守護真係捉得到（旱廁併入廁所／版號唔同步／刪 © SCOUT SYSTEM 全部 FAIL） | F / V |
| 1.6.3 | 2026-10-28 | **頁尾清走開發者字眼**（用戶指正）：刪「資料格式：`data.csv` → `node build-data.mjs` → `data.js`」、「價格與設施資料請於正式發佈前核實」、入站人次的長解釋 span 同其 CSS。頁尾只留 `© SCOUT SYSTEM` + 版號 + 地圖／天氣來源（授權要求）＋入站人次數字 | W / S |
| 1.7.0 | 2026-10-28 | **報料／更正表單**（用戶揀方案 A）：每張卡加「✏️ 報料」→ Google Apps Script（`apps-script/report-form/`）寫入管理員嘅 Sheet，**唔會即時公開**。前端用原生 `<form method="POST" target="_blank">`，**零 fetch／零 key／零 CORS**；GAS 側再做一次驗證（蜜罐、長度、類型白名單、10 分鐘去重、公式注入防護）。`REPORT_ENDPOINT` 留空＝功能隱藏，未部署唔會出死撳鈕。guard 加第 15 項 | A / F / S / V |
| 1.7.1 | 2026-10-28 | **回報改為接入 Scout Admin**（用戶指正：唔想多一套要睇）：刪走自建 GAS（`apps-script/`），改為同圖書館／支部／專章系統**同一個接收端、同一 payload、同一組欄位**（`type/sourceApp/title/desc/severity/troopId/name/contact`），後台多一個「營地資料庫」膠囊。前端只有 1 個 `fetch`（`no-cors`），零 key；guard 第 15 項改為驗 payload 契約（多一個欄位會喺 admin 張 Sheet 自動長出新 column） | A / F / V |
| 1.7.2 | 2026-10-28 | **唔再自寫表單**（用戶指正：表單越多 admin 越難睇）：刪走自寫報料對話框、payload 組裝、`fetch`、卡片報料掣同全部相關 CSS；改為喺 `index.html` 貼 Scout Admin 一行 widget（`data-app="營地資料庫"`），後台照樣靠來源膠囊分。前端回復**零 fetch／零表單**，widget 載入失敗都唔影響網站 | S / F / V |
| 1.7.3 | 2026-10-28 | **「不同用戶身份」實測補齊**（用戶要求報告用咗邊啲身份）：新增 F 無 JS／G 鍵盤＋螢幕報讀／H 老花＋對比度三段，`npm run ui` 28 → **44 項**。順手修三個真問題：① 關咗 JS 只見到「載入中…」→ 加 `<noscript>` 提示同替代方案 ② 篩選結果唔會報讀 → `role="status" aria-live="polite"` ③ 全站冇焦點框、冇 skip link → 加 `:focus-visible` 同「跳去主要內容」；另 `--muted` 由 4.33:1 調深到 4.71:1（WCAG AA 要 4.5）、`#maxPrice` 加 `aria-label` | A / F / W / V |
| 1.8.0 | 2026-10-28 | **八種真人身份實測**（程序員／網頁工程師／外國訪客／小孩／家庭／遠足／童軍／團體）：新增**營位規模篩選**（少於20／20-50／多於50，只有漁護署 41 個有官方數字）、卡片層已顯示水域／營位；手機上所有可撳元素升到 ≥40px（小孩、手指粗、單手用）；標題加英文字幕（外國訪客）；`npm run ui` 加 I–P 八段 → **60+ 項** | A / F / S / V |
| 1.9.0 | 2026-10-28 | **裝備要求 ＋ 補給**（用戶提出）：新增 `gear` 欄（露營 45＝🎒 全自備／宿營民宿 Glamping 63＝🛏 有房有床），卡片加徽章 + 側欄篩選；新增 `supply` 欄（留空＝未核實）＋每張卡「🛒 附近補給」用地圖即時搜 —— **官方冇補給點數據，唔會亂填一個錯地址**。guard 加第 16 項驗規則一致性 | F / A / V |
| 1.9.1 | 2026-10-28 | **補給實測修正**（用戶手機實測報告）：① 撳完「附近補給」入到 Google 地圖見唔到營地喺邊 → 補給格加多一個「📍 營地位置」掣（`/maps/place/<lat>,<lng>` 釘住營地）。Google 地圖一條網址擺唔到「自訂標記＋搜尋」兩樣，所以拆兩個掣。② query 由「超級市場 OR 士多」改為「士多 便利店 雜貨店 ＋ 地區名」（`s.area`），縮放 14→15 —— Google 唔認 `OR`，原本會派中環超市出嚟。guard 第 16 項加三條規則；ui Q 段 7→12 項 | F / A / V |
| 1.9.2 | 2026-10-28 | **補給字眼改用「士多＋餐廳」**（用戶問「用食肆或者商鋪呢？」）：鄉郊士多十間有八間兼做食肆，Google 多數標做 restaurant（例：三椏村發記士多＝`Fat Kee Store & Restaurant`），只搜「士多」會漏咗佢 → `SUPPLY_QUERY_TERMS = ['士多', '餐廳']`；「商鋪」唔用（Google 冇呢個分類，只派市區商場）。同時把 **6 個已喺簡介核實嘅補給點**填入 `supply` 欄（三椏村、嶂上豆花、浪茄灣、籮箕灣「冇商戶」、昂坪市集、鹹田灣） | F / A / V |
| 1.10.0 | 2026-10-28 | **天氣站改用營地座標配對**（用戶指正：唔應該用名字）：新增 `lib/stations.mjs`（27 個氣溫站 + 12 個 OCF 站嘅官方座標，出自天文台「氣象站資料」），全部用 Haversine 揀最近站；每筆資料加 `ocfKm`／`weatherKm`，卡片寫「直線約 X 公里」。修好三個錯配：**大嶼山大浪灣 → 筲箕灣（37 km，撞名）**、東涌 → 荃灣（屯門近 3.7 km）、南丫島 → 長洲（黃竹坑近 1 km）。另發現 OCF 快照自己帶嘅「西貢」座標其實係石崗（差 20 km），改用官方表 | F / A / V |
| 1.11.0 | 2026-10-28 | **App Icon／favicon／PWA**（用戶提出：上架／加主畫面會無圖）：新增 `icons/` 10 個檔（favicon.ico 16/32/48、16px 手繪簡化版、apple-touch-icon 180、Android 192/512、**maskable** 192/512、og-image 1200×630）、`manifest.webmanifest`（standalone + maskable）、`robots.txt`；`index.html` 加 11 個 icon／PWA／OG meta；`build-site.mjs` 會部署 icons；`vercel.json` 加 icons 一年 immutable cache；guard 第 18 項驗尺寸同 manifest 內容；`slim-report` 支援子目錄 | F / S / V |
| 1.11.1 | 2026-10-28 | **maskable icon 縮入安全區**：Android 官方要求 maskable 圖嘅安全區係直徑 **66%**（我第一版用咗 80%）—— 實測預覽見到波浪線貼住圓邊，會被裁走。改為 124/192、330/512 | V |
| 1.12.0 | 2026-10-28 | **彩色露營 Logo**（用戶：『有露營感覺多 D 同唔好得 2 隻色甘單調』）：由平面雙色帳篷改為**日落露營場景** —— 深靛→蜜桃漸變天空、橙黃落日、暗青松樹林、奶白 A 形帳篷、草地綠前景、橙黃營火。全套 10 個圖標重生（16px 仍用手繪簡化版保住三層色），PNG8 壓縮令 dist 由 2.7MB 降至 ~400KB；`og-image` 改為漸變底 + 居中圖標；網站 header 加 56px logo（手機 44px） | F / S / V |

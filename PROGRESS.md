# 項目進度總覽（2026-10-31 更新）

> 本檔係**進度單一真相來源**。技術交接細節見 [GITHUB-SETUP.md](GITHUB-SETUP.md)、
> 體檢對照見 [HANDOVER-STATUS.md](HANDOVER-STATUS.md)、自動化策略見 [AUTOMATION.md](AUTOMATION.md)、
> 版本登記見 [VERSIONS.md](VERSIONS.md)。

## 一、基本資料

| 項目 | 值 |
|---|---|
| Repo | `playerkousas-rgb/hkcamping`（Public） |
| 網站 | 香港露營・宿營・民宿資料庫（純靜態，零 runtime dependencies） |
| 資料量 | **108 筆**（漁護署 41 ＋ 康文署 6 ＋ NGO 30 ＋ Glamping 4 ＋ 民宿 27） |
| 資料合約 | `data.csv` → `node build-data.mjs` → `data.js` → `window.CAMPSITES` |
| 現行版本 | **v1.14.1**（手機按鈕與篩選／排序操作易用性） |
| 工作分支 | `arena/8656b510-hkcamping`（手機操作介面改善） |
| 基準 main | `29a6851`（官方交通整合合併後） |
| 當前 PR | 尚未建立；本分支含手機操作介面改善 |

---

## 最新工作：v1.14.1 手機操作介面改善（2026-10-31）

參照常見 iOS／Android app 的觸控與導覽模式，改善按鈕難點、操作擁擠及選中狀態不清：

- 手機主要互動目標至少 48px；卡片多個操作改為雙欄大按鈕，收藏／足跡圖示有清楚選中態及同步的無障礙名稱。
- 手機快速列改為全寬等分操作列，避開右下回報浮鈕；排序由窄小原生 select 改為底部選項面板，大尺寸即時選取並同步桌面排序。
- 篩選改為有背景遮罩的全屏面板，標題列固定顯示「重設／完成」；加入 Esc 關閉、焦點返回及對話框內焦點循環。
- `npm test` 32/32、`npm run ui` 180/180（A–W）、`npm run guard` 18/18、build-data 同步及 `git diff --check` 全通過。

## 基礎功能：v1.14.0 官方交通整合（2026-10-31）

使用者已批准把官方靜態交通站點／路線接入網站（不包括即時 ETA）。本輪已完成：

- 每週 Actions 抓取運輸署 `JSON_BUS.json`／`JSON_GMB.json`；檢查官方 feed、108/108 營地、座標與快照大小後，自動更新 `data/auto/transit.json`、重建 `transit.js` 並 commit/push；失敗時保留最後成功快照，PR 只驗證不寫入。
- 卡片可展開／收合附近站點、路線、地圖、來源與更新欄位；搜尋支援站名／路線；比較表新增最近巴士／小巴站；可按站點直線距離排序。
- 手機固定快速列提供頁頂、篩選、巴士／小巴快速排序、頁底；過期快照顯示警告。清楚註明直線距離不是步行可達性，沒有即時 ETA。
- 已把交通 workflow 加入 build/publisher 測試、A–W jsdom UI 驗收、Vercel `transit.js` revalidate 標頭及 README／自動化文件。

**端到端發布已驗收**：[首次整合 Actions run `41160349725`](https://github.com/playerkousas-rgb/hkcamping/actions/runs/41160349725) 成功下載兩份官方 feed、配對 108/108 營地、驗證快照並重建部署輸出，自動提交 `8c06166`。原始資料有超長可選英文目的地標籤，已改為只略去該欄、不阻塞快照。其後為符合網站 S7 <1MB 預算，收斂至每種交通最近 2 個站、每站最多 5 條路線，並改用緊湊 JSON；[最終縮小版 run `41160879442`](https://github.com/playerkousas-rgb/hkcamping/actions/runs/41160879442) 全步驟成功，自動提交 `b4d5c32`。目前 `data/auto/transit.json` 451,223 bytes、`transit.js` 451,467 bytes；108/108 營地、BUS 8,216 站／56,103 features、GMB 4,779 站／13,165 features、座標衝突 0。

**本機驗收**：`npm test` 32/32、`npm run ui` 180/180、`npm run guard` 18/18、`git diff --check` 通過。

---

## 二、已合併入 `main` 嘅工作（P0–P3）

| Commit | 內容 | 狀態 |
|---|---|---|
| `2869237` | **P0** 補回每日／每月 GitHub Actions workflows；`build-data.mjs` 去時間戳 + `--check`；修正交接文件過時資料 | ✅ 已合併 |
| `1e11acd` | **P1** `vercel.json`／`.vercelignore`／`build-site.mjs`（dist 產物）／`.gitignore` | ✅ 已合併 |
| `0fe6154` | **P2** `guard.mjs` + `guard.yml` + PR template + dependabot；`© SCOUT SYSTEM` 版權；四處雙版號；smoke test；`HANDOVER-STATUS.md` | ✅ 已合併 |
| `5ae77a8` | **P3** `weather.json` 嵌入 `data.js`；週末天氣列、地圖 pin／popup 降雨圓點、過期提示 | ✅ 已合併 |
| `ab0205e` | 交接文件更新（PR #1／#4 合併狀態、Actions dispatch 403、Dependabot 後續） | ✅ 已合併 |

`main` 上現有 3 條 workflow：`guard`（push／PR／每週一）、`Camp Data Sync`（每日 00:30 HKT）、
`HAD Guesthouse Sync`（每月 2 號 01:15 HKT）。`gh workflow list` 全部 `active`。

---

## 三、PR #5 嘅三個版本（已合併）

### v1.1.0 — `3859e0a`｜收費可信度

用戶質問「價錢點嚟、係咪作出嚟」。查證：`data.csv` 由初始 commit 已有，P0–P3 完全冇改過；
但 **44 筆有銀碼收費係人手估算約數**。

- `data.csv` 加 `priceSource` 欄：`free` 41／`estimate` 44／`enquiry` 23
- 前端未核實收費一律顯示 **「約 $120」** + 橙色警句「未逐筆核實」
- `price: null` 維持「面議／電話查詢」；康文署有官方收費表嘅 6 筆未核實前都標「約」
- 價格排序加「單位各異，僅供參考」警告
- join CSDI **官方** `waterSource`／`tentSpace`／`countryPark` 落 41 筆漁護署營地（41/41 配對成功）
- 新增「🎒 訂營＋出發前準備」清單面板

### v1.2.0 — `f3d0063`｜該區天氣・潮汐・日光

用戶問「該區天氣／潮水／蚊患／日落／寵物」能唔能做到。我實測 5 個政府 API 後，用戶決定
**做 ① 該區天氣 ② 潮汐 ④ 日落；唔做 ③ 蚊患 ⑤ 寵物**。

- **該區天氣**：`rhrread` 18 區過去一小時雨量 + 27 個自動氣象站氣溫；108 筆營地按 `district`／`area` 配對
- **潮汐**：HKO `HLT` 8 站官方高低潮（只用仍運作嘅站；排除 1997／1999 已停嘅芝麻灣／樂安排）；75 個沿岸營地有站
- **日出日落**：純 JS 天文公式（NOAA/SunCalc），零 API、任何年份、`file://` 都用得；用官方 SRS 2026 五個錨點驗證，最大誤差 **3 分鐘**
- 新增 `tools-sync-conditions.mjs` 每日同步 + `data/auto/conditions.json` 初始快照（實測真實官方數據）
- **蚊患**：CSDI 圖層實測 `PERIOD=2021-09`（5 年前舊數據），最新只喺新聞稿 HTML → 唔做，避免誤導
- **寵物**：法例清晰但個別場地規矩冇 API → 唔做，只保留通用法例提示

### v1.3.0 — `8187478`｜官方 OCF 九日該區預報

用戶指出「該區天氣得個實況，**未來預測先重要**」—— 係我嘅盲點。

**查證過程**：
- HKO open data 嘅 `fnd` 九天預報係**全港一個數**；`rhrread` 分區數據全部係**實況** → 官方冇「分區 × 未來多日」JSON API
- 曾評估第三方 **Open-Meteo**：查明係瑞士 OpenMeteo GmbH（開源搬運商，自己冇觀測站冇模型；
  香港得 11–25km 全球粗格仔、冇本地校正；免費 tier 只限非商業）。獨立比較入面佢溫度準確度包尾；
  我實測佢同天文台 10/31 差 2°C、11/1 降雨判斷方向相反 → **決定唔用第三方**
- 最後搵到**天文台官方 OCF（自動分區天氣預報）**嘅逐站點資料檔
  `maps.weather.gov.hk/ocf/dat/<code>.xml`（檔名 `.xml`、內容係 JSON）——多模型共識 + 本地觀測校正，每日更新兩次

**交付**：
- `tools-sync-ocf.mjs` 抓 12 個站 × 10 日預報 → `data/auto/ocf-forecast.json`（初始快照係實測真實官方數據）
- 頂部**九日時間軸**：揀地區、天氣圖標、最高／最低溫、降雨概率（三色）、🌇 日落、🌊 潮汐；週末橙色標記、今日綠框
- 卡片「該區天氣」面板內加九日小表
- 108 筆營地全部配對 OCF 站
- 明確標明「**電腦自動生成、未經人手修訂，可能同天文台正式預報唔同**」，連去正式九天預報
- 荃灣／筲箕灣兩站官方只提供溫度、冇降雨概率 → 顯示「降雨概率 —」，**唔作數**
- `tools-sync-ocf.mjs` fail-closed（成功站點 < 8 就保留舊快照）

### v1.4.0 — 入站人次・週末排行・我的足跡（本輪）

用戶要求：① 檢查專案；② README 要寫清楚「我們平常用的系統」；③ 加最普通嘅入站人數計算；
④ 參考台灣營火部落資料庫睇有冇改善空間。

**交付**：
- **入站人次**：`index.html` 加 Vercel Web Analytics（`/_vercel/insights/script.js`，無 cookie、零 secret）；
  頁尾 `#visitCount` 顯示「你第 N 次到訪（本機紀錄，首次 YYYY-MM-DD）」，用 `localStorage` ＋ `sessionStorage`，
  同一 session 唔重複計。**刻意唔用** CountAPI／hits.sh 之類第三方計數器（可停、可被牆、會交 IP 去第三方）。
- **週末唔落雨排行**：用 OCF 12 個分區站、本週末（六／日）最高降雨概率，由低至高排；
  每行可撳去九日時間軸；地圖 pin 嘅降雨圓點改為**該營地所屬分區站**（之前係全港一個數）。
- **我的足跡**：`localStorage` 記 `{id: {first, last}}`，卡片 👣 一撳標記／取消，側欄可篩選、可清除。
- **README**：新增「我們平常用的系統（技術棧對照）」（Git／Actions／Vercel／Node 零依賴／Leaflet／官方 open data；
  Supabase／GAS／Gemini 明確標「唔適用」）、「入站人次點做」、「台灣參考網站對照」三節。
- **順手修正**：`npm run dev` 改 `python3 -m http.server 8000 --bind 0.0.0.0`（Arena live preview 需要）；
  README 重複嘅 `data/auto` 行、dist 體積（240.7→256.4KB）同步。
- guard 加第 12 項；smoke test 加 3 個（週末排行／足跡／入站人次）→ 12/12。

### v1.4.1 — 修 main 上嘅 CI 假失敗（2026-10-28）

**現象**：PR #6 合併後，`main` 上 guard CI 紅燈（step 5 smoke test），但本機 `npm run guard` 全綠。
**根因**：`scripts/smoke.test.mjs` 寫死咗**種子快照**嘅實數 —— 每站「10 日」、`2026-10-31 SEK 30.4/22.5 20%`、
`LFS '< 10%'`、`scroll.children.length === 10`。但 `sync-data.yml` 每日 00:30 HKT 會翻新快照
（實測變成 9 日、日期由 10-28 起）→ **每逢數據更新，CI 就會無故爆**，屬 F 防呆反例。
**修正**：
- OCF 測試改為驗**不變量**：12 站、≥8 日、日期 ISO 且遞增、降雨 0–100、最高≥最低、
  TWN／SKW 恆為 null；時間軸格數用「最多營地嗰個站」嘅日數，唔再寫死 10
- 新增**合成快照**測試：自建 4 日假快照驗渲染（`< 10%`→適合、40%→帶雨具、60%→唔適宜、
  無 PoP→「降雨概率 —」且唔會當 0、溫度四捨五入、無 PoP 唔會多出過期提示）
- 版號測試改為讀 `package.json` 對照，升版唔再爆
- 已用 `main` **真實 9 日快照**回歸驗證：13/13 綠
- 版本升至 **v1.4.1**（四處同步）

---

### v1.5.0 — 瘦身機制（S 系列）落地（2026-10-28）

用戶問「這 APP 有設定瘦身機制那些吧」→ 逐條對 `docs/01-slim.md` 後**發現真問題**：
`data.js` 由 177KB 脹到 **396KB**（每日同步後），`dist` 479.9KB —— 佔 S6/S7 上限雖然遠，但屬 S11「payload 瘦身」失守。

**三個根因同修法**：
1. 嵌入快照用 `JSON.stringify(x, null, 2)` → 縮排白位佔一半 → 改 compact
2. OCF 連 `hourly` 一齊嵌（前端只用 `daily`）→ 唔再嵌
3. 潮汐嵌晒 8 站 × 61 日 → 只留快照當日 −2 ~ ＋20 日（用 `fetchedAt` 做基準，`--check` 唔會跨日假爆）

**成果**：`data.js` 396.3 → **128.3KB（−68%）**、`dist` 479.9 → **211.9KB（−56%）**、gzip 全站 ≈47KB。
**新機制**：`scripts/slim-report.mjs`（`npm run slim`）＋ guard 第 13 項「瘦身預算」（硬攔 data.js>250KB／dist>1MB／
誤嵌 hourly／死重檔）；`vercel.json` 加 `installCommand`（S3）。
**順手修**：潮汐 smoke test 唔再鎖死 `2026-10-27`（同 v1.4.1 同類問題），改驗結構＋覆蓋範圍。

---

### v1.6.0 — 修資料矛盾（用戶實測發現，2026-10-28）

用戶指出三點，全部證實係真：
1. **「香港已經沒有港鐵東鐵」** → `data.csv` 有 4 筆寫「地鐵」、1 筆寫「東鐵」（n30 青協領袖學院）。
   香港 2007 年兩鐵合併後只有**港鐵**，只分路線（東鐵綫／屯馬綫／東涌綫…）→ 全部統一為「港鐵」。
2. **「康文署的營地不能直連，會轉駁到康文署其他頁面」** → 6 筆 `bookingUrl` 全部係
   `lcsd.gov.hk/clpss/tc/Index.do`（舊 CLPSS 系統入口，已由 SmartPLAY 取代）。
   → 改成 SmartPLAY（`www.smartplay.lcsd.gov.hk`，官方唯一網域）＋ 各自場地頁
   （`p_ng_po`／`p_lymp`／`p_lmhv`／`p_skorc`／`p_tktorc`／創興水上活動中心訂營頁）。
3. **「燒烤／燒烤爐／燒烤場分成 3 樣」** → 確認係篩選層碎片化：撳「燒烤爐」見唔到有「燒烤場」嘅營地，
   睇落就好似「可以燒烤但冇爐冇場」。**資料層保留官方精確用詞，篩選層收斂成一個 chip**
   （燒烤設施 56／廁所 48／攀石 7／繩網 9…），數量用同義詞聯集。同類問題一次過處理：
   停車場、自助廚房、中央廚房、室外泳池、攀岩牆、攀石場、草坪、營地草坪、繩網陣、挑戰網陣。

**新增防呆**：`scripts/audit-data.mjs`（`npm run audit`）——捉舊稱、CLPSS 連結、欄位自相矛盾
（free 但有價／enquiry 但有價／露營有冷氣／booking=否但有 bookingUrl）、座標出界；
guard 加第 14 項「資料一致性」硬攔；smoke test 加 3 個（用詞分組／交通用詞／康文署連結）→ 16 個。

### v1.6.1 — 修正過度合併（用戶指正，2026-10-28）

用戶指出：「廁所和旱廁是很不同的應該要分開。廁所是像屋企那種的，旱廁可能只是有個洞。」
**完全正確，我 v1.6.0 合併錯咗。**

數據核實：`廁所` 32 筆、`旱廁` 16 筆，**零重疊**；16 個旱廁全部係漁護署偏遠露營點
（三椏涌、嶂上、白腊、元五墳、曝罟灣、昂平馬鞍山、白富田、十塱、籮箕灣、石欖洲、
大浪灣大嶼山、狗嶺涌、萬丈布、牙鷹角、煎魚灣、石壁）。

**修法**：
- `廁所` chip 只計沖水廁所（32）；`旱廁` 變獨立 chip（16）
- 同一個原則套落其他「似同義但實質唔同」嘅組：
  `獨立浴室`（民宿私人，5）vs `浴室`（營地公用，1）、
  `中央廚房`（未必畀營友煮，1）vs `廚房`／`自助廚房`（可以自己煮，5）、
  `熱水淋浴`（19）保持獨立
- 新增 `NO_MERGE` 白名單：呢四樣一旦被編入任何分組，`npm run audit` 直接 FAIL
  （已做負向測試：故意把旱廁編入廁所 → 成功捉到）
- **卡片加廁所類型徽章**：`🕳 旱廁（無沖水）` 用警告色 + hover 提示自備水／濕紙巾；
  `🚻 沖水廁所` 普通樣式 → 用戶一眼分得出
- smoke test +2（旱廁與廁所分開、獨立浴室與浴室分開）→ **18 個**

### v1.6.2 — 「程序員」＋「一般用戶」兩種檢測（2026-10-28）

用戶問：「你有用 README 的程序員式和不同用戶的方式檢測嗎？」→ 之前只做咗程序員式，
一般用戶式一直係「等你自己開手機睇」。今次補齊，一補就補出一個真 bug。

**捉到嘅 bug（`app.js`）**：`saveFavs` 直接寫 `localStorage.setItem` 冇包 try/catch。
無痕視窗／私隱模式一撳「收藏」就拋 `SecurityError`，成個 click handler 死 → 按鈕冇反應。
`saveFootprints` 同入站人次本身有包，係呢一個漏咗。已補 3 行。

**新增 `npm run ui`（`scripts/ui-check.mjs`，21 項）**：
- A 斷網：所有 CDN 斷開都仲要 108 張卡、頁尾版權版號、Console 零 error
- B 私隱模式：`localStorage` 一掂就 throw，撳收藏／撳足跡唔可以死
- C 真撳 chip：廁所 32 張、旱廁 16 張、旱廁卡有 🕳
- D 手機：viewport、6 個斷點、chip 識換行

jsdom 只係 **devDependency、要自己裝**，唔入 `dist/`、唔上客戶端；`npm test` 仍然零依賴。

**六角度結果（真理倉 `docs/17`）**：

| 角度 | 結果 |
|---|---|
| ① Vercel | ✅ CI 綠、`regions=hkg1`、`installCommand --include=dev` |
| ② Git | ✅ 無 secret、CI workflow 存在、PR check 全綠 |
| ③ 程序員 | ✅ guard 14/14、test 18/18 |
| ④ 系統架構師 | ✅ 版號四處同步（另有變異測試驗證 guard 捉得到） |
| ⑤ AI Agent | ✅ README／PROGRESS／VERSIONS／HANDOVER 入口齊 |
| ⑥ 一般用戶 | ✅ 21/21（`npm run ui`）；真理倉個 `audit_single_html_v1.0.mjs` 係審**單檔 HTML**，我哋係多檔站，所以「檔名要 `_vX.Y`」同「APP_VERSION 要寫喺 HTML 內」兩條唔適用，其餘用自家 `ui-check` 覆蓋 |

**變異測試（證明守護係真嘅，唔係印個 ✅）**：故意整壞 → ① 旱廁併入廁所（guard FAIL＋2 個 test fail）
② `index.html` 版號改 1.6.0（guard FAIL）③ 刪 `© SCOUT SYSTEM`（guard FAIL）→ 三個全捉到，還原後全綠。

**關於「要唔要防呆」**：呢個 app 冇後端、冇帳號、冇 DB，所以後端類防呆（session／限流／原子寫入／
secret 代理）**一條都冇加，亦唔應該加**。落嘅只有兩種：資料正確性（build／CI 期，0 byte 上線）
同瀏覽器環境差異（私隱模式、斷網，各 3 行）。兩樣加埋都唔會令網站變重。

---

### v1.6.3 — 頁尾清走開發者字眼（2026-10-28）

用戶貼出頁尾三行話「刪走」。呢三行本來係寫畀自己睇嘅，唔應該出現喺公眾頁：

| 刪咗 | 點解 |
|---|---|
| `資料格式：data.csv → node build-data.mjs → data.js` | 開發流程，訪客睇唔明 |
| `價格與設施資料請於正式發佈前核實` | 呢句係**出街前嘅 TODO 提醒**，貼喺公開頁等於同訪客講「呢個站啲資料未核實」 |
| 入站人次後面嗰段長解釋（`（只計呢個瀏覽器…無 cookie 統計）`）＋其 CSS | 太技術；數字本身已經有 `title` 提示 |

**保留**（唔可以刪）：`© SCOUT SYSTEM`、版號、`地圖由 Leaflet + OpenStreetMap 提供`（OSM 授權要求署名）、
`天氣數據由香港天文台提供`（資料來源）、入站人次數字。

---

### v1.7.0 — 報料／更正表單（2026-10-28）

用戶問「如果加 Apps Script 可否加用戶留言？」→ 揀咗**方案 A（報料表單）**，唔係公開留言板。

**點解揀 A**：公開留言要處理公審、私隱、審批、刪除、限流；而個站真正痛點係「呢個場仲有冇燒烤爐／收幾錢」
——要人報料，唔係要人傾偈。A 只寫入管理員自己張 Sheet，網站唔會顯示任何未核對內容。

**做咗乜**：

| 檔案 | 內容 |
|---|---|
| `apps-script/report-form/Code.gs` | `doPost` 收表單、`onOpen` 選單、「匯出待處理做 CSV」；驗證：長度／類型白名單／蜜罐／10 分鐘去重／`= + - @` 公式注入前置單引號 |
| `apps-script/report-form/README.md` | 5 步部署（開 Sheet → 貼碼 → 部署 → 貼網址 → 試一次），加限制表 |
| `app.js` | `REPORT_ENDPOINT` 設定；卡片多一粒「✏️ 報料」；`openReport`／`initReportDialog` |
| `index.html` | `<dialog>` 表單：類型、500 字詳情、聯絡（選填）、蜜罐 `hp`、hidden siteId／siteName |
| `styles.css` | 對話框樣式（44px 以下唔用，用 40px + `min-height`） |

**關鍵取捨：用原生 `<form method="POST" target="_blank">`，唔用 fetch。**
GAS 嘅 `/exec` 回應冇 `Access-Control-Allow-Origin`，用 `fetch` 一定要 `mode:'no-cors'`（送出但讀唔到結果），
或者搞 JSONP。用原生表單就乜都唔使：冇 CORS、冇 key、斷網都會出瀏覽器自己嘅錯誤頁。
代價係開新分頁睇 GAS 嘅「多謝」頁——但官網本身唔會被導走，用戶撳返轉頭就得。

**防呆**：`REPORT_ENDPOINT` 留空 → 全站唔出報料掣（唔會出一個撳完冇反應嘅死掣）。
guard 第 15 項驗：端點格式、前端零 fetch／XHR、蜜罐攔喺兩邊、GAS 有 `doPost`／`CacheService`／公式注入防護。
未接駁時係 **⚠️ WARN 唔係 FAIL**——因為「未部署」係合法狀態。

**驗證**：guard 15/15、test 21/21、`npm run ui` 21/21、dist 221.1KB。

---

### v1.7.1 — 回報改為接入 Scout Admin（2026-10-28）

用戶指正兩件事：① 唔想為呢個站多開一套要睇嘅後台 ② 擔心 GitHub Actions 用得太多。
第二點見下面「資源用量」。第一點直接改咗設計。

**改咗乜**：刪走 `apps-script/report-form/`（自己嗰支 GAS + 自己張 Sheet），
改為送去 **Scout Admin**（`playerkousas-rgb/scout-admin`）——即係圖書館、支部系統、專章系統用緊嗰個接收端。

| 項目 | v1.7.0（自己開） | v1.7.1（接入 admin） |
|---|---|---|
| 後台 | 多一個 Google Sheet 要睇 | 同其他系統同一個後台，多一個「營地資料庫」膠囊 |
| payload | 自己定 | `SCOUT_ADMIN.md §〇` 統一回報格式 v1 |
| 欄位 | `siteId`／`hp` 等自訂 → 會喺 admin Sheet 長出新 column | **只准**契約嗰 8 個，guard 硬性驗 |
| 傳輸 | 原生 form POST（開新分頁） | `fetch` + `no-cors`（同 admin `widget.js` 一致） |
| 程式碼 | 自寫 `Code.gs` ~120 行 | 0 行後端，只係前端 20 行 |

**payload**：`{ type:'issue', sourceApp:'營地資料庫', title:'【設施】流水響營地（a01）', desc:'類型／營地／分區＋用戶輸入', severity:'中', troopId:'', name:'', contact:'' }`
——標題自動帶營地名同代號，你喺後台一眼睇到係邊個場，唔使報料人自己打。

**驗證**：`npm run ui` 加咗第 E 段（34 pass）——真撳報料掣、填詳情、送出，再攔截個 fetch 驗 payload：
型別、來源、8 個欄位、標題格式、端點 URL 全部中。guard 15/15、test 21/21。

**資源用量（回應「會唔會畀 GitHub 覺得濫用」）**：呢個 repo 由開倉到現在 44 次 run、合共 **11.7 分鐘**。
公開 repo 嘅 Actions 分鐘係**無限免費**；估算每月約 25 分鐘（每日同步 30 秒 + push 時 guard 15 秒）。

---

### v1.7.2 — 唔再自寫表單，回報只留一行 widget（2026-10-28）

用戶：「應該唔洗寫自己表單，回報時自動帶入來自邊個 APP 我就識睇，唔係太多表單 ADMIN 嗰邊仲難睇。」

**照做，兩版自寫嘅嘢全部刪走**：

| 刪走 | 原因 |
|---|---|
| 自寫報料對話框（`<dialog>` + 14 個欄位 + CSS 約 1.4KB） | 多一套介面要學，admin 睇落唔一致 |
| `buildReportPayload`／`sendReport`／`fetch` 20 行 | 冇必要自己組 payload，admin 本身有規格 |
| 卡片「✏️ 報料」掣 | 全站一個入口就夠 |
| `apps-script/report-form/`（v1.7.0 已刪） | 自己開 Sheet = 多一個地方睇 |

**留低嘅**：`index.html` 最底一行

```html
<script defer src="https://scout-admin-blue.vercel.app/widget.js" data-app="營地資料庫"></script>
```

`data-app` 就係「來自邊個 APP」，後台膠囊照樣分得到。本站變返**零 fetch、零表單、零後端**。

**驗證**：guard 15/15（第 15 項改為驗 widget 有冇嵌、data-app 係唔係正式名稱、前端係唔係真係零 fetch）、
test 21/21、`npm run ui` 28/28（第 E 段驗：widget 有嵌、卡片冇多餘掣、widget 載入失敗都照出 108 張卡）。

---

### v1.7.3 — 「用邊啲身份測」補齊到八種（2026-10-28）

用戶問：「你有用各單位去檢測完成了嗎？請報告用了那些身份去檢測及檢測結果。」

**先講清楚一件事**：呢個站**冇帳號、冇分旅團／區／支部**，所有人睇同一個版本。
所以「各單位」喺呢度只可能係**裝置同能力差異**（斷網、無痕、手機、關 JS、鍵盤、老花…）。
如果你講嘅係童軍單位（旅團／區／支部），呢個站冇分——所有單位睇同一份 108 筆資料。

**測咗八種身份（`npm run ui`，44 項全綠）**：

| 段 | 身份 | 結果 | 捉到咩 |
|---|---|---|---|
| A | 斷網用戶 | ✅ 8 | — |
| B | 無痕／私隱模式 | ✅ 5 | — |
| C | 要篩選嘅用戶 | ✅ 5 | — |
| D | 手機用戶 375px | ✅ 3 | — |
| E | 想回報嘅用戶 | ✅ 7 | — |
| F | **關咗 JS** | ✅ 5 | 原本只見到「載入中…」永遠唔會變 → 加 `<noscript>` |
| G | **鍵盤／螢幕報讀** | ✅ 9 | 冇焦點框、冇 skip link、結果唔會讀出、`#maxPrice` 冇名 |
| H | **老花／大字** | ✅ 3 | `--muted` 對比只有 4.33:1（AA 要 4.5）→ 調深到 4.71:1 |

**今次一共修咗 5 個真問題**（全部係「換個身份用」才會撞到）：
1. 關 JS → 加 `<noscript>` 提示 + 叫用戶直接開 `data.csv`
2. 螢幕報讀 → `#resultCount` 加 `role="status" aria-live="polite"`
3. 鍵盤 → 全站 `:focus-visible` 焦點框 + 「跳去主要內容」skip link
4. 對比度 → `--muted` #6b7568 → #666f63（4.33:1 → 4.71:1）
5. 價格滑桿 → `aria-label="最高價格（每晚，港幣）"`

**其餘六個角度**（Vercel／Git／程序員／架構師／AI Agent／User）之前已全綠，見 §七。

---

### v1.8.0 — 八種真人身份實測（2026-10-28）

用戶點名要測：程序員查 BUG、網頁工程師看 UI、外國到訪的人、小孩、家庭用戶、遠足人士、童軍、團體。

**結果：`npm run ui` 由 44 項加到 76 項（A–P 十六段），全綠。** 過程中改咗 6 樣真嘢：

| 身份 | 測到咩 | 改咗咩 |
|---|---|---|
| **程序員** | 46 個 id 冇重複、108 筆 id 唯一、座標全部喺香港（22.1–22.6°N / 113.8–114.5°E）、卡片冇 undefined／NaN | — |
| **網頁工程師** | 字級**27 級**太散（0.70/0.71/0.72/0.73/0.74…） | 收窄到 **13 級**（每級改動 ≤0.02rem ≈ 0.35px，肉眼睇唔出但 CSS 好維護好多） |
| **外國到訪的人** | 全站中文，外國人唔知呢個站係咩 | 標題加英文一句 + `lang="en"`（**未做 i18n，介面仍中文** — 見「已知限制」） |
| **小孩** | chip／按鈕得 28px 高，手指細嘅人難撳 | 手機上所有可撳元素 **≥40px**；冇自動彈窗 |
| **家庭用戶** | 廁所分得開、有免費標示 | 唔使改（本身有） |
| **遠足人士** | **卡片冇寫點去** —— 要開 Google Maps 才知 | 每張卡加「🚌 交通方式」一行（108 張全部有） |
| **童軍** | 有營位數、有預訂／官方連結 | 唔使改 |
| **團體** | **冇得按人數篩** | 新增「營位規模」篩選：少於 20（31）／20-50（5）／多於 50（5） |

**已知限制（唔隱瞞）**：
- 英文只做到「一句講清楚呢個站係咩」，**撳落去仍然係中文**。要做完整英文介面，工作量等於重寫所有 UI 字串，等你話要唔要。
- 營位數字只有漁護署 41 個營地有官方數字；其餘 67 筆（NGO／民宿）冇，篩選時唔會出現。

---

### v1.12.1 — 刪大圖＋PNG 減色瘦身（2026-10-28）

用戶：「照用 PNG 同唔洗大圖，就只是用作 APP 內 ICON 和 FAVICON 讓 WEBSITE 讀取而已」

**全部保持 PNG／ICO，唔轉 AVIF** —— 試過度，四個位一轉就壞：

| 位 | 一轉 AVIF 就 |
|---|---|
| `apple-touch-icon` | iOS 主畫面變白板（iOS 只認 PNG） |
| `manifest` icons | Android「安裝應用程式」可能失效 |
| `favicon.ico` | 書籤冇圖（必須 ICO） |
| `og:image` | WhatsApp／FB 唔支援 → 貼連結又變一行字 |

**做咗兩件事省位：**

1. **刪 `icon-1024.png`（378 KB）** —— 全 repo 冇任何檔案引用佢。
   只有上 App Store／Play Store 提交審查才需要，要時用 `logo/` 原圖另存就得。
2. **減色**（`-dither None -colors`）：
   - icon-512／maskable-512：256 → **48 色**（98.7 → 46.6 KB）
   - icon-192／maskable-192／apple-touch：256 → **32 色**（15.8 → 5.2–5.3 KB）
   - og-image：256 → **64 色**（128.5 → 114 KB）

肉眼對照過 300px 放大版，睇唔出分別（天空漸變有極輕微 banding，圖標尺寸下不可見）。

**結果：dist 982 KB → 467.5 KB（−52%），圖標資料夾 632 KB → 244 KB。**

驗收：guard **18/18**、test **21/21**、ui **112/112**。

### v1.12.0 — 彩色露營 Logo（2026-10-28）

用戶：「有露營感覺多 D 同唔好得 2 隻色甘單調」，再補「完成後就合併到 MAIN」。

原本係平面雙色 A 形帳篷（綠底奶白）。改成**日落露營場景**：

| 元素 | 色 | 作用 |
|---|---|---|
| 天空漸變 | 深靛 `#2A2A5C` → 蜜桃 `#E9A87C` | 日落氛圍，唯一允許漸變嘅地方 |
| 落日 | 琥珀 `#E8822B` | 大圓，16px 都認得 |
| 松樹林 | 暗青 `#2C5A50` | 左右裁出畫面，暗示延續 |
| 帳篷 | 奶白 ＋ 深炭門 | 主體，永遠居中 |
| 草地 | 森林綠 `#2C5A3C` | 壓住底部 |
| 營火 | 橙＋黃焰＋三粒火星 | 露營靈魂 |

三個踩過嘅坑：

1. **AI 生圖帶圓角白邊** → 放上 iOS 會見白角。改為裁內部 `-crop 1250x1250+405+400`，保留滿版。
2. **16px 唔可以靠縮** → 1024 縮到 16 係一團糊。`favicon-16.png` 另外手繪三層色。
3. **PNG 太肥** → 未壓縮時 dist **2.7 MB**（爆 1 MB 預算）。全部轉 256 色 PNG8 → **982 KB**。

其他改動：

- 網站 header 加 56px logo（手機 44px），`alt="" + aria-hidden` 唔會令讀屏重複讀標題
- `og-image` 改為漸變底 + 居中圖標（原本係綠底空框，因為工作目錄 reset 令檔案唔存在）
- `manifest` background_color 改 `#1B4D28`（同圖標綠一致，Android 啟動畫面唔會閃白）
- ui S 段 10 → 13 項（加 header logo）

驗收：guard **18/18**、test **21/21**、ui **112/112**、dist **982 KB**。

### v1.11.0 — App Icon／favicon（2026-10-28）

用戶：「幫我畫埋個 LOGO 同 FAVICON 比佢丫，唔係 WEBSITE 個 APP 上架會無圖」
補一句：「唔要 SVG 直接用 AI 生成」。

- 用 AI 生成 1024×1024 主圖（深綠滿版 #1B4D28 ＋ 奶白 A 形帳篷 ＋ 頂上圓點 ＋ 底下波浪線），
  再用 ImageMagick 降到 **只兩隻色**（`+dither -remap` 3 色 palette），避免漸變／陰影／雜點，
  縮到 16px 都仲睇得清。
- **第一版出錯**：AI 生咗圓角＋圓角外面有白邊 → 加落主畫面會見四個白角。
  重畫要求「full bleed、四邊滿版、冇白邊」。
- **16px 用另一個版本**：唔係縮細 1024，係用 `convert -draw` 手繪簡單版
  （去掉波浪線、帳篷加粗），因為 1024 縮到 16px 一定糊。
- 新增 `icons/` 10 個檔、`manifest.webmanifest`、`robots.txt`。
- `index.html` 加 11 個 meta（icon×3、apple-touch-icon、manifest、theme-color、
  apple-mobile-web-app-title、msapplication×2、og:image×4、twitter:card）。
- `build-site.mjs` 會一併部署 `icons/`；`vercel.json` icons 一年 immutable。
- `slim-report.mjs` 修好讀唔到 `dist/icons` 子目錄（EISDIR）。
- guard 第 18 項：用 `identify` 量實際像素尺寸 ＋ 驗 manifest JSON；ui 加 S 段 10 項。

驗收：guard **18/18**、test **21/21**、ui **109/109**、dist **367.7 KB**（含 10 個圖）。

### v1.10.0 — 天氣站改用營地座標配對（2026-10-28）

用戶問：「是否整個大嶼山都無天氣站？為什麼南山白富田那些也算長洲？」再補：「我是指以營地座標來匹配天氣站點」。

查證（逐個試天文台 OCF 原始檔）：

| 代號 | 站 | 有咩 |
|---|---|---|
| CCH | 長洲 | 降雨概率、天氣圖示、氣溫、風 |
| **NGP** | **昂坪**（22.259, 113.913） | 只有 9 日**氣溫**（冇雨）→ 唔可以入落雨配對 |
| CLK | 赤鱲角 | ❌ 404 |

改動：

- 新增 `lib/stations.mjs`：27 個氣溫站 + 12 個 OCF 站官方座標（天文台 stn.htm，DMS→十進制）
- `build-data.mjs`：刪走 `DISTRICT_STATION`／`AREA_STATION_RULES`／`OCF_DISTRICT`／`OCF_AREA_RULES`，改 `nearestStation()`；每筆加 `ocfKm`／`weatherKm`
- `app.js`：天氣面板「就近氣象站：長洲（直線約 7 公里）」、OCF 標題「長洲站 · 直線約 7 公里」
- guard 第 17 項：每次重算 108 筆最近站 + 守住大浪灣唔可以再係 SKW

修好嘅錯配：大浪灣（大嶼山）筲箕灣 37 km → 長洲 15.4 km；昂坪 荃灣 → 長洲 13.1 km；
東涌 荃灣 → 屯門 12.3 km；南丫島 → 黃竹坑 ~6.8 km。

**陷阱**：`data/auto/ocf-forecast.json` 自帶座標唔可靠 —— SEK「西貢」寫成 22.436,114.085（其實係石崗，差 20 km），
用咗會令大棠、河背配去「西貢」。座標一律用官方表。

驗收：guard **17/17**、test **21/21**、ui **99/99**（新增 R 段 6 項）。

### v1.9.2 — 補給字眼改用「士多＋餐廳」（2026-10-28）

用戶問：「那如果用食肆或者商鋪呢？」

- **加「餐廳」**：鄉郊士多十間有八間兼做食肆，Google 多數標做 `restaurant`。
  用戶自己嗰張截圖就係證據——三椏村發記士多喺 Google 叫 `Fat Kee Store & Restaurant`（🍴 圖示），
  只搜「士多」會漏咗佢。`SUPPLY_QUERY_TERMS = ['士多', '餐廳']`。
- **「商鋪」唔用**：Google 冇呢個分類，只會派市區地舖／商場，對露營補給零用途。
- **6 個已核實補給點填入 `data.csv` 嘅 `supply` 欄**（全部有自己簡介文字依據，唔係估）：
  三椏村士多／嶂上村豆花士多／浪茄灣宗教機構士多／籮箕灣「冇商戶 · 要全自備」／
  昂坪市集／鹹田灣村內士多。
- 卡片：有 `supply` 就顯示「🛒 最近補給：…」＋「🔍 再搵其他」＋「📍 營地位置」；
  冇就顯示「🛒 搵附近超市／士多／食肆」＋「📍 營地位置」。
- `scripts/guard.mjs` 第 16 項加 2 條：query 一定要有「餐廳」、唔准出現「商鋪」。
- `scripts/ui-check.mjs` Q 段 13 → 17 項；總數 **89 → 93**。
- 驗收：guard **16/16**、test **21/21**、ui **93/93**。

**可以改嘅**：如果實測覺得「餐廳」太多雜訊（例如市區邊緣場），
改 `SUPPLY_QUERY_TERMS` 一個數組就得，唔使掂其他地方。

### v1.9.1 — 補給連結實測修正（2026-10-28）

用戶手機實測 `hkcamping.vercel.app` 回報兩個問題：

| 用戶原話 | 真實原因 | 修法 |
|---|---|---|
| 「我點近近補給時根本沒有標出營地位置」 | Google 地圖**搜尋網址唔會顯示自訂標記**，只顯示搜尋結果 | 補給格加第二個掣「📍 營地位置」→ `/maps/place/<lat>,<lng>` |
| 「GOOGLE 地圖 SEARCH 很多時候會找不到士多」 | query 係 `超級市場 OR 士多`——**Google 唔認 `OR`**，會派最近嘅市區超市 | 改 `士多 <area>`；縮放 14→15 級 |

- `app.js` `supplyLine()` 重寫：回傳 `<div class="supply-line">` 兩個掣（`supply` 有值就顯示文字＋位置掣）。
- `styles.css`：`.supply-line` 改 flex wrap；手機上每個掣 ≥34px 高（唔會撞手）。
- `scripts/guard.mjs` 第 16 項加 3 條：要有 `maps/place`、唔准再見 `'超級市場 OR 士多'`、query 要帶 `s.area`。
- `scripts/ui-check.mjs` Q 段 7 → 13 項；總數 **83 → 89**。
- 驗收：guard **16/16**、test **21/21**、ui **89/89**、dist **226.1 KB**。

### v1.9.0 — 裝備要求 ＋ 補給（2026-10-28）

用戶：「洗唔洗自己拿裝備，同附近最近既補給點」——呢兩樣之前完全冇。

**裝備：做咗，而且規則寫死**

新增 `data.csv` 第 20–21 欄 `gear` / `supply`，`gear` 只有兩個值：

| 值 | 意思 | 筆數 |
|---|---|---:|
| `全自備` | 帳篷、睡袋、煮食器具、食水自備 | 45（全部「露營」） |
| `場地提供` | 有房有床，唔使自己帶營具 | 63（宿營／民宿／Glamping） |

卡片出徽章（🎒 / 🛏），側欄有新篩選 chip。**唔講死「有冇被鋪」**——每間場唔同，寫死就係亂講。

**補給：故意唔填，改用地圖即時搜**

`supply` 欄留空。原因：**官方（漁護署／康文署／民政署）冇「最近超市／士多喺邊」嘅資料**。
自己填即係靠估，違反「唔可以報假料」。所以每張卡出一條：

```
🛒 附近補給（開地圖搵最近超市／士多）
→ google.com/maps/search/超級市場 OR 士多/@22.4917,114.1670,14z
```

即時搜、永遠唔會過時、唔會指你去執咗笠嘅舖。日後你逐個核實到，填落 `supply` 欄就會自動變「🛒 最近補給：粉嶺聯和墟，車程 15 分鐘」，**唔使改 code**。

**驗證**：guard **16/16**（新增第 16 項驗：gear 冇空值、露營＝全自備、其餘＝場地提供、有地圖連結）、
test 21/21、`npm run ui` **83/83**（新增 Q 段 7 項）。dist 224.4KB。

---

## 四、全部官方數據源（無第三方）

| 資料 | 來源 | 更新 |
|---|---|---|
| 108 筆營地基本資料 | `data.csv`（人工策展，收費已標「約」） | 人手 |
| 41 營地水源／營位／郊野公園 | CSDI `afcd_rcd_1635133060194_82554` | 每日 Actions |
| 全港九天預報 + 警告 | HKO `weather.php?dataType=fnd` / `warnsum` | 每日 Actions |
| 18 區雨量 + 27 站氣溫實況 | HKO `weather.php?dataType=rhrread` | 每日 Actions |
| 8 潮汐站高低潮 | HKO `opendata.php?dataType=HLT` | 每日 Actions |
| **12 站九日分區預報** | HKO OCF `maps.weather.gov.hk/ocf/dat/<code>.xml` | 每日 Actions |
| 21 持牌民宿經營者 | CSDI LLHG + HAD CSV | 每月 Actions |
| 日出日落 | 純 JS 天文公式（官方 SRS 驗證） | 客戶端即時計 |

---

## 五、驗收結果（本機 + CI）

```
npm run guard       → 14/14 全綠
npm test            → 18/18 全綠
npm run build:site  → dist/ 4 個檔，211.9 KB（S6 上限 5MB）
node --check        → 全部 JS 通過
PR #5 guard CI      → pass
Live preview        → / /index.html /styles.css /app.js /data.js 全部 200
```

Guard 14 項：必要檔／雙版號／`© SCOUT SYSTEM`／`data.js` 同步／dist 體積／單檔 <1MB／
零 secret／workflow 合約／約數+官方欄位／該區天氣潮汐日光／OCF 九日預報／入站人次+週末排行+足跡／瘦身預算／資料一致性。

---

## 六、已知限制（唔好當成官方實測）

1. **44 筆收費係未核實約數** — 前端已加「約」字 + 警句；核實後可把 `priceSource` 改成 `official`
2. **5 筆分區導覽種子列**民宿（b01–b04/b06）唔係真實單一經營者，$600–$850 只係區域參考價
3. **「就近站」配對係人工策展** — 山區氣溫、無潮汐站嘅外島（東平洲、西貢東）同站點可以有明顯差異
4. **OCF 係自動生成預報** — 未經人手修訂；PoP 只表示落雨機會，唔代表雨量／時間／持續時間
5. **OCF endpoint 唔喺官方 open data 文檔** — 係 OCF 網頁產品嘅資料檔；已做 fail-closed，將來改動最多停更新
6. **蚊患／寵物未做** — 用戶決定；原因寫咗喺 `AUTOMATION.md` 路線圖
7. **LICENSE 未決定** — 公開 repo 無授權檔即「版權保留」，要你拍板
8. **branch protection 未開** — token 睇唔到設定；建議開「Require PR + guard CI 綠」

---

## 七、合併後嘅下一步

1. **PR #6 已合併入 `main`**（merge commit `a24d5bf`）；v1.4.1 CI 修復另開 PR
2. 合併後去 Actions 手動 Run 一次 `Camp Data Sync` 驗收
   （Arena token 無 `actions: write`，API dispatch 回 403，要喺 UI 撳）
3. **Vercel Git Import**：Vercel 連接口 token `limited: true`，`create_project` 403 → 我開唔到 project，
   要你喺 Dashboard 用 Git Import 揀 `playerkousas-rgb/hkcamping`（設定值見 `GITHUB-SETUP.md` §四）
4. **Vercel Analytics**：Deploy 後去 Dashboard → 專案 → Analytics → **Enable**，全站入站人次先會開始記
5. **Dependabot PR #2／#3**（setup-node 4→7、checkout 4→7）— guard CI 已自動驗，揀合併或關閉
6. 長遠：逐筆核實 44 筆收費、合併 5 筆種子列、補電話／電郵欄位

---

## 八、部署／驗收指令備忘

```bash
npm run guard                 # 14 項
npm test                      # 18 項 + npm run audit
npm run build:site            # 產生 dist/（Vercel 正式產物）
npm run dev                   # http://localhost:8000 本機預覽
node build-data.mjs --check   # 驗 data.js 同 data.csv／各快照是否同步
```

```bash
gh workflow list -R playerkousas-rgb/hkcamping
gh run list -R playerkousas-rgb/hkcamping --limit 5
```

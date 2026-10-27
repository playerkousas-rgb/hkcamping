# 香港露營・宿營・民宿資料庫（HK Camp Database）

參考台灣 [營火部落營地資料庫](https://campfiretw.com/camp-database/) 的香港版，收錄：

- ⛺ **漁農自然護理署（漁護署）41 個郊野公園指定露營地點**（官方完整名單，全部免費）
- 🏛 **康樂及文化事務署（康文署）6 個場地**：4 個度假營（麥理浩夫人度假村、鯉魚門公園、西貢戶外康樂中心、曹公潭戶外康樂中心）+ 貝澳營地 + 創興水上活動中心露營區
- 🤝 **30 個 NGO 營地／營舍**（28 列宿營 + 基維爾營地、女童軍博康營地 2 列露營）：保良局、救世軍、青年會（YMCA/YWCA）、青協、童軍、女童軍、明愛、小童群益會、傷健協會、遊樂場協會、青年獎勵計劃、浸信會、神託會、突破、紅十字會、外展訓練學校等
- 🏕 **4 個私人 Glamping** 及 🛖 **27 列民宿/渡假屋**：21 個持牌賓館經營者（牌照事務處名單，含牌照號碼）、5 個分區導覽列，及 1 個坪洲合規提示列

合共 **108 筆**（41 + 6 + 30 + 4 + 27；`data.js` 分類為露營 45、宿營 32、Glamping 4、民宿 27）。
功能：分區地圖（Leaflet + OpenStreetMap）、類型/分區/費用/交通/設施/訊號篩選、
全文搜尋（可搜營運機構）、價格排序、我的最愛（瀏覽器本地記錄，無須登入）、
**週末天氣列**（天文台九天預報 PSR 降雨概率，連地圖 pin 標記；每日 Actions 自動更新）。

## 資料來源與可信度

| 資料 | 來源 |
|---|---|
| 漁護署 41 營地名單、設施分類 | [漁護署指定露營地點官方網頁](https://www.afcd.gov.hk/tc_chi/country/cou_vis/cou_vis_cam/cou_vis_cam_cam/cou_vis_cam_cam.html) |
| 康文署 4 度假營營費與地址 | [康文署度假營官方網頁](https://www.lcsd.gov.hk/tc/camp/) |
| NGO 營舍名單、地址、設施、座標 | [康文署資助非政府機構營舍頁面](https://www.lcsd.gov.hk/tc/camp/sngocc.html) 及各機構官網 |
| 持牌賓館/渡假屋名單、座標、牌照號碼 | [牌照事務處持牌酒店及賓館名單](https://www.hadla.gov.hk/psi/licensed-hotels-and-guesthouses/)（CSDI LLHG 圖層，月更，見 `tools-sync-had.mjs`） |
| 絕大部分營地經緯度 | OpenStreetMap（經 Nominatim 查詢的 camp_site 點位，見 `geocache.json`） |
| 小部分無 OSM 點位者 | 按官方地址定位（已在 `tools-geocode*.mjs` 註明），誤差約數百米 |

NGO 與私人營地的收費為**約數（每人每晚起）**，實際按營期、團體人數及官網報價為準；
漁護署營地全部免費，惟荃錦營地須於「郊野營人」系統預約。
持牌賓館類條目價格統一標示「面議／電話查詢」，唔設虛擬報價；持牌狀態每月由 `tools-sync-had.mjs` 自動覆核。

## 專案結構

```
hk-camp-database/
├── data.csv              # 人工策展層（摘要、標籤、收費、訊號、NGO/民宿）
├── build-data.mjs        # CSV ＋ weather.json → data.js（零依賴，支援 --check）
├── build-site.mjs        # 部署 build：rebuild data.js + 只抄 4 個檔入 dist/
├── data.js               # 自動產生，網站實際讀取的資料
├── vercel.json / .vercelignore / .gitignore  # 部署與 Git 衛生設定
├── data/auto/            # 機器快照層（GitHub Actions 定時更新，勿手改）
│   ├── afcd-campsites.json   漁護署 41 營地官方數據（CSDI，連水源/營位規模）
│   ├── afcd-diff-report.md   官方數據與 data.csv 嘅差異報告
│   ├── weather.json          天文台警告 + 九天預報（含週末降雨概率）
│   ├── had-guesthouses.json  牌照處 1,807 間持牌酒店賓館快照（CSDI LLHG，含座標）
│   ├── had-candidates.json   鄉郊渡假類候選（27 經營者／50 處所）
│   └── had-diff-report.md    賓館月更報告＋民宿合規警示＋營舍持牌名單
├── tools-sync-afcd.mjs  # CSDI 營地同步 + 差異檢查
├── tools-sync-weather.mjs # 天文台天氣快照
├── tools-sync-had.mjs   # 持牌賓館月更同步（CSDI＋HAD CSV，只出快照唔改 data.csv）
├── .github/workflows/sync-data.yml # 每日 00:30 HKT 自動同步（cron '30 16 * * *' UTC）
├── .github/workflows/sync-had.yml  # 每月 2 號 01:15 HKT 月更（cron '15 17 1 * *' UTC）
├── .github/workflows/guard.yml # push / PR / 每週一跑 guard（S12 / F14）
├── .github/PULL_REQUEST_TEMPLATE.md / .github/dependabot.yml
├── scripts/guard.mjs     # 本機 + CI 同一條守護檢查（S/F/A/W/V/G）
├── scripts/smoke.test.mjs # 模擬 DOM 前端啟動測試（零依賴）
├── VERSIONS.md           # 雙版號登記表
├── HANDOVER-STATUS.md    # 交接體檢對照
├── tools-geocode*.mjs    # Nominatim 地理編碼腳本（三個批次，建檔時用）
├── geocache.json         # 地理編碼快取（含 OSM 點位來源）
├── index.html / styles.css / app.js
└── package.json
```

> **恆常化更新策略見 [AUTOMATION.md](AUTOMATION.md)**：邊啲數據全自動、邊啲要半自動改動偵測、
> 邊啲只能人工，以及零成本 GitHub Actions 架構。
> `schedule` 同 `workflow_dispatch` 只會喺 **default branch（main）** 上嘅 workflow 生效，
> 所以兩條 yml 合併入 main 之後先至會真正每日／每月跑；可喺 Actions 分頁手動 Run workflow 驗收。

## 如何新增 / 修改營地資料

1. 用 Excel、Google Sheet 或 VS Code 打開 `data.csv`
2. 每列一筆營地，儲存格內清單用半形分號 `;` 分隔（例如 `熱水淋浴;廁所;停車位`）
3. 執行：

```bash
node build-data.mjs           # 產生 data.js（CAMPSITES ＋ CAMP_WEATHER；不含時間戳，可重複執行）
node build-data.mjs --check   # 只驗收 data.js 同 data.csv／weather.json 是否同步，唔寫檔
```

4. 把 `data.csv` 與重新產生的 `data.js` 一併 commit，push 後 Vercel 自動部署

### 欄位說明

| 欄位 | 說明 | 範例 |
|---|---|---|
| id | 唯一編號：a=漁護署、l=康文署、n=NGO、g=Glamping、b=民宿 | a06 / l03 / n12 |
| name | 營地名稱 | 灣仔南營地 |
| type | 露營 / Glamping / 宿營 / 民宿 | 露營 |
| operator | 營運機構 | 漁農自然護理署 / 香港童軍總會 |
| district | 香港十八區分區 | 西貢區 |
| area | 細部地點 | 西貢海下灣仔半島 |
| price | 每晚價格 HKD，免費填 0 | 0 / 41 / 780 |
| priceUnit | 計價單位 | 免費 / 每人每晚起 / 每營位每晚 |
| booking | 是否需要預訂：是 / 否 | 是 |
| bookingUrl | 自助預訂系統網址（康體通、郊野營人等），無則留空 | https://... |
| infoUrl | 官方資料頁（NGO 無自助系統時，預訂查詢按鈕連到此頁） | https://... |
| transport | 交通，`;` 分隔 | 小巴;渡輪;車輛可達 |
| facilities | 設施，`;` 分隔 | 熱水淋浴;廁所;淡水 |
| tags | 特色標籤，`;` 分隔 | 親子;海灘;觀星 |
| signal | 手機訊號：良好 / 一般 / 微弱 / 無 | 微弱 |
| lat, lng | 緯度、經度（優先採用 OSM camp_site 點位） | 22.4616,114.3422 |
| summary | 一至兩句簡介（避免用半形逗號） | — |

## 本機預覽

```bash
npm run dev
# 或
python3 -m http.server 8000
```

然後瀏覽器開 `http://localhost:8000`（直接雙擊 index.html 也可以，資料走 data.js 而非 fetch）。

## 品質守護（commit 前跑）

```bash
npm run guard       # 8 項：必要檔／雙版號／© SCOUT SYSTEM／data.js 同步／dist 體積／單檔／零 secret／workflow 合約
npm test            # 模擬 DOM 執行 data.js + app.js，確認 108 筆渲染
npm run build:site  # 產生 dist/（4 個檔，約 123KB，含嵌入天氣快照）
```

`guard.yml` 喺 push、PR 同每週一自動跑同一條；五大鐵律 S／F／A／W／V 嘅適用範圍同例外，
見 [HANDOVER-STATUS.md](HANDOVER-STATUS.md)。

## 部署到 Vercel（Git + Vercel + Script 方案）

1. Repo 已喺 GitHub：`playerkousas-rgb/hkcamping`（Public）
2. Vercel → **Add New Project** → Import 該 repo
3. Framework Preset 選 **Other**；`vercel.json` 已定案，Build Command 會自動讀做
   `node build-site.mjs`、Output Directory `dist`、Region `hkg1`
4. 按 Deploy，完成後每次 push 到 `main` 自動重新部署，免費額度已足夠

`build-site.mjs` 只會輸出 4 個檔（約 113KB）入 `dist/`；`.vercelignore` 擋走工具、文件同大快照。
本機想驗收同一份產物：`npm run build:site` 後用任何 static server 開 `dist/`。
詳細交接同 Vercel 連接口限制見 [GITHUB-SETUP.md](GITHUB-SETUP.md)。

## 將來升級 Notion 的路徑（不用重寫網站）

前端只依賴 `window.CAMPSITES` 這個資料格式。日後若改以 Notion 管理：

1. 在 Notion 建一份與 `data.csv` 欄位相同的 database
2. 寫一支 `sync-notion.mjs`，透過 Notion API 讀表後輸出同樣格式的 `data.js`
3. Vercel build command 改跑該同步腳本即可，`index.html / app.js / styles.css` 完全不變

建議時機：需要**多人協作、非技術同事頻繁改資料**時才升級；現階段 CSV + Git 有版本歷史、
無 API 限流與權杖風險，更穩陣。

## 後續可加強方向

- [ ] 核實 NGO 營舍最新收費（目前為約數），補上電話與電郵欄位
- [x] 對接香港天文台：每日同步 `weather.json`，build 嵌入 `data.js`，天氣列 + 地圖 pin 顯示週末 PSR 降雨概率與溫度（P3 已完成）
- [ ] 分區實時氣溫／濕度（天文台 1 分鐘 CSV）落返每張營地卡片
- [ ] 營地相片（注意版權，優先用官方圖片或實拍）
- [ ] 空位/預訂日曆（康文署康體通、郊野營人、私人營地）
- [ ] 活動專頁：把營地與附近行山徑、水上活動、餐廳串成行程
- [ ] 增設「營運機構」篩選器及營地比較功能

## 免責聲明

營地設施、開放狀況與收費或隨時調整，正式發佈前必須逐筆核實，並以營地官方公佈為準。

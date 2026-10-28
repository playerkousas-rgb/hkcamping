# 項目進度總覽（2026-10-27）

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
| 現行版本 | **v1.4.0** |
| 工作分支 | `arena/31d2c3e0-hkcamping`（今次）；上一輪 `arena/b909a4c2-hkcamping`（PR #5，已合併） |
| 基準 main | `dd5be13`（PR #5 合併點） |
| 當前 PR | [#5](https://github.com/playerkousas-rgb/hkcamping/pull/5) **已合併**（v1.1.0–v1.3.0）；本輪 v1.4.0 喺新分支，待開 PR |

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
npm run guard       → 12/12 全綠
npm test            → 12/12 全綠
npm run build:site  → dist/ 4 個檔，256.4 KB（S6 上限 5MB）
node --check        → 全部 JS 通過
PR #5 guard CI      → pass
Live preview        → / /index.html /styles.css /app.js /data.js 全部 200
```

Guard 12 項：必要檔／雙版號／`© SCOUT SYSTEM`／`data.js` 同步／dist 體積／單檔 <1MB／
零 secret／workflow 合約／約數+官方欄位／該區天氣潮汐日光／OCF 九日預報／入站人次+週末排行+足跡。

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

1. **開 PR 合併 v1.4.0 入 `main`** ← 本次交付
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
npm run guard                 # 12 項
npm test                      # 12 項
npm run build:site            # 產生 dist/（Vercel 正式產物）
npm run dev                   # http://localhost:8000 本機預覽
node build-data.mjs --check   # 驗 data.js 同 data.csv／各快照是否同步
```

```bash
gh workflow list -R playerkousas-rgb/hkcamping
gh run list -R playerkousas-rgb/hkcamping --limit 5
```

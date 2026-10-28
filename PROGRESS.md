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
| 現行版本 | **v1.6.3**（PR #9，待合併） |
| 工作分支 | `arena/944b532d-hkcamping`（今次，PR #9） |
| 基準 main | `3bd63d7`（PR #8 合併點 = v1.5.0） |
| 當前 PR | [#9](https://github.com/playerkousas-rgb/hkcamping/pull/9)（v1.6.0／1.6.1／1.6.2／1.6.3）**待合併** |

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

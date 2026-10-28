# 香港露營・宿營・民宿資料庫（HK Camp Database）

> 📌 **項目進度／交接**：[PROGRESS.md](PROGRESS.md)（完整 commit 清單、驗收、下一步）·
> [HANDOVER-STATUS.md](HANDOVER-STATUS.md)（規則對照）·
> [GITHUB-SETUP.md](GITHUB-SETUP.md)（部署設定）·
> [AUTOMATION.md](AUTOMATION.md)（自動化策略）

參考台灣 [營火部落營地資料庫](https://campfiretw.com/camp-database/) 的香港版，收錄：

- ⛺ **漁農自然護理署（漁護署）41 個郊野公園指定露營地點**（官方完整名單，全部免費）
- 🏛 **康樂及文化事務署（康文署）6 個場地**：4 個度假營（麥理浩夫人度假村、鯉魚門公園、西貢戶外康樂中心、曹公潭戶外康樂中心）+ 貝澳營地 + 創興水上活動中心露營區
- 🤝 **30 個 NGO 營地／營舍**（28 列宿營 + 基維爾營地、女童軍博康營地 2 列露營）：保良局、救世軍、青年會（YMCA/YWCA）、青協、童軍、女童軍、明愛、小童群益會、傷健協會、遊樂場協會、青年獎勵計劃、浸信會、神託會、突破、紅十字會、外展訓練學校等
- 🏕 **4 個私人 Glamping** 及 🛖 **27 列民宿/渡假屋**：21 個持牌賓館經營者（牌照事務處名單，含牌照號碼）、5 個分區導覽列，及 1 個坪洲合規提示列

合共 **108 筆**（41 + 6 + 30 + 4 + 27；`data.js` 分類為露營 45、宿營 32、Glamping 4、民宿 27）。
功能：分區地圖（Leaflet + OpenStreetMap）、類型/分區/費用/交通/設施/訊號篩選、
全文搜尋（可搜營運機構）、價格排序、我的最愛（瀏覽器本地記錄，無須登入）、
**未來九日該區預報**（天文台 OCF 自動分區天氣預報：12 站降雨概率／溫度／天氣）、
**週末唔落雨排行**（OCF 12 個分區站本週末最高降雨概率，由低至高；地圖 pin 同步標色）、
**週末天氣列**（全港 PSR 降雨概率，連地圖 pin 標記）、
**該區實況**（18 區雨量 + 就近氣象站氣溫）、**潮汐**（8 個官方站高低潮）、
**日出日落**（天文公式計算，誤差 ≤3 分鐘）、
**我的足跡**（標記去過邊個營地，只存瀏覽器、可篩選／清除）、
**入站人次**（Vercel Web Analytics 全站無 cookie 統計 + 頁尾本機累計）、
**未核實收費一律加「約」**、官方水源／營位規模徽章、同埋「訂營＋出發前準備」清單。

## 資料來源與可信度

| 資料 | 來源 |
|---|---|
| 漁護署 41 營地名單、設施分類 | [漁護署指定露營地點官方網頁](https://www.afcd.gov.hk/tc_chi/country/cou_vis/cou_vis_cam/cou_vis_cam_cam/cou_vis_cam_cam.html) |
| 41 營地嘅**水源類型／營位規模／所屬郊野公園** | CSDI `afcd_rcd_1635133060194_82554`（見 `data/auto/afcd-campsites.json`，`build-data.mjs` 按名配對嵌入 `data.js`）——**官方數據，唔係估算** |
| **未來九日該區預報**（12 站降雨概率／溫度／天氣） | 天文台 [自動分區天氣預報 OCF](https://maps.weather.gov.hk/ocf/help_e.html) 嘅 <code>maps.weather.gov.hk/ocf/dat/&lt;code&gt;.xml</code>（檔名 .xml、內容係 JSON），每日更新兩次；見 `tools-sync-ocf.mjs` |
| 康文署 4 度假營營費與地址 | [康文署度假營官方網頁](https://www.lcsd.gov.hk/tc/camp/) |
| NGO 營舍名單、地址、設施、座標 | [康文署資助非政府機構營舍頁面](https://www.lcsd.gov.hk/tc/camp/sngocc.html) 及各機構官網 |
| 持牌賓館/渡假屋名單、座標、牌照號碼 | [牌照事務處持牌酒店及賓館名單](https://www.hadla.gov.hk/psi/licensed-hotels-and-guesthouses/)（CSDI LLHG 圖層，月更，見 `tools-sync-had.mjs`） |
| **該區實況天氣**（18 區雨量 + 27 站氣溫） | 天文台 [`weather.php?dataType=rhrread`](https://data.weather.gov.hk/weatherAPI/opendata/weather.php?dataType=rhrread&lang=tc)，每小時更新，見 `tools-sync-conditions.mjs` |
| **潮汐高低潮**（8 站全年預測） | 天文台 [`opendata.php?dataType=HLT`](https://data.weather.gov.hk/weatherAPI/opendata/opendata.php?dataType=HLT&station=QUB&year=2026&month=10&rformat=json)，每年更新，HKO 已計好唔使自己估 |
| **日出／日落時間** | 純 JS 天文公式（`app.js` 嘅 `sunTimesHKT()`，NOAA/SunCalc），零 API；已用天文台 [`SRS`](https://data.weather.gov.hk/weatherAPI/opendata/opendata.php?dataType=SRS&year=2026&rformat=json) 五個錨點驗證，最大誤差 3 分鐘 |
| 絕大部分營地經緯度 | OpenStreetMap（經 Nominatim 查詢的 camp_site 點位，見 `geocache.json`） |
| 小部分無 OSM 點位者 | 按官方地址定位（已在 `tools-geocode*.mjs` 註明），誤差約數百米 |

> ### ⚠️ 收費可信度（2026-10-27 起）
>
> `data.csv` 嘅 `priceSource` 欄將 108 筆分成三類，前端會直接顯示出嚟：
>
> | priceSource | 筆數 | 前端顯示 | 意思 |
> |---|---:|---|---|
> | `free` | 41 | `免費` | 漁護署官方指定營地，全部免費（惟荃錦營地須喺「郊野營人」系統預約） |
> | `estimate` | 44 | **`約 $120 每人每晚起`** + 橙色警句 | 康文署／NGO／Glamping／分區民宿嘅收費，**未逐筆向官方核實**，落訂前必須上官網或打電話確認 |
> | `enquiry` | 23 | `面議／電話查詢` | 持牌民宿經營者，資料庫**刻意唔報假價**；持牌狀態每月由 `tools-sync-had.mjs` 自動覆核 |
>
> 即使係康文署有官方收費表嘅 6 筆，喺未逐筆核實前都一律標「約」。
> 另外 `priceUnit` 有「每人每晚起／每營位每晚／每間每晚起／每人每課程起」等唔同單位，
> **價格排序只作粗略參考**，唔可以直接比較。核實後可把個別列嘅 `priceSource` 改成 `official`（前端唔加「約」）。

### 📅 未來九日該區預報（v1.3.0）

頁面頂部有條**九日時間軸**，可以揀地區（西貢、長洲、大埔、打鼓嶺、沙田、荃灣、流浮山、屯門、筲箕灣、黃竹坑、將軍澳、香港天文台），
每日顯示天氣圖標、最高／最低溫、**降雨概率**、🌇 日落時間，週末會特別標記。

數據係天文台**「自動分區天氣預報」(OCF)** —— 多模型共識系統，
輸出會先用香港及珠三角氣象站嘅觀測數據校正，再按各模型過往表現加權合成 [官方說明](https://maps.weather.gov.hk/ocf/help_e.html)。
比一般用嘅全港九天預報多咗「該區」維度，亦比第三方天氣 API 可靠（全部官方、有本地校正）。

> ⚠️ **重要**：OCF 係**電腦自動生成、未經人手修訂**，官方講明可能同天文台正式預報或個別站點實測唔同。
> 降雨概率（PoP）只表示「當日落雨機會」，**唔代表雨量、落雨時間或持續時間**，官方驗證統計誤差約 10 次／100 次。
> 面板已寫明呢點同埋連去[天文台正式九天預報](https://www.hko.gov.hk/tc/wxinfo/currwx/fnd.htm)。
> 另外 12 個站之中，**荃灣／筲箕灣兩個站官方只提供溫度、冇降雨概率**，UI 會顯示「降雨概率 —」而唔會作數。
>
> 「營地 → 就近站」配對同 v1.2.0 嘅潮汐／實況站一樣係人工策展（`build-data.mjs`），
> 山區同外島同站點可以有明顯差異；正式活動前請再上天文台確認。

### 🌡 該區天氣・🌊 潮汐・🌇 日光（v1.2.0）

撳任何卡片嘅 **「🌡 該區天氣」** 掣，會彈出一個面板，顯示三樣嘢：

1. **該區實況** — `rhrread` 嘅 18 區過去一小時雨量 + 就近自動氣象站一分鐘平均氣溫。
2. **今日日光** — 日出／日落 HKT + 「建議幾點前紮營」（用純 JS 天文公式按日期計，任何年份都用得）。
3. **潮汐** — 就近潮汐站嘅今日／週末高低潮時間同高度（HKO 官方 `HLT` 預測，唔係自己估）。

> ⚠️ **「就近站」唔係營地實測**：`build-data.mjs` 按 `district` + `area` 關鍵字配對
> 最近嘅自動氣象站／潮汐站。山區氣溫可以比市區站低幾度；東平洲、西貢東等冇潮汐站嘅地方
> 用大埔滘／高流灣代替，潮差同時間可以有偏差。面板已標明「就近站」，
> **正式活動前請再上天文台分區天氣／潮汐預報確認**。
>
> 潮汐站只用 8 個仍運作嘅站（鰂魚涌、高流灣、大埔滘、長洲、石壁、大澳、赤鱲角東、尖鼻咀）。
> 官方標明**芝麻灣（1997 停）、樂安排（1999 停）**兩個站預測誤差較大，故不採用。
> 初始快照只含 2026-10-27 至 11-04 共 9 日；每日 `sync-data.yml` 會補齊當月＋下月全部日子。

## 裝備同補給（v1.9.0，v1.9.1 修正補給連結）

### 要唔要自己帶裝備

`data.csv` 新增 `gear` 欄，只有兩個值，規則寫死喺 guard 第 16 項：

| 值 | 意思 | 幾多筆 |
|---|---|---:|
| `全自備` | 帳篷、睡袋、煮食器具、食水全部自己帶（漁護署指定露營地點就係咁） | **45**（全部「露營」類） |
| `場地提供` | 有房間／床位，唔使自己帶營具 | **63**（宿營／民宿／Glamping） |

> 冇第三個值。好似「有冇被鋪／毛巾／煮食爐」呢啲**每間場都唔同**，我哋唔會統一一刀切講死，
> 卡片會寫「實際提供咩要問場地」。

### 最近補給點 —— 呢個我哋**故意唔填**

`supply` 欄留空，原因：**官方（漁護署／康文署／民政署）冇「最近超市喺邊」嘅數據**。
要填就只可以靠 Google 地圖或者我自己估，兩樣都唔符合「唔可以報假料」的原則。

所以每張卡係**兩個掣**（v1.9.1，用戶手機實測後改）：

```
🛒 搵附近超市／士多 ↗   📍 營地位置 ↗
```

| 掣 | 去邊 | 網址 |
|---|---|---|
| 🛒 搵附近超市／士多 | Google 地圖搜營地附近嘅士多 | `/maps/search/士多 <地區名>/@<lat>,<lng>,15z` |
| 📍 營地位置 | Google 地圖**釘住營地本身** | `/maps/place/<lat>,<lng>/@<lat>,<lng>,15z` |

**為咩要拆兩個掣**：Google 地圖一條網址擺唔到「自訂標記＋搜尋」兩樣——
搜尋網址只會顯示搜尋結果嘅釘，唔會顯示你自己嗰個點。所以要有第二個掣釘住營地，
你先知嗰間士多離營地幾遠。

**v1.9.0 錯咗咩**（用戶 2026-10-28 實測回報）：

| 問題 | 原因 | 修法 |
|---|---|---|
| 撳完補給見唔到營地位置 | 搜尋網址唔會釘自訂點 | 加「📍 營地位置」掣 |
| 明明喺三椏涌，Google 派中環超市 | query 寫 `超級市場 OR 士多`——Google 唔認 `OR` | 改成 `士多 <地區名>`，唔再用 `OR` |
| 搜尋範圍太散 | 縮放 14 級（約 4 km） | 拉到 15 級（約 2 km） |

> 仲有：地區名嚟自 `data.csv` 嘅 `area` 欄（例：「船灣三椏涌」「西貢鹹田灣」），
> 所以每條連結都帶住自己嗰個地名，唔會再跳去第二區。

卡片仍然**永遠唔會過時，亦唔會指你去一間執咗笠嘅舖**。
如果日後你逐個核實到（例如「a01 流水響：最近係粉嶺聯和墟，車程 15 分鐘」），
填落 `supply` 欄就會自動顯示「🛒 最近補給：…」，唔使自己改 code。

## 資料用詞表（v1.6.0 — 防止矛盾）

> 用戶實測發現三類矛盾，已修好並由 `npm run audit` ＋ guard 第 14 項把守，
> 同類問題唔會再悄悄復發。

### 1. 交通：一律寫「港鐵」

香港再無「港鐵東鐵」呢個組合——**全部係港鐵，只分路線**（東鐵綫、屯馬綫、東涌綫…）。
`地鐵`／`東鐵`／`西鐵`／`馬鐵`／`輕鐵` 一律唔准再出現喺 `transport`（audit 會 fail）。
實際站名／路線喺地圖同官方連結睇，唔重複塞入 19 個字嘅欄位。

| 之前 | 之後 | 筆數 |
|---|---|---|
| `地鐵` | `港鐵` | 4 |
| `東鐵` | `港鐵` | 1 |

### 2. 康文署：唔可以用舊 CLPSS 萬能連結

之前 6 筆全部連去 `lcsd.gov.hk/clpss/tc/Index.do`（舊系統入口，會轉駁去其他頁面，用戶去到搵唔返自己嗰個營）。
而家：

| 場地 | 預訂 | 官方資料頁 |
|---|---|---|
| 貝澳營地 | SmartPLAY 康體通 | `/tc/camp/campsites/p_ng_po.html` |
| 創興水上活動中心（露營區） | SmartPLAY 康體通 | `/tc/watersport/hiring/booking_camp/camp_procedure.html` |
| 麥理浩夫人度假村 | SmartPLAY 康體通 | `/tc/camp/p_lmhv.html` |
| 鯉魚門公園及度假村 | SmartPLAY 康體通 | `/tc/camp/p_lymp.html` |
| 西貢戶外康樂中心 | SmartPLAY 康體通 | `/tc/camp/p_skorc.html` |
| 曹公潭戶外康樂中心 | SmartPLAY 康體通 | `/tc/camp/p_tktorc.html` |

> 康文署官方提醒：「SmartPLAY 康體通」只有一個官方網頁 `www.smartplay.lcsd.gov.hk`；
> 曾有偽冒網站騙取個人資料。本資料庫只連官方網域。

### 3. 設施：只合併「真正同一樣嘢」

同一樣嘢有幾個寫法（`燒烤爐`／`燒烤場`）→ 側欄出幾個 chip，撳「燒烤爐」見唔到有「燒烤場」嘅營地，
睇落就好似「可以燒烤但冇爐又冇場」咁矛盾。

**做法**：資料層保留官方精確用詞（漁護署講「燒烤爐」、NGO 講「燒烤場」，卡片照顯示實情），
**篩選層只收斂真正同義嘅寫法**，數量係同義詞嘅聯集。

#### 會合併（同一個意思）

| 篩選 chip | 包含嘅官方用詞 | 合併後 |
|---|---|---:|
| 燒烤設施 | 燒烤爐、燒烤場 | 56 筆 |
| 廁所 | 廁所、洗手間（沖水） | 32 筆 |
| 停車位 | 停車位、停車場 | 25 筆 |
| 廚房 | 廚房、自助廚房 | 5 筆 |
| 泳池 | 泳池、室外泳池 | 4 筆 |
| 攀石 | 攀石牆、攀岩牆、攀石場 | 7 筆 |
| 草地 | 草地、草坪、營地草坪 | 3 筆 |
| 繩網 | 繩網、繩網陣、挑戰網陣 | 9 筆 |
| 球場 | 球場、籃球場、足球場 | 15 筆 |

#### **唔會合併（實質差別大，合併就係誤導）**

| 設施 | 筆數 | 同咩唔同 |
|---|---:|---|
| **旱廁** | 16 | **得個坑、無沖水**（`廁所` 係屋企式沖水廁所，32 筆，兩者零重疊） |
| **獨立浴室** | 5 | 民宿屋內**私人**浴室（`浴室` 係營地公用，只有 1 筆） |
| **中央廚房** | 1 | 通常職員／到會專用，**未必畀營友自己煮**（`廚房`／`自助廚房` 才可以自己煮） |
| **熱水淋浴** | 19 | 有熱水沖涼，同「有浴室」唔係同一件事 |

> 呢四樣列咗入 `NO_MERGE` 白名單，`npm run audit` 會直接 **FAIL**，防止將來有人（包括我）貪方便又合併埋。
>
> 卡片亦會分開標示：旱廁用**警告色** `🕳 旱廁（無沖水）`＋提示自備水／濕紙巾，
> 沖水廁所用 `🚻 沖水廁所`。16 個旱廁營地全部係漁護署偏遠露營點（三椏涌、嶂上、白腊、籮箕灣、石欖洲…）。

### 檢查點跑法

```bash
npm run audit     # 資料矛盾掃描：舊稱、CLPSS、欄位自相矛盾、座標出界
npm run guard     # 第 14 項「資料一致性」會自動跑上面嗰個
```

## 瘦身機制（S 系列對照）

> 對照 [playerkousas-rgb/readme → docs/01-slim.md](https://github.com/playerkousas-rgb/readme/blob/main/docs/01-slim.md)。
> 硬數字全部由 `scripts/guard.mjs`（第 13 項）同 `npm run slim` 把守，**唔靠人眼**。

| 規則 | 本專案做法 | 實測 |
|---|---|---|
| **S1** `api/` 零 runtime 依賴 | 冇 `api/`，亦冇任何 serverless function | `dependencies` 空白 ✅ |
| **S2** `.vercelignore` | 擋 `.git/`、`.github/`、`scripts/`、`*.md`、`tools-*.mjs`、`geocache.json`、HAD 大快照 | 上傳面只剩 build 需要嘅檔 ✅ |
| **S3** `package.json` 極簡 | 零 dependencies；`vercel.json` 已加 `installCommand: npm install --include=dev`（build 階段唔會缺 devDeps） | ✅ |
| **S4** 只部署最終產物 | `framework: null`、`outputDirectory: dist`、`build-site.mjs` 只抄 4 個檔 | `dist/` = 4 檔 ✅ |
| **S5** 死重零容忍 | `npm run slim` 掃 `*.bak/*.tmp/*.old/*.log/*.zip` 等 | 現時 **0 個** ✅ |
| **S6** 圖片／媒體 | 全站零圖片（emoji ＋ Leaflet CDN），冇大圖要壓 | N/A ✅ |
| **S7** CI 硬攔體積 | guard 檢 `dist < 5MB`、單檔 `<1MB`，另加**自家預算** `data.js < 250KB`、`dist < 1MB` | `data.js 128.3KB`／`dist 211.9KB` ✅ |
| **S8** 部署衛生 | Production branch = `main`、關閉非 main preview、retention 7 日（Dashboard 設定，見 [GITHUB-SETUP.md](GITHUB-SETUP.md)） | ⚠️ 要人手撳 |
| **S9** 上載面配額 | 冇上載功能 | N/A ✅ |
| **S10** Git 瘦身 | `.gitignore` 擋 `node_modules/`、`dist/`、`.env*`、binary；單檔 <1MB | 最大檔 `had-guesthouses.json` 783.9KB（未部署，只做月更報告） ✅ |
| **S11** payload 瘦身 | **v1.5.0 重點**：`data.js` 只嵌入前端真正用嘅部分 | 見下 ✅ |
| **S12** 自動化守護 | `guard.mjs` 13 項 ＋ `guard.yml`（push／PR／每週一）＋ `npm test` 13 個 | ✅ |

### S11 實際做咗乜（v1.5.0，data.js 396KB → 128KB）

| 問題 | 之前 | 之後 |
|---|---|---|
| JSON 用 `null, 2` pretty-print | 每層縮排白位佔咗一半體積 | `JSON.stringify(x)` compact |
| OCF 快照連 `hourly` 一齊嵌 | 前端**完全冇用** hourly（只用 `daily`） | 只嵌 `daily` ＋站名／座標／modelTime |
| 潮汐嵌晒當月＋下月 **61 日 × 8 站** | 前端只用「今日、週末、九日預報」 | 只留**快照當日 −2 ~ ＋20 日**（用快照自己嘅 `fetchedAt` 做基準，`--check` 唔會因跨日假爆） |
| `seed`／`seedNote` 註解 | 每次都嵌入 | 只留 `notes`／`officialNotesUrl`（UI 免責聲明要用） |

**成果**：`data.js` 396.3 KB → **128.3 KB（−68%）**；`dist/` 479.9 KB → **211.9 KB（−56%）**；
實際傳輸（gzip）全站約 **47 KB**。原始快照 `data/auto/*.json` 冇改動，仍然係完整官方數據。

```bash
npm run slim     # 瘦身報告：最重 10 個檔、dist 逐檔、gzip、預算同死重掃描
```

## 我們平常用的系統（技術棧對照）

> 呢個 repo 沿用 [playerkousas-rgb/readme](https://github.com/playerkousas-rgb/readme) 真理倉嘅
> **S／F／A／W／V 五大鐵律**同技術棧契約；下面寫明本專案**實際用邊幾套、邊幾套刻意唔用**，
> 唔會扮用過。規則對照詳見 [HANDOVER-STATUS.md](HANDOVER-STATUS.md)。

| 系統／工具 | 本專案角色 | 狀態 |
|---|---|---|
| **Git ＋ GitHub** | 唯一真理來源、版本歷史、PR 審查、`guard.yml` CI 閘 | ✅ 用（`main` ＋ `arena/*` 工作分支） |
| **GitHub Actions** | `sync-data.yml` 每日 00:30 HKT 同步漁護署／天文台／OCF；`sync-had.yml` 每月持牌賓館；`guard.yml` push／PR／每週一 | ✅ 用（公開 repo，免費額度） |
| **Scout Admin（Apps Script）** | 全站唯一對外寫入：卡片「✏️ 報料」→ 同圖書館／支部／專章系統**同一個接收端**，後台多一個「營地資料庫」膠囊 | ⚪ 用（同其他系統共用，v1.7.1 起） |
| **Vercel** | 靜態托管（`hkg1`）、`vercel.json` headers、`build-site.mjs` 產 `dist/`、**Web Analytics 入站人次** | ✅ 用（Framework = Other、Output = dist） |
| **Node.js（零 runtime dependencies）** | `build-data.mjs` 將 CSV＋各快照砌成 `data.js`；`build-site.mjs` 出 4 個部署檔；`guard.mjs`／`smoke.test.mjs` 本機＋CI 同一條 | ✅ 用（`engines: >=18`，`dependencies` 空白） |
| **Leaflet ＋ OpenStreetMap** | 地圖、pin、popup、fitBounds | ✅ 用（CDN，非 npm 依賴） |
| **香港官方 open data** | 漁護署 CSDI、天文台 `fnd`／`rhrread`／`HLT`／`SRS`／OCF、牌照事務處 LLHG | ✅ 用（全部 keyless、無第三方天氣 API） |
| **Notion（CSV／資料庫）** | 將來多人協作時嘅資料管理路徑 | 🕓 未用（合約已預留，見下節） |
| **Google Apps Script（Sheet 當 DB）** | — | ❌ 唔適用：本專案零後端、零寫入面，冇需要 GAS |
| **Supabase（Postgres／Auth／RLS）** | — | ❌ 未用：冇登入、冇用戶資料；眾包回報係將來路線圖 |
| **Gemini／Canvas** | — | ❌ 唔適用：冇生成圖／prompt，W2／W3 水印唔適用 |

**跟足嘅五鐵律**：S 瘦身（`dist/` 4 檔 ≈256KB、單檔 <1MB、零 runtime deps）、
F 防呆（build `--check`、同步腳本 fail-closed、`guard` 12 項硬攔）、
A 安全（純靜態、無 secret、無登入、無可寫 API）、
W 版權（meta `copyright` ＋頁尾 `© SCOUT SYSTEM`；OSM／天文台只署名不轉載圖層）、
V 雙版號（`package.json`／`index.html` meta＋徽章／`app.js APP_VERSION`／`VERSIONS.md` 四處同步）。

### 入站人次點做（v1.4.0）

| 層次 | 做法 | 說明 |
|---|---|---|
| **全站真實人次** | [Vercel Web Analytics](https://vercel.com/docs/analytics) — `index.html` 已加 `/_vercel/insights/script.js` | 喺 Vercel Dashboard → 專案 → **Analytics → Enable** 後生效；無 cookie、唔做跨站追蹤，Dashboard 睇訪客／瀏覽量／來源 |
| **頁面顯示** | 頁尾「👣 入站人次：你第 N 次到訪（本機紀錄，首次 YYYY-MM-DD）」 | 只計**你呢個瀏覽器**（`localStorage` ＋ `sessionStorage`，同一 session 唔重複計），純靜態、零後端、唔會假裝全站數字 |
| **私隱** | 冇 cookie、冇 IP 儲存、冇第三方 tracker、冇帳號 | 唔想被計：清除瀏覽器網站資料即可；analytics script 喺非 Vercel host 會 404，瀏覽器靜靜跳過 |

> 點解唔用 CountAPI／hits.sh 之類免費計數器？第三方服務可隨時停、可被牆、又會將訪客 IP 交去第三方，
> 同本專案「全官方數據、零 secret、零追蹤」原則衝突。Vercel 係我哋自己嘅托管平台，最乾淨。

## 台灣參考網站對照（營火部落 → 香港版）

參考 [營火部落・全台平價營地資料庫](https://campfiretw.com/camp-database/) 嘅功能，逐項對照香港情況：

| 台灣網站功能 | 香港版現況（v1.4.0） | 備註 |
|---|---|---|
| 按縣市／海拔／價錢／設施篩選 | ✅ 分區／類型／費用／交通／設施／訊號；香港山高 <1,000m，用「就近氣象站」代替海拔帶 | 海拔帶對香港冇意義 |
| 本週末邊區唔落雨 + 天氣地圖 | ✅ **新增「週末唔落雨排行」**，用天文台 OCF 12 站官方降雨概率；地圖 pin 同步標綠／黃／紅 | 只顯示降雨概率，唔亂報雨量 |
| 入住／退房日曆、即時空位 | ❌ 冇官方空位 API：康文署 SmartPLAY 有 anti-bot、郊野營人只覆蓋少數營地 | 唔造假日曆；卡片連去官方預訂系統 |
| 平日／假日價、包區均攤價 | 🟡 只顯示官方／約數單價，唔拆分平日假日 | 香港多數營地唔公開浮動價格 |
| 我的最愛／我的足跡 | ✅ 我的最愛 ＋ **新增「我的足跡」**（標記去過、篩選、清除），全部 localStorage | 無需登入 |
| 寵物／雨棚／車泊／洗手間標籤 | 🟡 `data.csv` 已有設施／標籤（如洗手間、停車位），但未逐筆核實寵物同雨棚 | 可持續補資料 |
| 已停業／列管合法標記 | 🟡 民宿只收持牌處所並每月覆核；營地未有「已停業」欄 | 需人手核實 |
| 營地相片／評分 | ❌ 未做（版權同假評分風險） | 優先官方圖片或實拍 |
| 空位通知／收藏分享 | ❌ 未做 | 將來可配 Supabase 眾包 |

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
│   ├── had-diff-report.md    賓館月更報告＋民宿合規警示＋營舍持牌名單
│   ├── conditions.json       該區實況天氣（18 區雨量 + 27 站氣溫）＋ 8 潮汐站高低潮
│   └── ocf-forecast.json     OCF 自動分區九日預報（12 站 × 10 日）
├── tools-sync-afcd.mjs  # CSDI 營地同步 + 差異檢查
├── tools-sync-weather.mjs # 天文台天氣快照
├── tools-sync-had.mjs   # 持牌賓館月更同步（CSDI＋HAD CSV，只出快照唔改 data.csv）
├── tools-sync-conditions.mjs # 該區天氣（rhrread）＋潮汐（HLT 8 站）每日同步
├── tools-sync-ocf.mjs   # 天文台 OCF 自動分區九日預報（12 站）每日同步
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
| price | 每晚價格 HKD，免費填 0，面議留空 | 0 / 41 / 780 |
| priceUnit | 計價單位（各列可唔同，排序只作參考） | 免費 / 每人每晚起 / 每營位每晚 |
| priceSource | **收費可信度**：`free`＝官方免費、`estimate`＝約數未核實（前端加「約」）、`enquiry`＝面議唔報價、`official`＝已核實官方價 | estimate |
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
# 或（Arena live preview 要 bind 0.0.0.0）
python3 -m http.server 8000 --bind 0.0.0.0
```

然後瀏覽器開 `http://localhost:8000`（直接雙擊 index.html 也可以，資料走 data.js 而非 fetch）。

## 回報（v1.7.2 — 一行 widget，本站零表單）

```html
<script defer src="https://scout-admin-blue.vercel.app/widget.js" data-app="營地資料庫"></script>
```

就係咁多。右下角一個「🐛💬 回報 · 意見」掣，撳落去係**你熟悉嗰個** Scout Admin 表單——
同圖書館、支部系統、專章系統**一模一樣**，唔會多一套介面要學。

| 項目 | 做法 |
|---|---|
| 來源 | `data-app="營地資料庫"` → 後台多一個「營地資料庫」膠囊，一眼分到邊個系統 |
| payload | 用 admin 本身嗰套（`SCOUT_ADMIN.md §〇`），本專案唔自己定 |
| 本專案負責 | **乜都唔使**：冇表單、冇 fetch、冇後端、冇 key |
| 斷網／被封 | widget 載入唔到＝右下角乜都唔出，**網站照用**（108 張卡照樣渲染） |

> **點解唔自己寫表單**：每多一套表單，後台就多一種睇法。用戶（你）講得好準——
> 來源膠囊已經夠分辨，寧願全站用同一個介面。
>
> 之前 v1.7.0–v1.7.1 試過自寫 GAS 同自寫表單，兩版都刪走咗。結論：**回報係 admin 嘅責任，唔係呢個站嘅。**

### 用邊啲身份測（`npm run ui` A–Q）

**情境類（A–H）**

| 段 | 身份／情境 | 具體驗乜 |
|---|---|---|
| A | 斷網用戶 | 108 張卡照出、頁尾版權版號、Console 零 error |
| B | 無痕／私隱模式用戶 | `localStorage` 一掂就 throw 都撳到收藏、足跡 |
| C | 要篩選嘅用戶 | 廁所 32／旱廁 16／旱廁卡有 🕳 |
| D | 手機用戶（375px） | viewport、6 個斷點、chip 識換行 |
| E | 想回報嘅用戶 | widget 有嵌、來源「營地資料庫」、本站零表單 |
| F | 關咗 JavaScript | `<noscript>` 提示 + 直接開 `data.csv` |
| G | 鍵盤／螢幕報讀 | lang、焦點框、skip link、可操作元素全部有名 |
| H | 老花／大字 | 全 rem、正文 13.79:1、次要文字 4.71:1 |

**真人身份類（I–P）**

| 段 | 身份 | 佢最關心 | 而家撳得到嗎 |
|---|---|---|---|
| I | 程序員查 BUG | 有冇重複 id、undefined、座標飛咗 | ✅ 46 個 id 唯一、108 筆座標全在香港 |
| J | 網頁工程師看 UI | 字級亂、inline style、設計變數 | ✅ 14 個變數、**13 級字級**（由 27 收窄）、0 inline |
| K | 外國到訪的人 | 知唔知呢個站係咩 | ⚠️ 有英文一句 + `lang="en"`；**介面仍中文，未做 i18n** |
| L | 小孩 | 撳得中嗎、會唔會彈窗嚇親 | ✅ 手機撳鈕 ≥40px、1369 個圖示、冇自動彈窗 |
| M | 家庭用戶 | 有冇廁所、免費、檯凳 | ✅ 48 張卡標廁所／旱廁（分得開）、有免費標示 |
| N | 遠足人士 | 點去、有冇水、有冇訊號 | ✅ **每張卡新增交通行**、水源、訊號、官方地圖 |
| O | 童軍 | 幾多人、點申請 | ✅ 營位數、預訂／官方連結、所屬機構 |
| P | 團體 | 夠唔夠大 | ✅ **新增營位規模篩選**：多於 50 → 5 個場、20-50 → 5 個 |
| Q | **露營新手／家長** | 要唔要自己帶裝備？邊度補給？ | ✅ **新增 `gear` 欄＋篩選**（45 全自備／63 有房有床）；每張卡「🛒 搵附近超市／士多 ＋ 📍 營地位置」兩個掣（v1.9.1 修：原本見唔到營地喺邊、Google 又派錯區） |

> 呢個站**冇帳號、冇分旅團／區／支部** —— 所有人睇同一個版本。
> 「各單位」喺呢度只可能係「真人身份同裝置差異」，上面就係嗰十六種。

## 品質守護（commit 前跑）

```bash
npm run guard       # 16 項：必要檔／雙版號／© SCOUT SYSTEM／data.js 同步／dist 體積／單檔／零 secret／workflow 合約／約數+官方欄位／該區天氣潮汐日光／OCF 九日預報／入站人次+週末排行+足跡／瘦身預算／資料一致性／回報 widget 來源／裝備補給
npm test            # 21 個 smoke test：模擬 DOM 執行 data.js + app.js，108 筆渲染、約數標記、官方水源徽章、潮汐種子、日出日落公式、OCF 九日時間軸、週末排行、我的足跡、入站人次、設施用詞分組、交通用詞、康文署連結、旱廁與廁所分開、獨立浴室與浴室分開、回報交畀 Scout Admin
npm run build:site  # 產生 dist/（4 個檔，約 215KB，含天氣 + conditions + OCF 快照 + CSDI 官方欄位）
npm run ui          # 83 項「17 種身份」實測（要先 npm i -D jsdom）— 見下
```

### 「程序員」同「一般用戶」兩種檢測（v1.6.2）

跟真理倉 [docs/17](https://github.com/playerkousas-rgb/readme/blob/main/docs/17-final-check-and-tutorial.md) 的六角度。呢個專案冇後端，
所以**後端類防呆（session／限流／原子寫入／secret 代理）一條都唔加**——加咗都無嘢守。
實際落嘅係另外兩種：

| 角度 | 邊個做 | 點跑 | 守乜 |
|---|---|---|---|
| **程序員** | 自動、CI 必跑 | `npm run guard`（14 項）、`npm test`（18 項） | 資料本身有冇矛盾、版號四處有冇同步、頁尾版權 |
| **一般用戶** | 自動、人手決定幾時跑 | `npm i -D jsdom && npm run ui`（83 項，A–Q 十七段） | 見下面「用邊啲身份測」 |

**兩個都係 build／測試期先跑，網站本身仍然係零 runtime dependency，`dist/` 一個 byte 都冇多。**

`npm run ui` 用 jsdom 模擬真瀏覽器：斷開所有 CDN（模擬斷網）、令 `localStorage` 一掂就拋錯（模擬無痕視窗），
再真係 `.click()` 篩選 chip 睇返幾多張卡。**v1.6.2 就係呢個測試捉到 `saveFavs` 冇包 try/catch**——
私隱模式下一撳「收藏」會令成個 app 停擺。jsdom 係 devDependency，唔會入 `dist/`、唔會上 Vercel 客戶端；
唔想裝都跑得 `guard` 同 `test`，只係冇咗這一層。

> 守護有冇用，要證明佢捉得到。每次改完跑三個**變異測試**（故意整壞再還原）：
> ① 把「旱廁」編入廁所分組 ② `index.html` 版號改細一版 ③ 刪走頁尾 `© SCOUT SYSTEM`
> —— 三個都應該 FAIL。三個全部過到＝守護係真嘅，唔係印個 ✅ 出嚟。

> **測試唔會鎖死當日官方數據**（v1.4.1）：`npm test` 驗嘅係不變量（日數下限、數值範圍、排序），
> 唔會寫死「某一日官方實測值」或「每站 10 日」——因為 `sync-data.yml` 每日 00:30 HKT 都會翻新快照。
> 渲染邏輯另有一個**合成快照**測試，完全確定性，數據點變都唔會爆。

`guard.yml` 喺 push、PR 同每週一自動跑同一條；五大鐵律 S／F／A／W／V 嘅適用範圍同例外，
見 [HANDOVER-STATUS.md](HANDOVER-STATUS.md)。

## 部署到 Vercel（Git + Vercel + Script 方案）

1. Repo 已喺 GitHub：`playerkousas-rgb/hkcamping`（Public）
2. Vercel → **Add New Project** → Import 該 repo
3. Framework Preset 選 **Other**；`vercel.json` 已定案，Build Command 會自動讀做
   `node build-site.mjs`、Output Directory `dist`、Region `hkg1`
4. 按 Deploy，完成後每次 push 到 `main` 自動重新部署，免費額度已足夠
5. **入站人次**：Vercel Dashboard → 專案 → **Analytics → Enable**（免費 Hobby 額度）。
   `index.html` 已嵌入 `/_vercel/insights/script.js`，開啟後就有全站訪客／瀏覽量；
   頁尾顯示嘅「你第 N 次到訪」係本機累計，唔會上傳任何個人資料

`build-site.mjs` 只會輸出 4 個檔（約 212KB）入 `dist/`；`.vercelignore` 擋走工具、文件同大快照。
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

- [ ] **逐筆核實 44 筆 `estimate` 收費**，核實後把 `priceSource` 改成 `official`；補上電話與電郵欄位
- [ ] 合併／改寫 5 筆「分區導覽種子列」民宿（b01–b04/b06），佢哋唔係真實單一經營者，現時嘅 $600–$850 只係區域參考價
- [x] 對接香港天文台：每日同步 `weather.json`，build 嵌入 `data.js`，天氣列 + 地圖 pin 顯示週末 PSR 降雨概率與溫度（P3 已完成）
- [x] **週末唔落雨排行**（v1.4.0）：OCF 12 個分區站本週末最高降雨概率，排行榜可撳去九日時間軸
- [x] **我的足跡**（v1.4.0）：標記去過邊個營地，可篩選／清除，只存瀏覽器
- [x] **入站人次**（v1.4.0）：Vercel Web Analytics 全站無 cookie 統計 + 頁尾本機累計
- [ ] 分區實時氣溫／濕度（天文台 1 分鐘 CSV）落返每張營地卡片
- [ ] 營地相片（注意版權，優先用官方圖片或實拍）
- [ ] 空位/預訂日曆（康文署康體通、郊野營人、私人營地）——**冇官方空位 API，唔會造假日曆**
- [ ] 活動專頁：把營地與附近行山徑、水上活動、餐廳串成行程
- [ ] 增設「營運機構」篩選器及營地比較功能

## 免責聲明

營地設施、開放狀況與收費或隨時調整，正式發佈前必須逐筆核實，並以營地官方公佈為準。

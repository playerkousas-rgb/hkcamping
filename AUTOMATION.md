# 自動化優先：資料同步與更新策略

> **硬性原則（2026-10-31）**：本項目沒有專人定期核查或更新資料。所有新增或需持續更新的資料，必須由官方 API／開放數據，或可由 GitHub Actions 定期穩定抓取的官方頁面，自動完成抓取、驗證、更新及建置；不能端到端自動維持的資料／功能就不加入。
> 不以人工覆核、通知人手改資料、手動提升候選或眾包回報作為更新流程。GoCampingHK 的主觀難度標籤、營友經驗、人氣及評分明確不加入。
> 官方來源仍是唯一事實依據；`playerkousas-rgb/api` 只供尋找 API 線索，不取代原始發布機構。

## 一、核心原則：來源隔離與 fail-closed

```
data/auto/                ← 機器專用，Actions 定時更新；禁止手動編輯
  ├─ afcd-campsites.json    漁護署 41 營地官方快照（CSDI）
  ├─ afcd-diff-report.md    同既有資料的自動差異報告
  ├─ weather.json           天文台警告 + 九天預報（含週末降雨概率）
  ├─ had-guesthouses.json   牌照處持牌酒店賓館快照（CSDI LLHG 圖層，含座標）
  ├─ had-candidates.json    由官方持牌資料機器篩出的候選（不經人工提升入庫）
  ├─ had-diff-report.md     自動差異／資料完整性報告
  ├─ conditions.json        該區實況＋潮汐站高低潮（每日）
  ├─ ocf-forecast.json      天文台 OCF 分區九日預報（每日）
  └─ transit.json           運輸署巴士／專線小巴站點快照（每週；通過 108/108 驗證後自動發布）

data.csv                  ← 現有靜態基礎資料（歷史上有人工策展；不作新增資料的維護模式）
        ↓ build-data.mjs
 data.js                  ← 網站唯一讀取的合併成品
```

- 新增客觀欄位只接受可追溯至官方原始來源、並可自動同步的資料。
- 優先使用官方 API／開放數據；若只有官方 HTML／檔案，GitHub Actions 必須能穩定解析完整資料集並自動驗證。未驗證的抓取結果不得覆蓋最後一份有效快照。
- 同步及建置全部由 Actions 自動完成；成功且通過驗證後自動更新輸出，不要求人手審批或逐筆覆核。
- 上游停機、格式改變或資料不完整時要 fail-closed、保留最後有效資料並顯示資料過期狀態；不能把舊快照偽裝成最新資料。
- 不新增主觀／用戶生成資料（營地難度評級、營友經驗、人氣、評分、眾包回報），亦不建立依賴人工更新的欄位。
- `data.csv` 目前仍含歷史人工整理的基礎資料；這是既有技術債，不代表新功能可沿用手動維護。新增的自動更新欄位應進入 `data/auto/`，再由 `build-data.mjs` 合併。
- 只產生差異報告或提醒人手更新，**不算完成自動化**；新資料流程必須能自動把已驗證資料送入網站成品。

## 二、各資料源可行性矩陣

| 資料 | 自動化 | 來源（已實測） | 更新頻率 |
|---|:---:|---|---|
| 漁護署 41 營地名稱/座標/郊野公園 | ✅ 全自動 | CSDI GeoJSON `afcd_rcd_1635133060194_82554` | 每日 |
| 營地水源類型、營位規模（少於20/20-50/多於50） | ✅ 全自動 | 同上，`SOURCE_OF_WATER` / `TENT_SPACE` 欄位；營位級別須標明為官方估算 | 每日 |
| AFCD 個別營地路線／設施／適合對象／地圖 | 🟡 待證明可穩定自動解析 | 漁護署 41 個官方營地詳情頁及其官方地圖 | 只有在 Actions 可驗證 41/41 完整解析、自動更新及 fail-closed 後才加入；不可人工逐頁維護 |
| 營地附近官方巴士／小巴站與路線 | ✅ 全自動端到端發布（v1.14.0） | 運輸署雙週 `JSON_BUS.json` + `JSON_GMB.json` route-stop GeoJSON；[測試與限制](TRANSPORT-API-FEASIBILITY.md) | 每週抓取、驗證 108 個營地、自動更新 `data/auto/transit.json`／`transit.js` 並提交網站來源；診斷 artifact 保留 30 日 |
| 巴士／小巴即時 ETA | 🟡 API smoke test 成功；瀏覽器接入未驗 | 運輸署 GMB、KMB/LWB；城巴及 NLB 官方 API | GMB/KMB/城巴 ETA 約每分鐘；CORS、條款及數值化限流未確認；GHA 不可保證即時 |
| 港鐵即時 ETA／站點配對 | 🟡 ETA API smoke test 成功；未具備營地配對資料 | MTR Next Train API；MTR 車站 CSV 與 LandsD 地理資料另待驗 | 列車 ETA 每 10 秒；CSV 本輪 HTTP 500，車站座標、CORS 與條款未驗 |
| 郊野設施/山徑臨時關閉 | ✅ 全自動 | CSDI「Closed Facilities」圖層（舊 dataset ID 已 404，需在 CSDI portal 重新搜尋新 ID） | 每日 |
| 天氣警告、九天預報、週末降雨概率 | ✅ 全自動 | 天文台 `weather.php`（keyless），PSR 欄位 = 低/中/高 | 每日 |
| 分區實時氣溫/濕度、實況天氣照片 | ✅ 全自動 | 天文台 1分鐘 CSV、`hko_mica` webcam | 每日 |
| 蚊患指數（選營地參考） | ✅ 全自動 | 食環署誘蚊器指數 data.gov.hk CSV | 每月 |
| 康文署場地地址/電話/開放時間 | 🟡 待確認端到端自動化 | `lcsd.gov.hk/datagovhk/venue/venue.json` | 只有在 Actions 可自動抓取、驗證、更新後才可新增／擴充欄位 |
| 康文署度假營收費表 | 🟡 待確認端到端自動化 | `lcsd.gov.hk/tc/camp/booking_guide/camp_charges.html`（官方頁面） | 不採用「抓到變更後通知人手改資料」；解析及驗證可自動化才納入更新 |
| SmartPLAY 度假營空位/預訂 | ❌ 無可用官方即時 API | 只連官方預訂頁，不抓內部 endpoint、不顯示即時空位、不設人手日曆提醒 | 不提供未能自動維護的空位資料 |
| NGO 營舍收費/設施 | 🟡 個別官網待自動化驗證 | 各機構官方網站 | 只在 Actions 能可靠解析並自動更新時納入；否則只連官方頁，不新增需人工核查的欄位 |
| 持牌賓館／渡假屋（合規民宿庫） | ✅ 全自動 | CSDI `had_rcd_1639475170528_37262` 圖層 **LLHG**（含座標）＋ HAD CSV 補牌照號，月更 | 每月 |
| **入站人次**（本站統計） | ✅ 全自動 | Vercel Web Analytics（`/_vercel/insights/script.js`，無 cookie）；頁尾本機累計用 `localStorage` | 即時（Dashboard） |
| 民宿候選加入前端 | 🟡 尚未完成自動納入 | `had-candidates.json` 由官方牌照資料生成 | 不經人工挑選；只有可由明確規則自動驗證的記錄才可自動納入，否則不展示 |
| 無牌平台房源（Airbnb 等） | ❌ 不收錄 | 第349章無牌經營風險；資料庫民宿分類只收持牌處所 | — |
| 私人 Glamping 主觀評分／氣氛 | ❌ 不加入 | 無可自動驗證的官方客觀來源 | 不使用人工整理或眾包補位 |
| 手機訊號覆蓋 | ❌ 不複製覆蓋資料 | 通訊辦靜態地圖及地理資訊地圖 `__OFCA_MOBILE` 圖層；依版權條款只連官方地圖 | 深鏈連出；不做眾包訊號評分 |

> **官方交通 feed 首次 live run（2026-10-31）**：[GitHub Actions run #4](https://github.com/playerkousas-rgb/hkcamping/actions/runs/41156262810) 成功處理 108/108 個營地。巴士 feed 56,103 筆 features、8,216 個唯一站點；GMB feed 13,165 筆 features、4,779 個唯一站點。以直線距離計，500 米內分別有巴士站 44/108、小巴站 26/108；1 公里內 53/108、33/108。座標衝突 0，完全同名站點配對 11。完整 JSON／Markdown 診斷 artifact `transit-poc-4` 保留 30 日；v1.14.0 起每週 workflow 會把成功驗證的精簡快照自動發布至網站來源，直線距離不等同步行可達性或 ETA。

### 訊號覆蓋嘅實際接法（已實裝）

- 政府宣傳「通訊準備夠 郊遊安全樂悠悠」對應嘅官方查詢入口：
  - 覆蓋圖層：`https://www.map.gov.hk/gm/map/search/faci/__OFCA_MOBILE?lg=tc`（綠/黃/紅三色）
  - 營地定位：`https://www.map.gov.hk/gm/geo:{lat},{lng}?lg=tc`（地理資訊地圖座標深鏈）
- 每張營地卡片已加「📶 覆蓋查詢」「🏛 官方地圖」兩粒連結，header 加 112 緊急提示橫額
- 通訊辦另公開 33 個郊野公園基站名單（浪茄、荃錦坳、南山、東龍洲等），屬事實資料；
  將來可一次性地理編碼後做「最近基站距離」參考指標，但覆蓋面圖層不可自行轉載
- 不收集眾包訊號回報；只提供官方覆蓋地圖連結。若官方日後提供可自動使用的資料服務，再按自動化門檻評估。

## 三、已交付嘅自動化組件

| 檔案 | 作用 |
|---|---|
| `tools-sync-afcd.mjs` | 抓 CSDI 41 營地 → 快照 + 對照 data.csv 出差異報告（名稱缺失、座標漂移 >100m） |
| `tools-sync-weather.mjs` | 抓天文台警告與九天預報，順手衍生週末降雨風險清單 |
| `tools-sync-had.mjs` | 抓 CSDI LLHG 1,807 間持牌處所 ＋ HAD CSV 補牌號 → 全庫快照、鄉郊候選、合規報告 |
| `.github/workflows/sync-data.yml` | 每日 00:30 HKT 跑 AFCD＋天氣同步 + rebuild，有變更先 commit，無變更靜默 |
| `.github/workflows/sync-had.yml` | 每月 2 號 01:15 HKT 跑持牌賓館月更，只 commit `had-*` 三個檔，唔碰 data.csv |
| `data/auto/` | 機器快照目錄（已含首次實測產出） |
| `build-data.mjs` 官方欄位 join | v1.1.0 起：按營地名稱把 `afcd-campsites.json` 嘅 `waterSource`／`tentSpace`／`countryPark` 嵌入 41 筆營地（41/41 配對成功）；呢啲係**官方客觀數據**，同 `price` 嘅人手約數分開處理 |
| `tools-sync-conditions.mjs` | **v1.2.0 新增**：每日抓 `rhrread`（18 區雨量 + 27 站氣溫）＋ `HLT`（8 站當月＋下月高低潮）→ `data/auto/conditions.json`。`build-data.mjs` 按 `district`/`area` 配對就近氣象站同潮汐站落每筆營地 |
| `app.js` `sunTimesHKT()` | **v1.2.0 新增**：純 JS 天文公式（NOAA/SunCalc）計日出日落，零 API、任何年份、`file://` 都用得；已用 HKO 官方 SRS 2026 五個錨點驗證，最大誤差 3 分鐘 |
| `tools-sync-ocf.mjs` | **v1.3.0 新增**：每日抓天文台「自動分區天氣預報」(OCF) 12 個站嘅未來 9–10 日預報（`maps.weather.gov.hk/ocf/dat/<code>.xml`，檔名 .xml 但內容係 JSON）→ `data/auto/ocf-forecast.json`。多模型共識 + 本地觀測校正，每日更新兩次；**電腦自動生成、未經人手修訂**，UI 已標明 |
| `scripts/transit-poc.mjs` + `scripts/transit-poc-core.mjs` + `scripts/publish-transit.mjs` + `.github/workflows/transit-poc.yml` | 每週抓運輸署巴士／GMB route-stop GeoJSON，對 108 個營地計最近站與直線距離；`lib/transit-snapshot.mjs` 驗證官方來源、完整營地覆蓋、座標／資料大小後，自動更新 `data/auto/transit.json`、重建 `transit.js` 並 commit/push。原始 feed／JSON／Markdown 診斷只作 30 日 artifact；缺檔、來源錯誤或資料不完整即 fail-closed，不需人工覆核 |
| `app.js` + `index.html` + `styles.css` 交通 UI | 卡片原生展開／收合最近巴士／小巴站、路線、地圖及資料時間；每種交通最多顯示最近 2 個站、每站最多列 5 條官方路線，超出路線數會提示。比較表增加附近站點，支援按站名／路線搜尋及最近站排序。手機固定快速列提供頁頂／篩選／排序／頁底；距離與 ETA 限制在 UI 明示 |
| `app.js` `renderWeekendRank()` | **v1.4.0 新增**：用同一個 OCF 快照計本週末（六／日）各分區站最高降雨概率，排「週末唔落雨排行」；地圖 pin 嘅降雨圓點亦改用所屬分區站，唔再全港一個數 |
| `app.js` 我的足跡 | **v1.4.0 新增**：`localStorage` `hkcamp_footprints`（`{id:{first,last}}`），卡片一撳標記／取消，側欄可篩選／清除；無帳號、無上傳 |
| `app.js` `initVisitCounter()` ＋ Vercel Analytics | **v1.4.0 新增**：全站人次由 Vercel Web Analytics（無 cookie、無 secret）統計；頁尾顯示本機累計「你第 N 次到訪」。**唔用** CountAPI／hits.sh 等第三方計數器（可停、可被牆、會交 IP 去第三方） |

> **點解用 OCF 而唔用第三方天氣 API**：HKO open data 嘅九天預報（`fnd`）係全港一個數、
> `rhrread` 分區數據全部係實況，官方一直冇「分區 × 未來多日」嘅 JSON API。
> 2026-10-27 查證後發現 OCF 網頁產品有逐站點九日預報嘅資料檔，就係官方答案。
> 曾考慮 Open-Meteo（瑞士 OpenMeteo GmbH 開源搬運商，聚合 ECMWF／NOAA 等模型），
> 但佢喺香港得 11–25km 全球粗格仔、冇本地觀測校正、免費 tier 只限非商業，
> 而且實測同天文台正式預報有 2°C／降雨判斷分歧 → **決定唔用**，維持全官方數據源。

**2026-10-27 交接修補**：上面兩條 yml 曾經只存在於文件、repo 入面冇，現已補回。
GitHub Actions cron 用 UTC：`30 16 * * *`＝00:30 HKT、`15 17 1 * *`＝每月 2 號 01:15 HKT。
`build-data.mjs` 輸出已改為**不含時間戳**，並新增 `--check`，確保每日 rebuild 唔會製造假 commit。
`build-data.mjs` 而家會同時讀 `data/auto/weather.json`，輸出 `window.CAMP_WEATHER` 一齊嵌入 `data.js`
（前端唔使 fetch）；所以每日 workflow 嘅順序係「先同步 → 再 rebuild → 有變更先 commit」。
兩條 workflow 只喺 default branch（`main`）生效；合併後可手動 `workflow_dispatch` 驗收。

本機手動跑：`npm run sync`（全套）或 `npm run sync:had`（單跑賓館）

**首次運行已揪出並修正 3 項真錯誤**：涌背營地座標偏差 3.2 公里、白臘→白腊及大網仔一號→大網仔嘅官方用字、大浪灣/南山座標微調。

**HAD 首跑關鍵發現（2026-10-27）**：

- 全港 1,807 間持牌處所，油尖旺佔 1,168；鄉郊集中離島 115、西貢 19、元朗 19
- 鄉郊渡假類候選 **27 個經營者／50 個持牌處所**（長洲佔最多，富記度假村單一經營者持 10 牌）
- **坪洲官方名單零持牌賓館** → data.csv「坪洲小島民宿」屬合規警示，報告建議改寫為區內無持牌民宿提示
- 19 間 NGO/宿營營地同時持有旅館牌照（救世軍白普理營 H/2169、烏溪沙青年新村 H/2193 等），屬合規加分項，日後可喺卡片展示牌號
- CSDI 圖層名唔可以估：LLHG 係經 metadata item JSON（`portal.csdi.gov.hk/geoportal/rest/metadata/item/{id}?f=json`）查出，`api` repo 舊文件嘅 `csdi-webpage/geoportal` 前綴已失效

**首批提升已完成（2026-10-27，data.csv 86 → 108 筆）**：

- 21 個鄉郊持牌賓館經營者入庫（b07–b27，長洲 15、南丫 3、塘福 3、梅窩 2 等），價格留 null 於前端顯示「面議／電話查詢」，杜絕虛擬報價
- 青協領袖學院營舍加入為 n30（宿營，牌照 H/6461）
- b05 坪洲改為合規提示列（tag＝合規提示），同步腳本會跳過已確認警示但繼續每月核查
- 重疊機構（大棠、北潭涌、梁紹榮）唔重複建列；樟木頭老人度假中心唔對外公開故不收錄
- 原有 b01–b04/b06 屬早期分區導覽種子列，同真實持牌經營者並存，下次整理可考慮合併

## 四、沒有人工覆核的資料來源處理

NGO 場地等來源格式各異時，單純計 hash、發 Telegram／ntfy 通知並要求人手核查，**不符合本項目的自動化要求**。採用前必須先驗證 Actions 能在無人介入下：

1. 定時抓取官方來源並解析全部目標記錄；
2. 驗證欄位、筆數、日期及允許值，資料異常時 fail-closed；
3. 自動更新快照並重建 `data.js`；
4. 在資料超過有效期限時顯示過期提示，而不是沿用舊值冒充最新。

若來源無 API，只有在以上流程穩定可跑時才可用官方 HTML／檔案抓取；否則不新增該資料，最多提供官方來源連結。不得把人工覆核、手動改 `data.csv` 或眾包當作備援流程。

## 五、建議路線圖

1. **即時**：推送現有專案上 GitHub，開啟 Actions —— 41 個官方營地 + 天氣 + 持牌賓館由既有 workflows 定期更新（兩條 workflow 已補回，見第三節）
2. **候選場地**：不得人手把 `had-candidates.json` 提升入 `data.csv`；只有明確、可機器驗證的規則及自動合併流程才可納入，否則不展示新候選。
3. **✅ 第 2 步（2026-10-27 完成）**：前端食 `weather.json` — `build-data.mjs` 把快照嵌入 `data.js`
   成為 `window.CAMP_WEATHER`（唔使 fetch，`file://` 都用得）；`app.js` 渲染天氣列（週末 PSR、
   溫度、生效警告、過期提示）同地圖 pin／popup 嘅降雨圓點；`sync-data.yml` 每日 rebuild 後自動更新。
   PSR 係**全港預測**，唔係逐營地實測，UI 已寫明避免誤導。
4. **下一項資料候選**：評估漁護署 41 個個別營地頁的官方路線、設施、適合對象及地圖是否可由 GitHub Actions 穩定解析、驗證及更新；未達 41/41 自動化驗收前，不加入新欄位。
5. **第 4 步**：CSDI 關閉設施新 dataset ID 補回後，營地卡片加「臨時關閉」徽章；持牌營舍卡片加旅館牌號徽章
6. **✅ 第 5 步（v1.2.0 完成）**：分區實況 + 潮汐 + 日光 — `rhrread` 18 區雨量／27 站氣溫配對落每張卡片，
   HLT 8 站官方高低潮，純 JS 天文公式計日出日落。**注意「就近站」限制**：山區氣溫同無潮汐站嘅外島
   （東平洲、西貢東）只作大概，面板已標明要再上天文台確認。
7. **✅ 第 6 步（v1.3.0 完成）**：**未來九日該區預報**（HKO OCF 12 站）—— 用官方自動分區天氣預報嘅
   逐站點九日資料檔，頂部時間軸 + 卡片面板。呢個先係真正影響「星期六去唔去」嘅預測，唔係得個實況。
   用戶曾問過第三方 Open-Meteo 嘅可信度，查證後決定**全用官方 OCF**。
   ⚠️ 站點 code 唔喺官方 open data API 文檔（係 OCF 網頁產品嘅資料檔），`tools-sync-ocf.mjs` 已做
   fail-closed（成功站點 < 8 就保留舊快照），將來若官方改 endpoint 最多係停更新，唔會顯示假數據。
8. **第 7 步**：蚊患指數 — ⚠️ 食環署 CSDI 圖層（`fehd_rcd_1629966670823_4638`）實測 `PERIOD` 得 **`2021-09`**，
   係 5 年前舊數據；最新 2026 指數只喺新聞稿 HTML，**冇 machine-readable API**。
   用戶已決定**唔做**，避免當舊數據係實時而誤導。
9. **第 8 步**：寵物規矩 — ⚠️ 法例層面清晰（郊野公園可帶狗但要妥善管束，20kg+ 大型狗有效管制下可豁免牽繩），
   但個別場地（NGO／康文署／Glamping）各有自己規矩，**冇任何 API**，要逐間問。
   用戶已決定**唔做**，只保留通用法例提示喺「出發前準備」清單。
10. **資料儲存**：不以 Supabase／Google Sheets 或多人手動編修取代自動化；若日後需要升級，仍須維持「官方來源 → 自動抓取與驗證 → 自動建置」流程及 `window.CAMPSITES` 前端合約。

## 六、成本

全部組件均為免費層：GitHub Actions（公開 repo 無限、私人 repo 每月 2,000 分鐘）、
CSDI/天文台 keyless API、Vercel Hobby、ntfy/Telegram 免費。**$0/月，無 server 要管理。**

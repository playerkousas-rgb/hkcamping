# GLOSSARY — hkcamping 共用語言

> 只收會影響程式邏輯、資料欄位、篩選器同 UI 用字嘅專案術語；完整資料用詞對照見 [README.md「資料用詞表」](README.md#資料用詞表v160--防止矛盾)。

## 術語

**露營 / 宿營 / Glamping / 民宿（`type` 四分類）**
資料庫唯一允許嘅四種場地類型：`露營`＝自備營具紮營（`gear` 必為 `全自備`）；`宿營`＝團體／機構營舍床位或房間；`Glamping`＝場地提供豪華帳幕／特色營具；`民宿`＝民政事務總署持牌鄉郊賓館／渡假屋（後三類 `gear` 均為 `場地提供`）。
避免：自創第五種 `type`（如「車中泊」「野營」），或喺 `露營` 場地寫入冷氣設施。

**收費可信度（`priceSource`：`free` / `estimate` / `enquiry` / `official`）**
標示 `price` 數字來源嘅四種狀態：`free`＝官方免費（`price=0`）；`estimate`＝歷史整理約數、未經官方 API 逐筆核實（前端強制加「約」字及警句）；`enquiry`＝面議／電話查詢（`price` 留空，不造假價）；`official`＝可自動核實之官方定價。
避免：把未自動核實嘅價格標為 `official`，或把 `price: null`（面議）當成免費。

**沖水廁所 vs 旱廁（`NO_MERGE` 不可合併詞）**
`廁所`／`洗手間` 指有沖水設備嘅廁所；`旱廁` 指無沖水乾廁。兩者同 `獨立浴室`（民宿私人）vs `浴室`（營地公用）、`中央廚房` vs `廚房`、`熱水淋浴` 一樣屬 `NO_MERGE` 清單，資料層與篩選層均嚴禁合併（由 `scripts/audit-data.mjs` 硬攔）。
避免：為減少篩選 chip 而把 `旱廁` 併入 `廁所`。

**港鐵（`transport` 鐵路統稱）**
香港鐵路交通喺 `data.csv` 一律寫 `港鐵`。
避免：`地鐵`、`東鐵`、`西鐵`、`馬鐵`、`輕鐵`、`火車` 等舊稱或分線稱呼（`audit-data.mjs` 會報 ERROR）。

**直線距離（Haversine，非步行可達／非 ETA）**
營地至就近氣象站、OCF 分區站、官方巴士站及專線小巴站嘅球面直線距離，只作地理鄰近參考，不等同步行路線、山徑可達性、班次密度或即時到站時間（ETA）。
避免：喺 UI 或文件寫成「步行 X 分鐘」「距離車站 X 米路程」。

**來源隔離（`data/auto/` vs `data.csv`）**
`data/auto/*.json` 為排程機器抓取並通過 fail-closed 驗證嘅官方快照；`data.csv` 為基礎場地清單；`build-data.mjs` 把兩者合併輸出為 `data.js` 及 `transit.js`。同步腳本絕不直接改寫 `data.csv`。
避免：手動編輯 `data/auto/*`、`data.js` 或 `transit.js`。

## 已釐清嘅歧義

| 之前混用 | 定案 | 日期 |
|---|---|---|
| 按 `district`/`area` 關鍵字配氣象站（大嶼山大浪灣撞名石澳大浪灣） | `weatherStation` 與 `ocfStation` 一律改用營地經緯度計 Haversine 直線最近站（`lib/stations.mjs`） | 2026-10-28 |
| 卡片自建「✏️ 報料」表單／自建 GAS 接收端 | 刪走自建表單與 `fetch`，統一嵌入一行共用 Scout Admin `widget.js`（`data-app="營地資料庫"`） | 2026-10-28 |
| 持牌賓館（第 349 章）等同所有青年旅舍 | 第 349 章 `LLHG` 只含美荷樓（`H/4765`）及市區商業賓館；郊野 YHA 旅舍屬第 376 章會社合格證明書（CSDI `CLUB` 圖層 `C/...`） | 2026-11-11 |

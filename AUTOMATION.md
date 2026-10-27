# 恆常化自動更新策略

> 目標：人手只維護「機器做唔到」嘅資料，其餘全部由 GitHub Actions 定時同步。
> 數據源全部來自 `playerkousas-rgb/api`（香港免費 API 天書，2026-09-29 實測）並已再次實測。

## 一、核心原則：來源隔離（沿用 scout-circulars 模式）

```
data/auto/                ← 機器專用，Actions 定時覆寫，人手唔好改
  ├─ afcd-campsites.json    漁護署 41 營地官方快照（CSDI）
  ├─ afcd-diff-report.md    同 data.csv 嘅差異報告
  ├─ weather.json           天文台警告 + 九天預報（含週末降雨概率）
  ├─ had-guesthouses.json   牌照處全港 1,807 間持牌酒店賓館快照（CSDI LLHG 圖層，含座標）
  ├─ had-candidates.json    鄉郊渡假類候選（27 經營者／50 處所，已剔除大型酒店）
  └─ had-diff-report.md     分區統計＋民宿合規覆核＋營舍持牌名單＋候選明細

data.csv                  ← 人工策展層：摘要、標籤、收費、訊號、NGO/民宿資料
        ↓ build-data.mjs
data.js                   ← 網站唯一讀取嘅合併成品
```

- 官方欄位（座標、水源、營位規模、郊野公園、天氣）→ 機器負責
- 判斷性欄位（營地感受、特色標籤、價格、訊號）→ 人負責
- 同步腳本**只出報告，唔直接改 data.csv**，避免靜悄悄覆蓋人工資料

## 二、各資料源可行性矩陣

| 資料 | 自動化 | 來源（已實測） | 更新頻率 |
|---|:---:|---|---|
| 漁護署 41 營地名稱/座標/郊野公園 | ✅ 全自動 | CSDI GeoJSON `afcd_rcd_1635133060194_82554` | 每日 |
| 營地水源類型、營位規模（少於20/20-50/多於50） | ✅ 全自動 | 同上，`SOURCE_OF_WATER` / `TENT_SPACE` 欄位 | 每日 |
| 郊野設施/山徑臨時關閉 | ✅ 全自動 | CSDI「Closed Facilities」圖層（舊 dataset ID 已 404，需在 CSDI portal 重新搜尋新 ID） | 每日 |
| 天氣警告、九天預報、週末降雨概率 | ✅ 全自動 | 天文台 `weather.php`（keyless），PSR 欄位 = 低/中/高 | 每日 |
| 分區實時氣溫/濕度、實況天氣照片 | ✅ 全自動 | 天文台 1分鐘 CSV、`hko_mica` webcam | 每日 |
| 蚊患指數（選營地參考） | ✅ 全自動 | 食環署誘蚊器指數 data.gov.hk CSV | 每月 |
| 康文署場地地址/電話/開放時間 | 🟡 半自動 | `lcsd.gov.hk/datagovhk/venue/venue.json` | 每週 |
| 康文署度假營收費表 | 🟡 改動偵測 | `lcsd.gov.hk/tc/camp/booking_guide/camp_charges.html`（結構穩定，極少變） | 每週抓取 hash，變咗先通知 |
| SmartPLAY 度假營空位/預訂 | ❌ 無官方 API | 爬內部 endpoint 有 anti-bot 風險；規則：每月 **20 號 08:30** 放剩餘營位 | 日曆提醒人手睇 |
| NGO 27 間營舍收費/設施 | ❌ 無 API | 機構官網各異 | 改動偵測 + Telegram/ntfy 通知（見第四節） |
| 持牌賓館／渡假屋（合規民宿庫） | ✅ 全自動 | CSDI `had_rcd_1639475170528_37262` 圖層 **LLHG**（含座標）＋ HAD CSV 補牌照號，月更 | 每月 |
| 民宿候選提升入 data.csv | 🟡 人工把關 | `had-candidates.json` 已備座標/電話/牌照，人睇完先入庫 | 跟月更報告 |
| 無牌平台房源（Airbnb 等） | ❌ 唔收錄 | 第349章無牌經營風險；資料庫民宿分類只收持牌處所 | — |
| 私人 Glamping 評分/氣氛 | ❌ 無 API | 平台與獨立網站 | 全人工，建議 crowdsource 回報 |
| 手機訊號覆蓋 | ❌ 無 API | 通訊辦 171 幅靜態地圖 + 地理資訊地圖 `__OFCA_MOBILE` 圖層；**版權限制：僅免費個人查閱，轉售/商業轉發須政府批准**，故只能連出不能複製 | 深鏈連出 + 用戶眾包 |

### 訊號覆蓋嘅實際接法（已實裝）

- 政府宣傳「通訊準備夠 郊遊安全樂悠悠」對應嘅官方查詢入口：
  - 覆蓋圖層：`https://www.map.gov.hk/gm/map/search/faci/__OFCA_MOBILE?lg=tc`（綠/黃/紅三色）
  - 營地定位：`https://www.map.gov.hk/gm/geo:{lat},{lng}?lg=tc`（地理資訊地圖座標深鏈）
- 每張營地卡片已加「📶 覆蓋查詢」「🏛 官方地圖」兩粒連結，header 加 112 緊急提示橫額
- 通訊辦另公開 33 個郊野公園基站名單（浪茄、荃錦坳、南山、東龍洲等），屬事實資料；
  將來可一次性地理編碼後做「最近基站距離」參考指標，但覆蓋面圖層不可自行轉載
- 長遠 live 數據仍靠 Supabase 眾包回報（見路線圖第 5 步）

## 三、已交付嘅自動化組件

| 檔案 | 作用 |
|---|---|
| `tools-sync-afcd.mjs` | 抓 CSDI 41 營地 → 快照 + 對照 data.csv 出差異報告（名稱缺失、座標漂移 >100m） |
| `tools-sync-weather.mjs` | 抓天文台警告與九天預報，順手衍生週末降雨風險清單 |
| `tools-sync-had.mjs` | 抓 CSDI LLHG 1,807 間持牌處所 ＋ HAD CSV 補牌號 → 全庫快照、鄉郊候選、合規報告 |
| `.github/workflows/sync-data.yml` | 每日 00:30 HKT 跑 AFCD＋天氣同步 + rebuild，有變更先 commit，無變更靜默 |
| `.github/workflows/sync-had.yml` | 每月 2 號 01:15 HKT 跑持牌賓館月更，只 commit `had-*` 三個檔，唔碰 data.csv |
| `data/auto/` | 機器快照目錄（已含首次實測產出） |

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

## 四、NGO 營地：「改動偵測」代替全日人手巡查

27 間 NGO 營舍無 API，但可以用你 `glue.md` 記錄嘅免費膠水做到半自動：

1. GitHub Actions 每週 fetch 各機構官網頁面，計 hash 存入 cache
2. hash 變咗 → 經 **ntfy.sh / Telegram Bot** 推一則「梁紹榮度假村網頁有更新，請核查」
3. 你每週只需看通知決定改唔改 data.csv，唔使逐間網站巡

呢個正正係 `scout-circulars` 49 個來源嘅同款做法（`sources.json` + 來源隔離 + 快取）。

## 五、建議路線圖

1. **即時**：推送現有專案上 GitHub，開啟 Actions —— 41 個官方營地 + 天氣 + 持牌賓館即刻進入自動更新
2. **每月**：睇 `had-diff-report.md`，把合適嘅 `had-candidates.json` 候選提升入 data.csv（座標電話牌號都齊），並處理坪洲條目改寫
3. **第 2 步**：前端食 `weather.json`，地圖 pin 加週末 PSR 降雨標記（台灣網站嘅賣點功能，數據現成）
4. **第 3 步**：寫 NGO 改動偵測 workflow + Telegram/ntfy 通知
5. **第 4 步**：CSDI 關閉設施新 dataset ID 補回後，營地卡片加「臨時關閉」徽章；持牌營舍卡片加旅館牌號徽章
6. **第 5 步**：若將來資料量再膨脹或要多人編修，先將 data.csv 搬上 Supabase（你已連接）或 Google Sheets，前端合約 `window.CAMPSITES` 唔變

## 六、成本

全部組件均為免費層：GitHub Actions（公開 repo 無限、私人 repo 每月 2,000 分鐘）、
CSDI/天文台 keyless API、Vercel Hobby、ntfy/Telegram 免費。**$0/月，無 server 要管理。**

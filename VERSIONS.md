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

# 交接體檢對照（2026-10-27）

> 對照 `playerkousas-rgb/readme` 真理倉（README／AGENTS／PLAYBOOK／docs 00、05、06、10）
> 同本 repo 嘅 `GITHUB-SETUP.md`（舊交接）。本檔係**規則／風險對照**；
> **完整進度、commit 清單、驗收結果同下一步見 [PROGRESS.md](PROGRESS.md)**。

## 一、施工進度

| 階段 | 內容 | 狀態 | Commit |
|---|---|---|---|
| P0 | 補回 `.github/workflows/sync-data.yml`／`sync-had.yml`；`build-data.mjs` 去時間戳 + `--check`；文件更正 | ✅ | `2869237` |
| P1 | `vercel.json`／`.vercelignore`／`build-site.mjs`（dist 四檔）／部署文件 | ✅ 設定完成；⚠️ 實際 deployment 被 Vercel token 權限擋住 | `1e11acd` |
| P2 | `scripts/guard.mjs` + `guard.yml` + PR template + dependabot + `© SCOUT SYSTEM` + 雙版號 + smoke test | ✅ | `0fe6154` |
| P3 | 前端食 `data/auto/weather.json`：build 嵌入 `data.js`、天氣列、地圖 pin／popup 週末 PSR 標記、過期提示 | ✅ | 本批 |

**合併狀態**：PR [#1](https://github.com/playerkousas-rgb/hkcamping/pull/1) 已於 2026-10-27 合併入 `main`
（merge commit `1727ba1`），PR #4（文件更新）亦已合併。`gh workflow list` 確認三條 workflow 全部 `active`；
`main` 上嘅 guard push run `40462553486` **success**。

**v1.1.0（branch `arena/b909a4c2-hkcamping`，PR #5）**：用戶質問「價錢點嚟、係咪作出嚟」→
查證後確認 `data.csv` 由初始 commit 已有、P0–P3 完全冇改過；但有 44 筆有銀碼資料係**人手估算約數**。
處理：`data.csv` 加 `priceSource` 欄（free 41／estimate 44／enquiry 23），前端一律加「約」+ 橙色警句；
同時 join CSDI **官方**水源／營位規模／郊野公園落 41 筆營地；新增「訂營＋出發前準備」清單。
詳見 `README.md`「收費可信度」一節。

**v1.2.0（同一 branch，PR #5 續）**：用戶問「該區天氣／潮水／蚊患／日落／寵物」能唔能做到。
我實測咗 5 個政府 API（HKO `rhrread`／`HLT`／`SRS`、食環署 CSDI 蚊患、漁護署寵物法例）後，
用戶決定 **做 ① 該區天氣 ② 潮汐 ④ 日落；唔做 ③ 蚊患 ⑤ 寵物**。
- **該區天氣**：`rhrread` 18 區雨量 + 27 站氣溫，按 `district`/`area` 配對 108 筆營地
- **潮汐**：HKO `HLT` 8 站官方高低潮（75 個沿岸營地有站），初始快照 9 日真實數據
- **日落**：純 JS 天文公式，零 API，HKO SRS 五錨點驗證誤差 ≤3 分鐘
- **蚊患**：CSDI 圖層實測 `PERIOD=2021-09`（5 年前舊數據），最新只喺新聞稿 HTML → 唔做，避免誤導
- **寵物**：法例清晰但個別場地規矩無 API → 唔做，只保留通用法例提示
- 新增 `tools-sync-conditions.mjs` 每日同步；guard 10/10、test 8/8 全綠。

**v1.3.0（同一 branch，PR #5 續）**：用戶指出「該區天氣得個實況，未來預測先重要」—— 呢個係我嘅盲點。
查證後發現天文台 open data 嘅 `fnd` 九天預報係**全港一個數**、`rhrread` 分區數據全部係實況，
官方冇「分區 × 未來多日」嘅 JSON API。曾評估第三方 Open-Meteo，查明係瑞士 OpenMeteo GmbH
（開源搬運商、冇自己模型／觀測站，香港得 11–25km 全球粗格仔、免費 tier 只限非商業），
而且實測同天文台正式預報有 2°C／降雨判斷分歧 → 用戶決定**唔用第三方**。
最後搵到**官方 OCF 自動分區天氣預報**嘅逐站點九日資料檔（`maps.weather.gov.hk/ocf/dat/<code>.xml`），
12 站 × 10 日降雨概率／溫度／天氣，多模型共識 + 本地觀測校正。
- 新增 `tools-sync-ocf.mjs` 每日同步 + `data/auto/ocf-forecast.json` 初始快照（實測官方真實數據）
- 頂部九日時間軸（揀地區、週末標記、🌇 日落、潮汐）＋ 卡片面板內九日小表
- 108 筆營地全部配對 OCF 站；標明「電腦自動生成、未經人手修訂，可能同正式預報唔同」
- guard 11/11、test 9/9 全綠。

**v1.4.0（branch `arena/31d2c3e0-hkcamping`）**：用戶要求①檢查專案②README 寫明「我們平常用的系統」
③加最普通嘅入站人數計算④參考台灣營火部落睇改善空間。
- **入站人次**：Vercel Web Analytics（`/_vercel/insights/script.js`，無 cookie）＋頁尾本機累計
  （`localStorage` `hkcamp_visits`，`sessionStorage` 防同一 session 重複計）；**唔用**第三方計數器
- **週末唔落雨排行**：OCF 12 個分區站本週末最高降雨概率，由低至高；地圖 pin 改用所屬分區站
- **我的足跡**：`localStorage` `hkcamp_footprints`，可標記／篩選／清除
- README 新增「我們平常用的系統（技術棧對照）」、「入站人次點做」、「台灣參考網站對照」
- `npm run dev` 改 bind `0.0.0.0`（Arena live preview）；guard 12/12、test 12/12 全綠

## 二、舊交接文件嘅過時資料（已修正）

| 舊 `GITHUB-SETUP.md` | 實際 |
|---|---|
| `/home/user/hk-camp-database/`、repo `hk-camp-database` | `/home/user/hkcamping`、`playerkousas-rgb/hkcamping` |
| commit `635364c`、25 檔 | `254a7c6`「Add files via upload」、23 檔 |
| 要行 device flow／PAT／`gh repo create` | GitHub 已授權（`gh auth status` OK），**唔使再做** |
| 「已交付」兩條 workflows | 之前 repo 入面**完全冇 `.github/`**，Actions 0 workflow／0 run → P0 已補回 |
| README bullet 合計 106 筆 | 實際 108 筆（漏咗 `n12` 基維爾、`n17` 女童軍博康兩個 NGO 露營）→ 已改為 30 個 NGO 營地／營舍 |

## 三、五大鐵律對照（S / F / A / W / V）

| 鐵律 | 本專案點做 | 狀態 |
|---|---|---|
| **S 瘦身** | 零 runtime dependencies；`dist/` 只 4 檔 ≈256KB（含天氣／實況／OCF 快照）；`.vercelignore` 擋大快照／工具／文件；`regions: ["hkg1"]`；單檔全數 <1MB（最大 784KB） | ✅ |
| **F 防呆** | `build-data.mjs` 查 id 重複／經緯度；`--check` 可執行驗收；同步腳本 fail-closed 保留舊快照；workflow 有變更先 commit；`guard.mjs` 12 項本機＋CI 同一條；smoke test 12 個 | ✅ |
| **A 安全** | 純靜態、無登入、無寫入面、無 server、零 secret；入站人次用 Vercel Web Analytics（無 cookie／無第三方 tracker），頁面顯示嘅本機次數唔上傳；`vercel.json` 加 nosniff／frame／referrer／permissions headers。**例外**：A3–A10（session／RLS／超管／限流）唔適用，因為冇身份同可寫 API；已喺本檔寫明 | ✅（例外已申報） |
| **W 版權** | `index.html` meta `copyright` ＋頁尾 `© SCOUT SYSTEM`。**例外**：本專案無 AI 生成圖，W2/W3 隱形水印唔適用；OSM／天文台／通訊辦數據只做連結同署名，不轉載版權圖層 | ✅（例外已申報） |
| **V 雙版號** | 多檔站無單一 `app_vX.Y.html`，改用 `package.json`／meta／`APP_VERSION`／`VERSIONS.md` 四處對照，guard 自動驗 | ✅ |

其他：**G** Conventional Commits、PR template、dependabot、`.gitignore` 已就位；
**VL** `framework:null` + `outputDirectory:dist` + headers + `hkg1` 已就位。

## 四、驗收結果（本機）

```bash
npm run guard     # 12 項全綠（必要檔／版號／版權／data.js／dist／單檔／secret／workflow／約數／該區天氣／OCF／入站人次+排行+足跡）
npm test          # 12 個 smoke test 全綠：模擬 DOM 載入 data.js + app.js，108 筆渲染、雙版號、price null、天氣列、OCF、週末排行、我的足跡、入站人次
npm run build:site  # dist/ 4 檔 ≈256.4KB
npm run dev       # http://localhost:8000 本機預覽（已 bind 0.0.0.0，Arena live preview 用得到）
# 實測 HTTP：/ /index.html /styles.css /app.js /data.js 全部 200，data.js 含 CAMP_WEATHER／CAMP_CONDITIONS／CAMP_OCF
```

> **網絡限制**：Arena sandbox 只可以連 github／npm／pypi，`tools-sync-*.mjs` 喺本機實測係
> `fetch failed`（腳本正確地 `exit 1` 並保留舊快照）。CSDI／HKO／HAD 同步**必須喺 GitHub Actions 驗收**。

## 五、你剩返要做嘅事（程式碼部分已完成並合併）

1. **手動驗收同步 workflow**：Arena 個 GitHub token 無 `actions: write`，
   `gh workflow run "Camp Data Sync"` 回 **403 Resource not accessible by integration** → 我觸發唔到。
   請去 **GitHub → Actions → Camp Data Sync → Run workflow** 撳一次（或等每日 00:30 HKT 自動跑）。
   兩個 `sync-*.yml` 嘅 `schedule` 已喺 `main` 生效。
2. **Vercel 授權 / Git Import**：連接口 token `limited: true`，`list_projects`／`get_project`／`create_project`
   全部 403 → 我開唔到 project。請喺 Vercel Dashboard 用 **Git Import** 揀 `playerkousas-rgb/hkcamping`，
   或者重新授權連接口（要有 project／deployment 讀寫 scope）再叫我部署。設定值見 `GITHUB-SETUP.md` §四。
3. **Dependabot 兩個 PR**（我加 `.github/dependabot.yml` 後自動開）：
   `actions/checkout 4→7`、`actions/setup-node 4→7`。guard CI 會自動驗，你可以合併或關閉，隨你。

## 六、未做／可選（唔影響上線）

- **LICENSE**：公開 repo 無授權檔即「版權保留」。要改用 MIT／CC 等係法律決定，等你拍板我先加。
- **branch protection**：GitHub API 俾 403，我呢個 token 睇唔到設定；建議喺 repo Settings 開「Require PR + guard CI 綠」。
- **NGO 改動偵測 + Telegram/ntfy 通知**：`AUTOMATION.md` 路線圖第 4 步，未做。
- **CSDI 關閉設施圖層**：舊 dataset ID 已 404，要重新搵新 ID（路線圖第 5 步）。

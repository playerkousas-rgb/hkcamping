# 交接體檢對照（2026-10-27）

> 對照 `playerkousas-rgb/readme` 真理倉（README／AGENTS／PLAYBOOK／docs 00、05、06、10）
> 同本 repo 嘅 `GITHUB-SETUP.md`（舊交接）。本檔係**現況快照**，改動後請更新。

## 一、施工進度

| 階段 | 內容 | 狀態 | Commit |
|---|---|---|---|
| P0 | 補回 `.github/workflows/sync-data.yml`／`sync-had.yml`；`build-data.mjs` 去時間戳 + `--check`；文件更正 | ✅ | `2869237` |
| P1 | `vercel.json`／`.vercelignore`／`build-site.mjs`（dist 四檔）／部署文件 | ✅ 設定完成；⚠️ 實際 deployment 被 Vercel token 權限擋住 | `1e11acd` |
| P2 | `scripts/guard.mjs` + `guard.yml` + PR template + dependabot + `© SCOUT SYSTEM` + 雙版號 + smoke test | ✅ | `0fe6154` |
| P3 | 前端食 `data/auto/weather.json`：build 嵌入 `data.js`、天氣列、地圖 pin／popup 週末 PSR 標記、過期提示 | ✅ | 本批 |

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
| **S 瘦身** | 零 runtime dependencies；`dist/` 只 4 檔 ≈123KB（含嵌入天氣快照）；`.vercelignore` 擋大快照／工具／文件；`regions: ["hkg1"]`；單檔全數 <1MB（最大 784KB） | ✅ |
| **F 防呆** | `build-data.mjs` 查 id 重複／經緯度；`--check` 可執行驗收；同步腳本 fail-closed 保留舊快照；workflow 有變更先 commit；`guard.mjs` 本機＋CI 同一條 | ✅ |
| **A 安全** | 純靜態、無登入、無寫入面、無 server、零 secret；`vercel.json` 加 nosniff／frame／referrer／permissions headers。**例外**：A3–A10（session／RLS／超管／限流）唔適用，因為冇身份同可寫 API；已喺本檔寫明 | ✅（例外已申報） |
| **W 版權** | `index.html` meta `copyright` ＋頁尾 `© SCOUT SYSTEM`。**例外**：本專案無 AI 生成圖，W2/W3 隱形水印唔適用；OSM／天文台／通訊辦數據只做連結同署名，不轉載版權圖層 | ✅（例外已申報） |
| **V 雙版號** | 多檔站無單一 `app_vX.Y.html`，改用 `package.json`／meta／`APP_VERSION`／`VERSIONS.md` 四處對照，guard 自動驗 | ✅ |

其他：**G** Conventional Commits、PR template、dependabot、`.gitignore` 已就位；
**VL** `framework:null` + `outputDirectory:dist` + headers + `hkg1` 已就位。

## 四、驗收結果（本機）

```bash
npm run guard     # 8 項全綠（必要檔／版號／版權／data.js／dist／單檔／secret／workflow）
npm test          # 5 個 smoke test 全綠：模擬 DOM 載入 data.js + app.js，108 筆渲染、雙版號、price null、天氣列、無快照 fail-closed
npm run build:site  # dist/ 4 檔 ≈123KB
npm run dev       # http://localhost:8000 本機預覽
# Arena live preview：python3 -m http.server 8000 --bind 0.0.0.0 --directory dist/
# 實測 HTTP：/ /index.html /styles.css /app.js /data.js 全部 200，data.js 含 CAMP_WEATHER
```

> **網絡限制**：Arena sandbox 只可以連 github／npm／pypi，`tools-sync-*.mjs` 喺本機實測係
> `fetch failed`（腳本正確地 `exit 1` 並保留舊快照）。CSDI／HKO／HAD 同步**必須喺 GitHub Actions 驗收**。

## 五、你要做嘅兩件事（我做到嘅都已做）

1. **合併 PR 入 `main`**：`schedule`／`workflow_dispatch` 只喺 default branch 生效，
   兩條同步 workflow 同 guard CI 要合併後先會真正跑。合併後建議手動 Run 一次 `Camp Data Sync`。
2. **Vercel 授權**：連接口 token `limited: true`，`list_projects`／`get_project`／`create_project`
   全部 403 → 我開唔到 project。請喺 Vercel Dashboard 用 **Git Import** 揀 `playerkousas-rgb/hkcamping`，
   或者重新授權連接口（要有 project／deployment 讀寫 scope）再叫我部署。設定值見 `GITHUB-SETUP.md` §四。

## 六、未做／可選（唔影響上線）

- **LICENSE**：公開 repo 無授權檔即「版權保留」。要改用 MIT／CC 等係法律決定，等你拍板我先加。
- **branch protection**：GitHub API 俾 403，我呢個 token 睇唔到設定；建議喺 repo Settings 開「Require PR + guard CI 綠」。
- **NGO 改動偵測 + Telegram/ntfy 通知**：`AUTOMATION.md` 路線圖第 4 步，未做。
- **CSDI 關閉設施圖層**：舊 dataset ID 已 404，要重新搵新 ID（路線圖第 5 步）。

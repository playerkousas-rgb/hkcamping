# GitHub 接手指南（2026-10-27 更新版）

> 舊版（2026-10-27 早段）寫嘅路徑／commit／repo 名已過時，本檔以**實際 repo 狀態**為準。
> 本檔係交接入口；規格同自動化策略見 [README.md](README.md) 同 [AUTOMATION.md](AUTOMATION.md)，
> 健康對照見 [HANDOVER-STATUS.md](HANDOVER-STATUS.md)。

## 一、現狀（勿重做）

| 項目 | 實際 |
|---|---|
| 本地路徑 | `/home/user/hkcamping/`（Arena workspace，連 `.git`） |
| Remote | `https://github.com/playerkousas-rgb/hkcamping.git` |
| 可見性 | **Public**（公開 repo → Actions 分鐘無限） |
| Default branch | `main`；Arena 工作分支 `arena/dcfac2cc-hkcamping` |
| 基準 commit | `254a7c6`「Add files via upload」（單一 commit，23 個檔） |
| 登入 | `gh auth status` = `playerkousas-rgb`，Git HTTPS 已配置，唔使 device flow／PAT |
| 內容 | 108 筆營地、19 欄 `data.csv`、`data/auto/` 六份快照、前端三件套、三支同步腳本 |

**已完成**：GitHub repo 建立、全部檔案推上 main、專案資料合約建立。
**2026-10-27 修補**：補回 `.github/workflows/` 兩條 workflow（之前只喺文件提及，repo 入面冇），
並令 `build-data.mjs` 輸出去除時間戳，等每日同步唔會製造假變更。

## 二、兩條 workflow（P0 已交付）

| 檔案 | 觸發 | 做乜 | 寫入 |
|---|---|---|---|
| `.github/workflows/sync-data.yml` | cron `30 16 * * *` UTC＝每日 00:30 HKT＋`workflow_dispatch` | AFCD 41 營地快照／差異報告＋天文台警告／九天預報＋rebuild | `data/auto/afcd-*`、`weather.json`、`data.js` |
| `.github/workflows/sync-had.yml` | cron `15 17 1 * *` UTC＝每月 2 號 01:15 HKT＋`workflow_dispatch` | CSDI LLHG ＋ HAD CSV 持牌賓館月更 | `data/auto/had-*`，**唔碰 `data.csv`** |

- 兩條都係 `permissions: contents: write`，有實質變更先 commit（bot `hk-camp-bot`），無變更靜默。
- 三支同步腳本 fail-closed：fetch 失敗 → `exit 1`，保留舊快照，Actions 顯示紅燈。
- `schedule`／`workflow_dispatch` 只喺 **default branch** 上嘅 workflow 生效 → 必須合併入 `main`。
- 若 repo 有 branch protection，要容許 `hk-camp-bot`（或用 `GITHUB_TOKEN`）push，否則最後一步會被拒。

### 驗收（合併後做一次）

```bash
gh workflow list -R playerkousas-rgb/hkcamping
# 應見 Camp Data Sync / HAD Guesthouse Sync / guard

gh workflow run "Camp Data Sync" -R playerkousas-rgb/hkcamping
gh run list -R playerkousas-rgb/hkcamping --limit 5
```

預期：綠剔；`data/auto/afcd-diff-report.md` 0 跟進事項；`weather.json` 有九日預報。
喺本地 sandbox 無法實測（只准連 github／npm／pypi，CSDI／HKO／HAD 唔通），所以要喺 Actions 度驗。

## 三、專案關鍵合約（改動前必讀）

- 編輯源：`data.csv`（108 筆，19 欄）→ `node build-data.mjs` → `data.js`（前端唯一讀 `window.CAMPSITES`）。
- `price: null`＝面議／電話查詢（**唔係免費**；免費係 `0`）。
- 同步腳本只寫 `data/auto/`，**永遠唔直接改 `data.csv`**（來源隔離）。
- 全部數據源 keyless、$0/月；日後若需要 API key，入 GitHub/Vercel Secrets，唔入庫。
- `data.js` 係 build 產物但必須 commit（`index.html` 用 `<script>` 直接載入，`file://` 都開到）。
- 每次 commit 前跑 `npm run guard`（見 [HANDOVER-STATUS.md](HANDOVER-STATUS.md)）。

## 四、Vercel 部署設定

Framework Preset：**Other**；Build Command：留空（`data.js` 已 commit）或 `node build-data.mjs`；
Output Directory：`.`（`index.html` 喺根目錄）；Region：`hkg1`（已寫入 `vercel.json`）。
`.vercelignore` 會擋 `.git/`、`.github/`、`scripts/`、`*.md` 等非部署檔。

每次 push 到 `main` 自動部署；Preview 建議只開 main、retention 7 日（S8）。
驗收：地圖同 108 張卡片正常、篩選／搜尋／我最愛可用、OFCA「📶 覆蓋查詢」同「🏛 官方地圖」連結可開、
頁尾顯示 `© SCOUT SYSTEM` 同版號。

> 若 Vercel 連接口 token 係 `limited` scope（無 project／deployment 讀寫權），
> 就需要你喺 Vercel Dashboard 重新授權或改用 Git Import；Git Import 唔需要 API token。

## 五、Git 工作流程（跟 `readme` 真理倉 G2/G3）

```
feature branch → PR → guard CI 綠 + review → squash merge → main 部署
```

- 唔好直接 push `main`；commit message 用 Conventional Commits：`feat(ui): …`／`chore(data): …`。
- 每次施工 checklist 見 `playerkousas-rgb/readme` repo 嘅 `docs/10-checklists.md`；
  五大鐵律 S／F／A／W／V 係底線，本專案適用範圍見 `HANDOVER-STATUS.md`。

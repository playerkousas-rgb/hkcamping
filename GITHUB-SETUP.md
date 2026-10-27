# GitHub 接手指南（新對話用）

> 本檔係 2026-10-27 對話嘅交接文件。裝置授權（device flow）喺舊對話環境無法完成，
> 用戶需於新對話連接 GitHub。以下資料足以無縫接手，無需重頭解釋。

## 一、現狀（已完成，勿重做）

- 專案路徑：`/home/user/hk-camp-database/`（workspace 跨對話保留，連 `.git` 一併保留）
- Git：已 `git init -b main`，作者 `playerkousas-rgb <playerkousas-rgb@users.noreply.github.com>`
- 單一 commit `635364c`（init），working tree 乾淨，25 個檔案已入庫
- 離線備份：`/home/user/hk-camp-database.zip`（225K，不含 `.git`）
- 預覽網站：本機 `python3 -m http.server 8000`（舊對話嘅 background process 唔會延續，需重開）

## 二、目標

- GitHub 帳號：**`playerkousas-rgb`**（全部細階，曾誤寫成 playerkousas-RBG，唔好再錯）
- 新 repo 名：`hk-camp-database`，可見性：**Public**（用戶已拍板；公開 repo Actions 分鐘無限）
- 必須有 `workflow` 權限，否則 push `.github/workflows/` 會被拒

## 三、新對話建議開場白（用戶可直接貼）

> 幫我將 `/home/user/hk-camp-database` 推上 GitHub playerkousas-rgb 帳號，
> repo 名 hk-camp-database，public。git 已 init 同 commit 好，睇 GITHUB-SETUP.md 接手。

## 四、推送方法（按優先次序）

### 方法 A：GitHub 官方 device flow（舊對話兩次未完成，新環境優先重試）

```bash
curl -X POST https://github.com/login/device/code \
  -H "Accept: application/json" \
  -d "client_id=178c6fc778ccc68e1d6a&scope=repo%20workflow"
# 用戶去 https://github.com/login/device 輸入 user_code，然後輪詢：
curl -X POST https://github.com/login/oauth/access_token \
  -H "Accept: application/json" \
  -d "client_id=178c6fc778ccc68e1d6a" \
  -d "device_code=<DEVICE_CODE>" \
  -d "grant_type=urn:ietf:params:oauth:grant-type:device_code"
```

### 方法 B：fine-grained PAT（最穩陣，用戶自行建立後貼上）

- 建立位置：https://github.com/settings/personal-access-tokens/new （Settings → Developer settings → Fine-grained tokens）
- Repository access：All repositories（或只勾新建嘅 hk-camp-database）
- Permissions：**Contents: Read and write**、**Workflows: Read and write**
- 推送：

```bash
cd /home/user/hk-camp-database
# 先喺 GitHub 網頁開空 repo（勿勾 README/license，避免 non-fast-forward）
git remote add origin https://playerkousas-rgb:<TOKEN>@github.com/playerkousas-rgb/hk-camp-database.git
git push -u origin main
# 推送後即刪 token 痕跡：
git remote set-url origin https://github.com/playerkousas-rgb/hk-camp-database.git
```

### 方法 C：gh CLI（若新環境可安裝／已登入）

```bash
gh repo create playerkousas-rgb/hk-camp-database --public --source=. --remote=origin --push
```

## 五、推送後驗收清單

1. GitHub repo 可見 25 個檔案，commit 歷史顯示 `635364c`
2. **Actions 分頁**：兩個 workflow 出現
   - `Camp Data Sync`（cron 每日 00:30 HKT）
   - `HAD Guesthouse Sync`（cron 每月 2 號 01:15 HKT）
   - 手動 `workflow_dispatch` 跑一次 Camp Data Sync，確認綠剔（keyless API，無需 secrets）
3. 公開 repo 設定 → Actions permissions 維持預設允許
4. Vercel 接手（用戶已連接 vercel connector）：
   - Import repo → Framework Preset: **Other**
   - Build Command：留空（`data.js` 已 commit，無需喺雲端 build）
   - Output Directory：`.`（index.html 喺根目錄）
   - 部署後驗證地圖同卡片正常、OFCA 連結可開

## 六、專案關鍵合約（改動前必讀）

- 編輯源：`data.csv`（108 筆，19 欄）→ 跑 `node build-data.mjs` → `data.js`
- 前端唯讀 `window.CAMPSITES`；`price: null`＝面議／電話查詢（唔係免費，免費係 `0`）
- 同步腳本只寫 `data/auto/`，**永遠唔直接改 data.csv**（來源隔離原則）
- 全部數據源 keyless、$0/月；API key 只有未來 Google Places 評分先需要，入 Secrets 唔入庫
- 其餘背景同路線圖見 `AUTOMATION.md`

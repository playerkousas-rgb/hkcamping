# AGENTS — hkcamping 開工邊界

> **Agent 第一行讀呢度。** 同 [README.md](README.md) 衝突時，以通用安全／防呆底線為先。

## 開工順序

1. 先讀本檔 → [README.md](README.md)（5 分鐘入口）→ [SCOPE.md](SCOPE.md)（做乜／唔做乜）→ [GLOSSARY.md](GLOSSARY.md)（共用術語）→ [AUTOMATION.md](AUTOMATION.md)（自動化優先硬性原則）。
2. 通用生態系規則（S 瘦身／F 防呆／A 安全／W 版權／V 雙版號／G Git／VL Vercel／A16 Actions 釘 SHA）以真理倉 [playerkousas-rgb/readme](https://github.com/playerkousas-rgb/readme) 同 [PLAYBOOK.md](https://github.com/playerkousas-rgb/readme/blob/main/PLAYBOOK.md) 為準；**唔好喺本倉複製第二份通用規則**。
3. 改動前後各跑一次守護與測試：
   ```bash
   npm run guard
   npm test
   npm run audit
   npm run ui      # 如本機未裝 jsdom：npm install --no-save --no-package-lock jsdom@^26
   npm run slim
   ```

## 可改 / 唔好改

| 可改 | 唔好改（除非用戶明確指示並寫明例外原因） |
|---|---|
| 前端介面（`index.html`、`styles.css`、`app.js`）、建置與檢查腳本（`build-*.mjs`、`scripts/*`、`lib/*`）、文件 | **自動化優先硬性原則**：唔准加入需要人手定期覆核、手動改 CSV 維持或眾包回報嘅資料／功能 |
| 新增官方開放數據同步腳本（寫入 `data/auto/`，具備 fail-closed 驗證） | **來源隔離**：同步腳本只寫 `data/auto/`，唔准直接覆寫 `data.csv`；未通過驗證嘅抓取結果唔准覆蓋最後有效快照 |
| 修正既有靜態資料錯誤（如壞連結）後必須同步跑 `node build-data.mjs` 及 `node build-data.mjs --check` | **無後端零 secret 合約**：唔准喺前端硬編任何 API key／secret，唔准把 `NO_MERGE` 詞彙（如旱廁／沖水廁所）合併 |
| 外部 GitHub Actions 升級時維持 40-hex commit SHA + `# vX.Y.Z` 版號註解（A16） | **版號與授權**：唔准散寫 `// vX.Y` 行內註解（F15）；`LICENSE` 屬法律決定，未經用戶拍板唔准自行揀選授權 |

## 鐵律捷徑（對應本專案）

- **S 瘦身**：`package.json` 零 runtime 依賴；`dist/` 只含靜態部署產物（`< 1MB` 自家預算、`< 5MB` 硬上限），單檔 `< 1MB`。
- **F 防呆**：`build-data.mjs --check` 可執行驗收；官方資料抓取異常一律 fail-closed 並顯示過期提示；每條規則配 `guard.mjs` 或測試（F14）。
- **A 安全**：純靜態、零 secret；CDN 資源加 SRI `integrity`；GitHub Actions `uses:` 全部釘 40-hex commit SHA（A16）。
- **W 版權**：`index.html` `<meta name="copyright">` ＋ 頁尾保留 `© SCOUT SYSTEM`；官方地圖／氣象／交通資料標明來源，不轉載受版權保護圖層。
- **V 雙版號**：每次改版必須同步更新四處（`package.json`、`index.html` meta＋徽章＋頁尾、`app.js APP_VERSION`、`VERSIONS.md`）及 [CHANGELOG.md](CHANGELOG.md)。

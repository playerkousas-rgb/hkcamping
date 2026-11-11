# CONTRIBUTING — hkcamping

> 提議新資料或改動前先讀 [SCOPE.md](SCOPE.md)、[AUTOMATION.md](AUTOMATION.md) 同 [docs/out-of-scope/README.md](docs/out-of-scope/README.md)。

## 分流

| 事項 | 做法 |
|---|---|
| 網站營地資料錯漏回報（一般用家） | 直接用網站右下角回報掣（共用 Scout Admin `營地資料庫` 膠囊） |
| 程式錯誤／無障礙／行動裝置問題 | 開 Issue，附上重現步驟、裝置闊度及預期行為（一 issue 一問題） |
| 新增官方開放數據自動同步 | 先按 [TRANSPORT-API-FEASIBILITY.md](TRANSPORT-API-FEASIBILITY.md) 格式驗證端點、免 key、條款、限流及 fail-closed，再提 PR |
| 直接提交修正 | 開分支提 PR；每個 PR 聚焦單一主題並附上檢查輸出 |

## PR 最低驗收清單

```text
[ ] npm run guard 全綠（含 A16 Actions 釘 SHA、F15 無散裝版號註解、SEO/SRI、瘦身預算）
[ ] npm test 全綠（smoke + transit parser/publisher）
[ ] npm run audit 零 ERROR（用詞、AFCD/LCSD 連結、NO_MERGE）
[ ] npm run ui 全綠（A–X 多身份無障礙與互動模擬）
[ ] npm run slim 通過預算（dist < 1MB 自家預算、單檔 < 1MB）
[ ] 如改版號：package.json / index.html / app.js / VERSIONS.md 四處同步 + CHANGELOG.md 加紀錄
[ ] 無真實 API key / .env / 垃圾備份檔入 Git
```

## 授權狀態

本倉目前未附開源 `LICENSE`（`package.json` 標為 `UNLICENSED`，預設保留版權 `© SCOUT SYSTEM`）；第三方開放數據（漁護署、康文署、天文台、民政事務總署、運輸署、通訊辦及 OpenStreetMap）均按原始機構條款標明出處。是否改用 MIT／CC 等授權由項目擁有人決定。

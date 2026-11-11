## 做咗乜

<!-- 一句講清楚；一個 PR 做一件事，方便獨立回滾（G3） -->

## 對應規則 ID（S / F / A / W / V / G / VL / A16）

- [ ] 有冇改 `data.csv`？有 → 跑咗 `node build-data.mjs`、`node build-data.mjs --check` 同 `npm run audit`
- [ ] 有冇改同步腳本？有 → 仍然只寫 `data/auto/`，冇直接改 `data.csv`（來源隔離）
- [ ] 有冇新 env / secret？有 → 只入 GitHub/Vercel Secrets，`.env.example` 只寫 key 名唔寫值（A1）
- [ ] 有冇改 `.github/workflows/*.yml`？有 → 外部 `uses:` 全部釘死 40-hex commit SHA ＋ `# vX.Y.Z` 註解（A16）
- [ ] 有冇改版？有 → `package.json` / `index.html` meta＋徽章＋頁尾 / `app.js APP_VERSION` / `VERSIONS.md` 四處同步 ＋ `CHANGELOG.md`（V1，且 code 檔無散寫 `// vX.Y` F15）
- [ ] 交付檔仍有 `© SCOUT SYSTEM` 頁尾 + meta（W1）
- [ ] 輸出仍係 `dist/` 靜態產物（7 個根檔 + `icons/` PNG/ICO）、`dist < 1MB` 自家預算（硬上限 `< 5MB`）、單檔 `< 1MB`（S4/S6/S7/S10/G11）

## 體積影響

<!-- dist 大小、新增檔案數、有冇大過 1MB 嘅檔 -->

## 回滾方法

- Git：`git revert <sha>`
- Vercel：Deployment → 上一個 Ready deployment → Promote to Production（F18）

## 測試

- [ ] `npm run guard` 綠
- [ ] `npm test` 綠
- [ ] `npm run audit` 零 ERROR
- [ ] `npm run ui` 綠（A–Y 身份實測）
- [ ] `npm run build:site` 綠
- [ ] 真機／瀏覽器實測（地圖、篩選、我最愛、天氣列、OFCA 連結）

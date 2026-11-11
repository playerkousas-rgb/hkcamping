# Changelog

本檔記錄近期結構與治理變更摘要；完整逐版功能與規則對照表（`v0.1.0` 起）集中維護於單一來源 [VERSIONS.md](VERSIONS.md)，避免雙重記載。

## [1.17.0] - 2026-11-11

### Added
- 新增第 5 個頂層營地分類 **`私營露營`**（`app.js` `TYPE_META`、`styles.css` `.type-私營露營`、`scripts/audit-data.mjs` 與 `scripts/guard.mjs`），將依《旅館業條例》（第 349 章）《申請賓館（度假營）牌照指引》第 1.9 段豁免賓館牌照之**純自攜營帳草地及車中泊（汽車露營）場地**與公營免費「露營」清晰分開。
- `data.csv` 新增 14 筆經 2026-11 實測驗證具活躍中文預訂連結（`HTTP 200`）之私營自攜草地／車中泊營地（`p01`–`p14`，總數由 **151 → 165 筆**：露營 47、私營露營 14、宿營 59、Glamping 5、民宿 40；`全自備` 61、`場地提供` 104）：
  - **規劃准許（消委會第 572 期引述規劃署確認屬「康樂」地帶經常准許，2 間）**：沙頭角 `禾田喜山種植園`（`p01`）、`營喜野外露營場地`（`p02`）。
  - **合規提示（豁免第 349 章賓館牌，惟提醒團體預訂前核實城規許可及千萬第三者責任保險，12 間）**：錦田 `Autocamper 大江埔汽車露營場`（`p03`）、紅花嶺 `Autocamper 紅花嶺汽車露營場`（`p04`）／`Safari Land（紅花嶺大草原）`（`p05`）、馬灣 `Autocamper 馬灣公園（小島山丘）`（`p06`）、新田 `山林里農莊 Forest Pathway`（`p07`）／`森之谷 Forest Valleyland`（`p08`）、下白泥 `藉夕野營 Jac Jac Camping`（`p09`）、八鄉 `小白兔音樂農莊（自攜露營區）`（`p10`）、錦田 `Urban Quit 離城營地`（`p11`）／`NutsCamping（錦田車中泊及自攜草坪）`（`p12`）、打鼓嶺 `湖畔山谷 Lakeside Valley（野外自攜露營區）`（`p13`）、大埔汀角 `龍・Home（汀角汽車露營及自攜區）`（`p14`）。
- `app.js` 卡片新增 `complianceBadge()` 兩級合規提示徽章（`✅ 規劃准許（康樂地帶）・豁免賓館牌・請核實保險` vs `⚠️ 豁免賓館牌・城規及第三者保險待核實`），並支援以 `車中泊`、`自攜營帳`、`規劃准許`、`合規提示` 標籤篩選。

### Changed
- `index.html` `#scopePanel` 及 `docs/out-of-scope/README.md` 更新私人農地露營「三閘口」（第 349 章牌照、城規會規劃許可、地政總署地契／短期豁免書＋千萬第三者保險）說明，並明確記錄經查證已清拆／結業／停約而不收錄之場地（大埔船灣香港傷健協會賽馬會傷健營／展能運動村、上水虎地山莊、屯門掃管笏稻場、大嶼山長沙海邊民園、逢吉鄉 WeCamp、大棠綠行鳥營地等）。

## [1.16.0] - 2026-11-11

### Added
- `data.csv` 新增 15 筆經民政事務總署牌照事務處 CSDI `LLHG`（2026-11-01，1,807 間）核實之第 349 章持牌處所（總數由 **136 → 151 筆**：露營 47、宿營 59、Glamping 5、民宿 40）：
  - **持牌露營車／太空艙營地（`g05`）**：北區打鼓嶺 `世外桃源 Park Nature Hillside`（`H/6756`）。
  - **持牌古蹟活化體驗營舍（`n59`）**：西貢將軍澳寶琳南路 `靈風雅舍（將軍澳風物汛）`（基督教靈實協會，`H/6466`）。
  - **持牌鄉郊體驗村及離島民宿（`b28`–`b40`）**：沙頭角 `荔枝窩客家生活體驗村`（`H/6717` 等 6 處所）、荃灣 `馬灣 1868 臨海度假屋`（`H/6796` 等 6 處所）、大嶼山大澳 `大澳文物酒店`（`H/4616`）／`歸田園居`（`H/4528`）／`海悠居`（`H/6689`）、大嶼山水口 `Lantau Lodge`（`H/6205`）、東涌牛凹村 `城市綠洲 City Oasis`（`H/5714`）、梅窩 `Banyan`（`H/6710`），以及南丫島 `浪濤軒`（`H/1979`）／`碧海軒`（`H/3537`）／`Bayshore Inn`（`H/6124`）／`天青 Re.Lamma`（`H/6696`）／`華軒`（`H/3837`）。
- `index.html`、`styles.css`、`app.js` 新增 `#scopePanel`「收錄準則＋點解元朗／大嶼山部分私人營地或露營車無收錄？」可收合面板及搜尋無結果 `#emptyOpenScope` 一鍵展開入口，引用牌照事務處名單、消委會《選擇》第 572 期查核結果及政府新聞公報 `P2026062900237` 公開說明不收無牌私營場地及純草地營之原因。

### Changed
- `data.csv` 將 `g02 西園` 修正為 CSDI `LLHG` 官方精確座標並標明牌號 `H/6668`，同時於未見於第 349 章持牌名單之早期種子列 `g01`、`g03`、`g04` 補上合規與第三者保險核實提示。
- `tools-sync-had.mjs` 擴充 `RURAL_DISTRICTS`（加入 `新界`）、中英文渡假／露營車關鍵字（`CARAVAN|GLAMPING|CAMP|RESORT|LODGE|INN|OASIS|體驗村` 等）及細區規則，確保日後按 2026-06 新指引獲批牌照之私人營地／露營車可由月更自動捕獲。
- `build-data.mjs` 新增荔枝窩、水口、馬灣潮汐站配對，並加入 `slimTransit` 去除 `transit.js` 內未用重複欄位（`dist/` 總體積由 990.3 KB 降至 **924.8 KB**）。

## [1.15.0] - 2026-11-11

### Added
- `data.csv` 新增 28 筆經官方名單及 2026 實測 HTTPS 驗證之活躍場地（`n31`–`n58`，總數由 **108 → 136 筆**：露營 47、宿營 58、Glamping 4、民宿 27）：
  - **香港青年旅舍協會（HKYHA）全線 7 間（`n31`–`n37`）**：白沙澳、白普理堂赤徑、昂坪戴維斯、施樂園大帽山、賽馬會摩星嶺、白普理賽馬會大美督及美荷樓青年旅舍。
  - **21 個公營、制服團體及非政府機構營地／營舍（`n38`–`n58`）**：青年廣場 Y 旅舍、民安隊大灘及圓墩訓練營、女童軍新德倫山莊／元朗康樂中心／梁省德海上活動訓練中心、明愛賽馬會明暉營／愛暉營／家暉苑、獅子會-青年會將軍澳青年營、童軍沙田童軍中心／大美督海上活動中心、少年領袖團萬宜訓練營、賽馬會長洲鮑思高青年中心、佛聯會陳馬美玉紀念康樂營、循道衛理衛理園、協進會白普理退修中心、港青南丫島戶外及環保活動中心、信義會榮真堂營地、綠匯學苑（舊大埔警署）及太陽村莊（馬灣公園）。
- `tools-sync-had.mjs` 及 `.github/workflows/sync-had.yml` 接入 CSDI 第 376 章《會社（房產安全）條例》合格證明書圖層（`had_rcd_1639474881869_90085` `layer_name=CLUB`），每月自動產出 `data/auto/had-yha-clubs.json` 並於 `had-diff-report.md` 核對青年旅舍會社證與新增 NGO 旅館牌照。
- `docs/out-of-scope/README.md` 記錄經查核已停辦／重建／收回或只限特定內部對象之營地（馬草壟、展能運動村、粉嶺宣道園、蔡志明聯光、信義會道恩、香港少林武術文化中心、樟木頭老人度假中心及內部紀律訓練中心），避免日後誤收死場。

### Changed
- `build-data.mjs` 將 `RAIN_ALIAS` 擴充至全港 18 區（支援中西區、灣仔區、深水埗區等新增場地），並為白沙澳、赤徑、摩星嶺及流浮山補齊就近潮汐站配對。
- `lib/transit-snapshot.mjs` 與 `.github/workflows/transit-poc.yml` 解除新營地入庫與交通快照驗證之互鎖：`publish-transit.mjs` 維持 100%（136/136）嚴格覆蓋門檻，而 `build-data.mjs` 容許新加入 `data.csv` 嘅場地喺下一次 `transit-poc.yml` 執行前顯示「暫未有此營地配對資料」；`transit-poc.yml` 抓取前自動先跑 `node build-data.mjs`。

## [1.14.3] - 2026-11-11

### Added
- 補齊專案治理與 Agent 入口文件：`AGENTS.md`、`SCOPE.md`、`GLOSSARY.md`、`CONTRIBUTING.md`、`CHANGELOG.md`、`docs/` 索引與 `docs/out-of-scope/`、`.env.example`。
- `index.html` 補齊 `<link rel="canonical">`、`og:url`、Schema.org `WebSite`/`Dataset` JSON-LD 結構化資料，以及 Leaflet 1.9.4 CSS/JS SHA-256 SRI `integrity` 驗證。
- `scripts/guard.mjs` 新增第 19 項守護（A16 外部 GitHub Actions 40-hex SHA 釘選、F15 禁止行內散裝版號註解、G11 禁止 `icons/*.svg`、SEO canonical/JSON-LD 及 CDN SRI 檢查），並於 `scripts/audit-data.mjs` 新增漁護署 `a*` 官方網址路徑驗證。

### Changed
- `.github/workflows/{guard,sync-data,sync-had,transit-poc}.yml` 全部 9 處外部 Actions 由浮動 `@v4` 改釘 40-hex commit SHA 並保留 `# vX.Y.Z` 註解供 Dependabot 識別（A16）；`guard.yml` 擴充為跑齊 `guard`、完整 `npm test`、`npm run audit` 及 `npm run ui`。
- `vercel.json` 補上 `Strict-Transport-Security` 與 `X-Permitted-Cross-Domain-Policies` 安全標頭；`styles.css` 移除唯一一處 `!important`。
- 清理 `build-data.mjs`、`build-site.mjs`、`lib/stations.mjs`、`scripts/guard.mjs`、`scripts/ui-check.mjs` 內散落嘅 `// vX.Y` 註解（F15），並收緊 `build-site.mjs` 圖標複製只限 `.png/.ico`（G11）。
- `AUTOMATION.md` 記錄香港青年旅舍（HKYHA）於康文署名單、民政事務總署第 349 章（`LLHG`）與第 376 章合格證明書會社（CSDI `had_rcd_1639474881869_90085` `CLUB` 圖層）之結構差異與自動化可行性。

### Fixed
- 修正 `data.csv` `a14`（浪茄灣營地）漏寫 `/cou_vis/` 嘅漁護署失效連結，並把已實測支援 HTTPS 嘅 6 個 NGO 營舍網址（`n06, n07, n20, n21, n25, n27`）升級為 `https://`，重建 `data.js`。
- 修正 `README.md`、`GITHUB-SETUP.md`、`HANDOVER-STATUS.md`、`PROGRESS.md` 及 `.github/PULL_REQUEST_TEMPLATE.md` 內過時描述（如「全站零圖片」、舊報料掣、19 欄 CSV、`dist` 4 檔、配站規則及網域狀態）。

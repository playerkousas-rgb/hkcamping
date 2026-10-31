# 香港公共交通資料：自動更新可行性測試

**測試日期：2026-10-31（香港時間）**

**狀態：官方來源/API 測試及 v1.14.0 網站交通整合已完成：卡片展開／收合站點與路線、比較表、路線搜尋、最近站直線距離排序及手機快速導覽均已接入。每週 GitHub Actions 會抓取官方 feed、fail-closed 驗證 108 個營地，並自動提交精簡 `data/auto/transit.json`／`transit.js`；完整診斷仍只保留 30 日 artifact。首個整合版 Actions run `41160349725` 已成功並自動提交網站快照；現再把輸出收斂至每種交通最近 2 個站、每站最多 5 條路線及緊湊 JSON，確保部署體積預算，這個最新縮小版待下一次 Actions 驗證。**

## 結論

- **靜態站點／路線資訊：全自動網站發布流程已實作，官方 feed 有 live 驗證。** GitHub Actions run #4 成功讀取運輸署 `JSON_BUS.json` + `JSON_GMB.json`，處理 `data.js` 全部 108 個營地：巴士 56,103 筆 features／8,216 個唯一站點，小巴 13,165 筆 features／4,779 個唯一站點。直線 500 米內分別覆蓋 44/108、26/108；1 公里內 53/108、33/108。座標衝突 0，同名完全匹配 11。v1.14.0 workflow 會把經驗證的最近站／路線精簡資料自動發布至網站；完整 JSON／Markdown 診斷仍只保留 30 日 artifact。距離只是直線距離，不等於步行可達性或整體交通服務品質。NLB API 的既有測試另找到「南山營地 / Nam Shan Camp Site」同名站點，直線距離約 247 米。
- **實時到站：端點可以回傳資料，但暫不建議接入網站。** GMB、KMB/LWB、城巴和港鐵均有成功的 GET smoke test；惟網站瀏覽器 CORS、各營運者完整使用條款及數值化流量上限尚未驗證。GitHub Actions 的排程不能提供分鐘級或十秒級 ETA 新鮮度。
- **已整合靜態站點／路線，不接即時 ETA。** 網站只使用運輸署官方快照；每週自動建置，卡片交通明細可展開／收合，比較列出附近站點，搜尋可找站名／路線，排序只按直線距離。資料缺失時不假裝附近沒有交通，舊快照會明示過期。

## 1. 實測來源與結果

| 來源 | 已實測端點／payload | 官方更新頻率 | 本次判斷 |
|---|---|---|---|
| **運輸署專線小巴（GMB）即時 API** | [Route 7](https://data.etagmb.gov.hk/route/NT/7) 回傳西貢—海下路線，`routeId=2002339`；[route-stop](https://data.etagmb.gov.hk/route-stop/2002339/1)、[stop](https://data.etagmb.gov.hk/stop/20001128) 和 [ETA](https://data.etagmb.gov.hk/eta/route-stop/2002339/1/3) 均成功。stop 回傳北潭涌巴士總站 WGS84 座標 `22.3972348, 114.3193594`。 | 官方稱 ETA 每分鐘更新；其他資料有需要時更新，並稱已覆蓋所有 GMB 路線。 | GET 測試沒有帶 API key；route/stop/ETA 關係與 payload 可用。route 7 回應的 `generated_timestamp` 是 2026-10-31，但其 `data_timestamp` 是 2026-06-29，不能把回應生成時間當成源資料更新時間。 |
| **運輸署雙週交通路線／票價 GeoJSON** | [官方資料集](https://data.gov.hk/en-data/dataset/hk-td-tis_23-routes-fares-geojson)列出 `JSON_GMB.json`、`JSON_BUS.json`、巴士站座標及 CSDI API。我直接讀取 [JSON_GMB.json](https://static.data.gov.hk/td/routes-fares-geojson/JSON_GMB.json)：GeoJSON `FeatureCollection` 以站點為 Point feature，樣本含 `routeId`、`routeName*`、`routeSeq`、`stopSeq`、`stopId`、三語站名、`fullFare`、`journeyTime`、`lastUpdateDate` 等。 | 雙週。 | **官方 feed 已由 Actions live run 驗證可用**：完整 `JSON_BUS.json` / `JSON_GMB.json` 分別解析出 56,103／13,165 筆 features。`JSON_BUS.json` 以 UTF-8 BOM 開頭，POC 已自動剝除 BOM 後解析；頁面讀取工具先前的 HTTP 500 不代表來源停用。Actions 暫存原始 feed，只輸出場地附近的小型配對結果，不把原始資料複製進網站。CSDI 巴士路線／站點 API 仍未作替代路徑驗證。 |
| **九巴／龍運（KMB/LWB）** | [路線清單](https://data.etabus.gov.hk/v1/transport/kmb/route/)成功；94 號線 outbound 站序回傳 26 個站；[站點](https://data.etabus.gov.hk/v1/transport/kmb/stop/3205DE941791278B)為黃石碼頭總站，座標 `22.434752, 114.336736`；[ETA](https://data.etabus.gov.hk/v1/transport/kmb/eta/3205DE941791278B/94/1)成功。 | ETA 每分鐘；其他資料每日更新。 | 測試沒有帶 API key。ETA payload 同時可能包含預定班次與實時／未標記為 scheduled 的記錄；顯示時須保留來源類型及時間戳，不能混為同一種即時到站。 |
| **城巴（CTB）** | 官方 v1 API 的 [route-stop](https://rt.data.gov.hk/v1/transport/citybus-nwfb/route-stop/CTB/1/inbound) 回傳 18 個站序；[stop](https://rt.data.gov.hk/v1/transport/citybus-nwfb/stop/002403) 回傳跑馬地（上）座標 `22.264400182091, 114.18864188053`；[ETA](https://rt.data.gov.hk/v1/transport/citybus-nwfb/eta/CTB/002403/1) 回傳到站時間和 `data_timestamp`。另測得 v2 route list 可用。 | ETA 每分鐘；其他資料於調整時更新。 | GET 測試沒有帶 API key。官方 API 規格列有 HTTP 429（請求過多），但沒有在已檢查資料中找到可依賴的數值化配額；須作節流、快取及退避處理。 |
| **新大嶼山巴士（NLB）** | [路線清單](https://rt.data.gov.hk/v2/transport/nlb/route.php?action=list)和 route 2（`routeId=4`）的[站點清單](https://rt.data.gov.hk/v2/transport/nlb/stop.php?action=list&routeId=4)成功。`stopId=9` 的中英文名是「南山營地 / Nam Shan Camp Site」，座標 `22.255451, 113.986811`。現有 `data.js` 的南山營地座標 `22.2533, 113.9862`，兩者直線相距約 **0.247 km**。對應 [ETA 查詢](https://rt.data.gov.hk/v2/transport/nlb/stop.php?action=estimatedArrivals&routeId=4&stopId=9&language=zh)回傳「未來 60 分鐘沒有班次途經本站」。 | data.gov.hk 標示 Real-time；本次 route list payload 沒有 `generated_timestamp`，未能從 payload 獨立量度更新間隔。 | 站點座標與路線映射可用，且有一個官方名稱直接配對的營地例子。ETA endpoint 有回應，但本次沒有取得正 ETA，故不把它當成已驗證的正向 ETA 樣本。測試沒有帶 API key。247 米是直線距離，不等同可行步行路線。 |
| **港鐵（MTR）** | [Next Train API](https://rt.data.gov.hk/v1/transport/mtr/getSchedule.php?line=ISL&sta=CEN&lang=TC) 的港島線中環站查詢成功，回傳列車方向、時間、月台和 `ttnt` 等 JSON。MTR 路線／車站 CSV 資料集標示每月更新，但本次官方 CSV 直取回 HTTP 500。另試用[地政總署 Location Search API](https://portal.csdi.gov.hk/csdi-webpage/apidoc/LocationSearchAPI) 搜尋 Central MTR Station，結果包含站內設施、出入口及站點等多筆，座標為 HK80 平面座標；未能直接得出單一、穩定的車站點。 | Next Train 官方稱每 10 秒更新；MTR CSV 每月。Location Search 文件提醒勿在短時間大量呼叫。 | Next Train 測試沒有帶 API key。現階段沒有驗證到可供全港營地配對的 MTR 站點座標來源；地名搜尋結果需再驗證去重規則及轉換座標，不能直接大批量查詢。即時到站 API 成功不等於已具備站點地理配對資料。 |

## 2. 認證、使用條款、限流與瀏覽器可用性

- 上述 smoke test 都是未帶 API key 的 GET 請求，且成功端點回傳 JSON；這證明本次請求不需要另帶 key，**不代表已確認服務 SLA、長期可用性或允許無限制抓取**。
- [DATA.GOV.HK FAQ](https://data.gov.hk/en/faq) 說明資料可免費重用，但須遵守 DATA.GOV.HK 及相關網站各自的使用條款；FAQ 亦排除資料轉售。NLB、城巴、KMB/LWB、MTR 的原始資料權利分別由營運者持有，正式部署前仍須逐一核對相關條款和署名要求。
- 城巴 API 規格明列 429「Processing too many requests」；本次沒有查到可採用的固定每分鐘配額。其他 API 亦不能因本次未遇到限流，就視為沒有流量限制。建議採用低頻批次、快取、退避和超時保護。
- **沒有做實際瀏覽器 CORS 測試。** `fetch_page` 能讀到端點，不代表 Vercel 網站的瀏覽器 origin 可以直接 `fetch()`。即時 ETA 應先在實際網站 origin 驗證 CORS；若失敗，只考慮符合來源條款、可自動運作的代理方案，不用 GitHub Actions 假扮即時服務。

## 3. GitHub Actions 自動化判斷

### 靜態站點／路線資料：全自動 POC 官方 live run 成功（2026-10-31）

POC 程式及排程 workflow 已加入 repo：

1. `scripts/transit-poc.mjs` 每次執行會下載官方雙週 `JSON_BUS.json` 和 `JSON_GMB.json`；有網路錯誤、HTTP 429/5xx 會有限次重試，自動處理 BOM，仍失敗或 JSON／schema 不合即 fail-closed。首次官方 live run 已證實兩份完整 feed 可在 Actions runner 下載和解析。
2. `scripts/transit-poc-core.mjs` 依官方 route-stop features 合併同營運者／站點 ID 的路線，載入 `data.js` 全部場地座標，計算每個場地最近 5 個巴士站及 5 個 GMB 站；距離為直線米數，另統計 250m、500m、1km、2km、5km 覆蓋。
3. 以站點名稱、路線、營運者、更新欄位及重複座標衝突輸出品質診斷；不把最近站稱作可步行或直達，也不請人手選取／覆核配對。
4. `.github/workflows/transit-poc.yml` 每週自動執行，亦在來源 parser／前端整合改動時觸發；抓取與配對通過後，由 `scripts/publish-transit.mjs` 產生精簡 `data/auto/transit.json`，`build-data.mjs` 驗證並輸出 `transit.js`，測試與部署建置全通過後，自動 commit/push 快照到觸發分支。pull request 只驗證、不寫入。原始 feed 和完整診斷仍上傳 30 日 artifact；workflow 有 `contents: write`，但不改 `data.csv`。
5. `node --test scripts/transit-poc.test.mjs` 覆蓋 BOM、官方格式樣本、路線合併、108 個營地全處理、距離、欄位異常與 fail-closed；本機亦以合成 fixture 驗證完整輸出和 GitHub 摘要流程。

**首次 live run 結果**：[GitHub Actions run #4](https://github.com/playerkousas-rgb/hkcamping/actions/runs/41156262810) 已成功完成（commit `a4657fd`）；摘要及 [30 日 artifact `transit-poc-4`](https://github.com/playerkousas-rgb/hkcamping/actions/runs/41156262810) 均已發布。完整 feed 覆蓋數據：

| 模式 | Feed features | 唯一站點 | 最近站在 250m 內 | 500m 內 | 1km 內 | 2km 內 | 5km 內 |
|---|---:|---:|---:|---:|---:|---:|---:|
| 巴士 | 56,103 | 8,216 | 32/108 | 44/108 | 53/108 | 66/108 | 88/108 |
| 專線小巴 | 13,165 | 4,779 | 17/108 | 26/108 | 33/108 | 48/108 | 64/108 |

座標衝突 0、營地與站名完全相同 11 個。覆蓋是**最近官方站點的直線距離**；不能解讀為步行距離、步道入口可達性、班次充足度或實際交通服務覆蓋。巴士與小巴覆蓋會重疊，以上不相加。Agent sandbox 因外部 artifact blob host 限制，未能自行下載 artifact；GitHub 已確認 artifact 上傳成功（127,115 bytes），workflow 的 parser / 108 筆全處理驗證與 summary 均通過。靜態官方站點／路線整合已按使用者批准實作於 v1.14.0；首個整合版 workflow [run `41160349725`](https://github.com/playerkousas-rgb/hkcamping/actions/runs/41160349725) 已成功並自動提交網站快照，最新縮小版仍待下一次 Actions 驗證。即時 ETA 不在批准範圍內。

### 實時 ETA：不適合由 GitHub Actions 供應

ETA 更新頻率約 10 秒至 1 分鐘，而 GitHub Actions 排程不能保證這種刷新頻率。若網站要顯示 ETA，應只在確認 CORS、來源條款、限流、錯誤及舊資料提示後，才評估由瀏覽器按需讀取官方 API，或使用符合條款的自動代理；否則不顯示 ETA。

## 4. 建議決定

**靜態交通資訊已批准並接入網站，不只存為 Actions artifact。** Live run 已成功產生 108 個營地配對；v1.14.0 會以每週 schedule 自動抓取、全量配對、fail-closed 驗證、更新快照並推送網站來源。最近站點以直線距離計，不能當作步行可達性；資料新鮮度會提示，沒有快照時 UI 會說待同步。即時 ETA 未整合；若日後考慮，須另行驗證 CORS、條款與限流。

不新增 GoCampingHK 的主觀難度、營友經驗、人氣或評分，也不接受依賴人工覆核、手動更新或眾包的流程。

## 官方來源

- [運輸署：專線小巴實時到站資料集](https://data.gov.hk/en-data/dataset/hk-td-sm_7-real-time-arrival-data-of-gmb)
- [運輸署：公共交通路線及票價 GeoJSON 資料集](https://data.gov.hk/en-data/dataset/hk-td-tis_23-routes-fares-geojson)
- [運輸署：九巴／龍運 ETA 資料集](https://data.gov.hk/en-data/dataset/hk-td-tis_21-etakmb)
- [城巴：Next Bus 資料集](https://data.gov.hk/en-data/dataset/ctb-eta-transport-realtime-eta)；[城巴 API 規格](https://www.citybus.com.hk/datagovhk/bus_eta_spi_specifications.pdf)
- [新大嶼山巴士：第二代巴士服務資料集](https://data.gov.hk/en-data/dataset/nlb-bus-nlb-bus-service-v2)
- [港鐵：實時列車資料集](https://data.gov.hk/en-data/dataset/mtr-data2-nexttrain-data)；[路線、車站及無障礙設施資料集](https://data.gov.hk/en-data/dataset/mtr-data-routes-fares-barrier-free-facilities)
- [地政總署 Location Search API 文件](https://portal.csdi.gov.hk/csdi-webpage/apidoc/LocationSearchAPI)
- [DATA.GOV.HK FAQ（重用條款說明）](https://data.gov.hk/en/faq)

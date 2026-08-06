# NOC Network Incident Copilot

NOC 網路障礙監控與事件處理模擬平台，是一套可離線展示的 React 前端作品。它以清楚的繁體中文介面模擬 NOC 人員從告警接收、AI 初判、查測、聯絡、通報、追蹤到結報的完整流程。

> 安全聲明：本系統所有設備、IP、帳號、聯絡人、告警及查測結果皆為模擬資料，未連接任何正式企業網路。系統不執行真實 Ping、Traceroute 或 SNMP，不串接 Microsoft Teams 或真實 AI API。

## 功能

- 三種 Demo 角色登入、登出與即時角色切換
- Dark NOC、Light Enterprise、AI Copilot 三種主題（localStorage 保存）
- Dashboard 統計、告警圖表、事件趨勢與重大事件
- 告警搜尋、嚴重度／區域／狀態篩選及同步 AI 診斷
- 網路拓樸、節點詳情、障礙／維護／未知狀態與備援路徑
- 規則式 AI Diagnosis、信心分數、判斷依據與建議
- 十步一鍵模擬查測、進度動畫、結果複製
- 事件生命週期、狀態更新、手動時間軸紀錄
- 初報、續報、結報產生器與事件聯絡人
- 簡化台灣區域監控圖與區域篩選
- SNMP Lab 告警產生、隨機告警、模擬恢復與重設
- NOC 大螢幕、即時時鐘、跑馬燈與全螢幕
- 管理員設備 CRUD、帳號核准／拒絕／停用／角色調整
- 桌面與手機響應式介面、Toast、確認視窗與空資料狀態

## 技術架構

React 18、TypeScript、Vite、React Router、Zustand、Lucide React、Recharts 與原生 CSS。資料集中於前端 mock modules，狀態透過 Zustand persist 保存至 localStorage，無後端需求。

## 安裝與執行

首次使用先安裝相依套件：

```bash
npm install
```

僅在本機開發：

```bash
npm run dev
```

### 區域網路展示模式

報告當天，先讓展示電腦與手機／其他電腦連上同一個 Wi-Fi，再於專案目錄執行：

```bash
npm run dev:lan
```

此指令會以 `0.0.0.0` 作為 host，並固定使用 port `5173`。在展示電腦上開啟：

```text
http://localhost:5173/
```

查詢展示電腦的區域網路 IPv4：

```powershell
ipconfig
```

在輸出中找到目前使用中的 Wi-Fi 網路介面，記下「IPv4 位址」，例如 `192.168.1.100`。接著在同一個 Wi-Fi 中的手機或其他電腦開啟：

```text
http://192.168.1.100:5173/
```

請將範例 IP 替換為展示電腦實際的 IPv4。第一次啟動時，Windows 防火牆可能詢問是否允許 Node.js 通訊，請勾選「私人網路」並允許存取；不要開放公用網路。若無法連線，請確認裝置位於同一個 Wi-Fi、Windows 網路設定為私人網路，且防火牆允許 TCP port `5173` 或 Node.js。

此模式僅供可信任的現場區域網路展示，不需要設定小烏龜、分享器或連接埠轉送。終止展示伺服器請在終端機按 `Ctrl+C`。

正式編譯：

```bash
npm run build
npm run preview
```

線上展示：

https://xxxx00001235-tech.github.io/noc-network-incident-copilot/

## Demo 帳號

| 角色 | 帳號 | 密碼 |
|---|---|---|
| 一線人員 | `operator` | `123456` |
| 設備管理員 | `engineer` | `123456` |
| 系統管理員 | `admin` | `123456` |

## 專案結構

```text
src/
├─ components/
│  ├─ common/       # 共用卡片、狀態與空資料元件
│  ├─ diagnosis/    # 規則式 AI 診斷
│  ├─ layout/       # 導覽、Header 與主題切換
│  └─ testing/      # 模擬查測流程
├─ data/            # 集中式假資料
├─ pages/           # 登入、營運與平台管理頁
├─ store/           # Zustand 持久化狀態
├─ types/           # TypeScript 資料模型
├─ App.tsx          # Router
└─ styles.css       # 主題與響應式設計
```

## SNMP Lab

選擇任一模擬告警會新增告警與事件、更新 Dashboard 與設備狀態，並可立即查看規則式 AI 診斷。模擬恢復會清除作用狀態；重設 Lab 會移除本次瀏覽器保存的 Lab 資料。

## 假資料與限制

保留案例包含台北南港核心交換器障礙、台北信義維護、桃園 CPU 過高與新竹 Optical LOS。保留文件所需的私有樣式 IP 僅作示意；Lab 使用 RFC 5737 文件網段。剪貼簿與全螢幕功能依瀏覽器權限運作。AI Diagnosis 是規則式結果，不具有機器學習推論能力；Teams 功能只產生與複製文字。

## 未來擴充

- 以 IndexedDB 支援更大量離線事件與匯出／匯入
- 加入單元測試、E2E 測試及視覺回歸測試
- 增加拖曳式拓樸編輯器與更多圖表
- 在取得正式資安與權限設計後，再建立可替換的後端介面
- 加入 i18n、多租戶與更細緻的 RBAC 權限

## FastAPI WebSocket 告警

FastAPI 服務提供 `WS /ws/alarms`；收到 `POST /api/alarms` 後會立即推送告警，
Dashboard、告警中心與拓樸共用同一份即時狀態。Critical／Major 新告警會播放提示音。

```powershell
python -m pip install -r fastapi_app/requirements.txt
python -m uvicorn fastapi_app.main:app --host 0.0.0.0 --port 8000
```

### FastAPI PostgreSQL

FastAPI 預設使用 `sqlite:///./fastapi_app/noc.db` 作為本機備援。正式 PostgreSQL
環境請設定 `DATABASE_URL`，先執行 Alembic，再啟動服務：

```bash
export DATABASE_URL='postgresql+psycopg://noc_user:noc_password@localhost:5432/noc_copilot'
alembic upgrade head
python scripts/migrate_sqlite_to_postgresql.py --target "$DATABASE_URL"
python -m uvicorn fastapi_app.main:app --host 0.0.0.0 --port 8000
```

完整建立、搬移、驗證與回復 SQLite 步驟請見 `docs/database-migration.md`。
## 本機唯讀監控（期末版本第一階段）

公開網站預設維持 `demo` 模式，不會讀取使用者的電腦。若要在目前這台
Windows 電腦測試 CPU、記憶體、磁碟與網路統計，可執行：

```powershell
npm run dev:full
```

再開啟 `http://localhost:5173/`。本機監控 API 位於
`http://127.0.0.1:3001`，固定只監聽 loopback，不會開放到區域網路或
網際網路。只要使用 `localhost` 開啟系統，前端就會自動使用本機即時資料；
Cloudflare 與 GitHub Pages 則維持安全的展示資料。`dev:full` 不需要手動修改 `.env`。
若 5173 已被舊的開發伺服器占用，先在舊終端機按 `Ctrl+C`。可分別測試：

```powershell
npm run dev:monitor
npm run test:monitor
```

`.env`、SQLite、執行紀錄與本機資料均已由 `.gitignore` 排除。API 不會
回傳使用者名稱、電腦名稱、MAC Address、序號、個人檔案、瀏覽紀錄或憑證。

監控服務每 5 秒寫入 SQLite，保留最近約 24 小時資料，並依下列門檻建立及
解除告警：

- CPU：Warning 70%、Critical 90%
- 記憶體：Warning 75%、Critical 90%
- 系統磁碟：Warning 80%、Critical 90%

歷史與告警 API：

```text
GET /api/metrics/history?limit=120
GET /api/alerts?limit=50
```

若未來透過 Cloudflare Tunnel 提供遠端查看，必須將
`MONITOR_REQUIRE_CF_ACCESS=true`，並先建立 Cloudflare Access 應用程式。
此時 API 會拒絕沒有 `CF-Access-Jwt-Assertion` 的要求。

## Backend 基礎架構

本專案保留既有 `server/`，以增量方式加入 PostgreSQL 基礎，不建立平行專案。

### 啟動與測試

```bash
pnpm install
cp .env.example .env
pnpm run dev:backend
pnpm run test:backend
```

基礎端點：

- `GET /api/health`：程序存活狀態，不依賴 PostgreSQL。
- `GET /api/ready`：PostgreSQL readiness；未設定或無法連線時回傳 HTTP 503。
- `GET /api/version`：Backend 名稱、版本與環境。
- 既有本機監控端點完整保留。

### PostgreSQL Migration

確認 Ubuntu 的 `noc-postgres` 已啟動，並在 `.env` 填入正確的 `PGPASSWORD` 後執行：

```bash
pnpm run db:migrate
```

Migration 會建立 `noc` schema、`noc.schema_migrations` 與基礎 metadata。密碼只放在未追蹤的 `.env`，不可提交 Git。

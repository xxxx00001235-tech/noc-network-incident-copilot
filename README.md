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

```bash
npm install
npm run dev
```

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

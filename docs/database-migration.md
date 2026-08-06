# SQLite 到 PostgreSQL 遷移

FastAPI 的 SQLite 與 PostgreSQL 共用 `fastapi_app.models`。SQLite 是本機備援，會保留
既有 additive compatibility migration；PostgreSQL schema 僅由 Alembic 管理。

## 1. 建立 PostgreSQL 帳號與資料庫

以下指令需由 PostgreSQL 管理員執行，密碼請替換成環境專用密碼，不要提交到 Git：

```sql
CREATE USER noc_user WITH PASSWORD 'replace-with-a-strong-password';
CREATE DATABASE noc_copilot OWNER noc_user ENCODING 'UTF8';
```

建議 PostgreSQL 16 或以上。安裝 Python 相依套件：

```bash
python -m pip install -r fastapi_app/requirements.txt
```

## 2. 設定與建立 schema

Linux/macOS：

```bash
export DATABASE_URL='postgresql+psycopg://noc_user:replace-with-a-strong-password@localhost:5432/noc_copilot'
alembic upgrade head
```

PowerShell：

```powershell
$env:DATABASE_URL='postgresql+psycopg://noc_user:replace-with-a-strong-password@localhost:5432/noc_copilot'
alembic upgrade head
```

不要對 PostgreSQL 呼叫 `Base.metadata.create_all()`；部署流程必須先執行
`alembic upgrade head`。可用下列循環驗證 migration：

```bash
alembic upgrade head
alembic downgrade -1
alembic upgrade head
```

## 3. 搬移既有 SQLite 資料

目標資料庫必須已完成 Alembic 且所有業務表皆為空。腳本會在單一 PostgreSQL
transaction 內依外鍵順序搬移資料，保留原始 ID，並檢查 username、email、
employee_id、incident_id 重複值。發現重複、NULL 違規、非空目的端、筆數或欄位值
不一致時會中止且 rollback，不會覆蓋資料。

```bash
python scripts/migrate_sqlite_to_postgresql.py \
  --source sqlite:///./fastapi_app/noc.db \
  --target "$DATABASE_URL"
```

搬移順序為 `users`、`devices`、`topology_links`、`device_history`、
`alarm_history`、`incidents`、`incident_timeline`。`device_history` 是既有設備稽核
功能所需的第七張表。成功輸出會逐表列出來源／目的筆數；腳本也會比較所有搬移
欄位（時間統一以 UTC 比較）、重設 PostgreSQL identity sequence，而 SQLite 原檔
永遠不會刪除或修改。

## 4. 啟動與驗證 FastAPI

```bash
python -m uvicorn fastapi_app.main:app --host 0.0.0.0 --port 8000
python -m pytest fastapi_app -q
```

應驗證 register/login/JWT/RBAC、User 與 Device CRUD、軟／硬刪除、DOWN/UP incident
生命週期、history/timeline、Dashboard statistics 與 WebSocket payload。

## 5. 回復 SQLite

停止 FastAPI，移除 `DATABASE_URL`（或明確設回預設值）再啟動；現有
`fastapi_app/noc.db` 不會被 PostgreSQL 搬移流程刪除：

```powershell
$env:DATABASE_URL='sqlite:///./fastapi_app/noc.db'
python -m uvicorn fastapi_app.main:app --host 0.0.0.0 --port 8000
```

回復只切換連線，不會把 PostgreSQL 的新資料自動反向同步至 SQLite。

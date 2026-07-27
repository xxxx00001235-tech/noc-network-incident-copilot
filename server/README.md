# Backend

此目錄是既有 `server/index.mjs` 的增量 Backend，不是另一個專案。

## 結構

- `index.mjs`：HTTP 入口與既有監控 API。
- `config/env.mjs`：集中式環境設定與 PostgreSQL 設定檢查。
- `db/postgres.mjs`：PostgreSQL connection pool 與 readiness。
- `db/migrate.mjs`：依序執行 SQL migration。
- `db/migrations/`：版本化 SQL。

## 基礎端點

- `GET /api/health`
- `GET /api/ready`
- `GET /api/version`

目前不包含 AI、SNMP、拓樸、登入或權限功能。

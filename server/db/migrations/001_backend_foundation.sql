CREATE TABLE IF NOT EXISTS noc.backend_metadata (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  service_name TEXT NOT NULL,
  schema_version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO noc.backend_metadata(id, service_name, schema_version)
VALUES (1, 'noc-network-incident-copilot-backend', 1)
ON CONFLICT (id) DO UPDATE SET
  service_name = EXCLUDED.service_name,
  schema_version = EXCLUDED.schema_version,
  updated_at = NOW();

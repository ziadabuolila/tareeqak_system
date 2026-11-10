BEGIN;

CREATE TABLE IF NOT EXISTS public.citizen_devices (
  citizen_id BIGINT NOT NULL REFERENCES public.citizens(id) ON DELETE CASCADE,
  device_id VARCHAR(64) NOT NULL,
  device_label VARCHAR(120) NOT NULL DEFAULT 'هاتف محمول',
  status VARCHAR(16) NOT NULL DEFAULT 'active',
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  blocked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (citizen_id, device_id),
  CONSTRAINT citizen_devices_status_check CHECK (status IN ('active','blocked'))
);

CREATE INDEX IF NOT EXISTS citizen_devices_citizen_status_idx
  ON public.citizen_devices (citizen_id, status, last_seen_at DESC);

ALTER TABLE public.citizen_devices ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  app_db_role TEXT := COALESCE(NULLIF(current_setting('app.tareeqak_db_role', true), ''), '');
BEGIN
  IF app_db_role <> ''
    AND app_db_role NOT IN ('anon', 'authenticated')
    AND EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = app_db_role) THEN
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.citizen_devices TO %I', app_db_role);
    IF NOT EXISTS (
      SELECT 1 FROM pg_catalog.pg_policies
      WHERE schemaname='public' AND tablename='citizen_devices' AND policyname='tareeqak_server_role_access'
    ) THEN
      EXECUTE format('CREATE POLICY tareeqak_server_role_access ON public.citizen_devices FOR ALL TO %I USING (true) WITH CHECK (true)', app_db_role);
    END IF;
  END IF;
END;
$$;

COMMIT;

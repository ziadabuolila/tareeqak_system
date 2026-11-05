-- Tareeqak PostgreSQL schema for Supabase.
-- Safe to run repeatedly: it creates missing objects and does not drop tables,
-- rows, triggers, policies, or other database objects.

CREATE TABLE IF NOT EXISTS public.users (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(255) NOT NULL UNIQUE,
  email VARCHAR(255) UNIQUE,
  email_verified_at TIMESTAMPTZ,
  password VARCHAR(255) NOT NULL,
  role VARCHAR(32) NOT NULL DEFAULT 'citizen',
  status VARCHAR(32) NOT NULL DEFAULT 'active',
  employee_number VARCHAR(64),
  job_title VARCHAR(120),
  department VARCHAR(120),
  employment_type VARCHAR(32),
  hire_date DATE,
  birth_date DATE,
  gender VARCHAR(32),
  national_id VARCHAR(64),
  address TEXT,
  emergency_contact_name VARCHAR(255),
  emergency_contact_phone VARCHAR(64),
  salary NUMERIC(12,2),
  notes TEXT,
  remember_token VARCHAR(100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.citizens (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  gender VARCHAR(32),
  age VARCHAR(32),
  address TEXT,
  governorate VARCHAR(100) NOT NULL,
  city VARCHAR(100) NOT NULL,
  phone VARCHAR(255) NOT NULL UNIQUE,
  national_id VARCHAR(100),
  front_of_card TEXT,
  back_of_card TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT citizens_user_id_foreign
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.personal_access_tokens (
  id BIGSERIAL PRIMARY KEY,
  tokenable_type VARCHAR(255) NOT NULL,
  tokenable_id BIGINT NOT NULL,
  name VARCHAR(255) NOT NULL,
  token VARCHAR(64) NOT NULL UNIQUE,
  abilities TEXT,
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT personal_access_tokens_user_foreign
    FOREIGN KEY (tokenable_id) REFERENCES public.users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.reports (
  id BIGSERIAL PRIMARY KEY,
  reference VARCHAR(64) NOT NULL UNIQUE,
  user_id BIGINT,
  title VARCHAR(255) NOT NULL,
  category VARCHAR(100) NOT NULL,
  description TEXT NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'pending',
  governorate VARCHAR(100) NOT NULL DEFAULT '',
  city VARCHAR(100) NOT NULL DEFAULT '',
  location TEXT NOT NULL,
  image_url TEXT,
  image_data BYTEA,
  image_type VARCHAR(100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT reports_user_id_foreign
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS public.notifications (
  id BIGSERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  kind VARCHAR(32) NOT NULL DEFAULT 'info',
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.system_settings (
  setting_key VARCHAR(190) PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Keep compatibility with databases where employee fields were added later.
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS employee_number VARCHAR(64);
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS job_title VARCHAR(120);
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS department VARCHAR(120);
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS employment_type VARCHAR(32);
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS hire_date DATE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS birth_date DATE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS gender VARCHAR(32);
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS national_id VARCHAR(64);
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS emergency_contact_name VARCHAR(255);
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS emergency_contact_phone VARCHAR(64);
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS salary NUMERIC(12,2);
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS notes TEXT;

-- Indexes used by admin listings, token lookup, report joins, and timelines.
CREATE INDEX IF NOT EXISTS users_role_created_idx
  ON public.users (role, created_at);
CREATE INDEX IF NOT EXISTS personal_access_tokens_tokenable_idx
  ON public.personal_access_tokens (tokenable_type, tokenable_id);
CREATE INDEX IF NOT EXISTS reports_status_created_idx
  ON public.reports (status, created_at);
CREATE INDEX IF NOT EXISTS reports_user_created_idx
  ON public.reports (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_created_idx
  ON public.notifications (created_at DESC, id DESC);

-- Automatically maintain updated_at on tables that have this column.
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  target_table TEXT;
  trigger_name TEXT;
BEGIN
  FOREACH target_table IN ARRAY ARRAY[
    'users',
    'citizens',
    'personal_access_tokens',
    'reports',
    'system_settings'
  ] LOOP
    trigger_name := target_table || '_updated_at';
    IF NOT EXISTS (
      SELECT 1
      FROM pg_catalog.pg_trigger
      WHERE tgrelid = format('public.%I', target_table)::regclass
        AND tgname = trigger_name
        AND NOT tgisinternal
    ) THEN
      EXECUTE format(
        'CREATE TRIGGER %I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()',
        trigger_name,
        target_table
      );
    END IF;
  END LOOP;
END;
$$;

-- Enable RLS on every application table. No policies are granted to anon or
-- authenticated: clients must use the Next.js API, which performs app auth.
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.citizens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personal_access_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Server-only policy. Keep DATABASE_URL private; never expose it to browsers.
DO $$
DECLARE
  target_table TEXT;
BEGIN
  FOREACH target_table IN ARRAY ARRAY[
    'users',
    'citizens',
    'personal_access_tokens',
    'reports',
    'notifications',
    'system_settings'
  ] LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_catalog.pg_policies
      WHERE schemaname = 'public'
        AND tablename = target_table
        AND policyname = 'tareeqak_server_role_access'
    ) THEN
      EXECUTE format(
        'CREATE POLICY tareeqak_server_role_access ON public.%I FOR ALL TO service_role USING (true) WITH CHECK (true)',
        target_table
      );
    END IF;
    EXECUTE format(
      'COMMENT ON POLICY tareeqak_server_role_access ON public.%I IS %L',
      target_table,
      'Allows the trusted server-side service_role only. No direct anon or authenticated client access is granted.'
    );
  END LOOP;
END;
$$;

-- Table comments document the purpose of each application table.
COMMENT ON TABLE public.users IS 'Application accounts for citizens, employees, managers, and admins.';
COMMENT ON TABLE public.citizens IS 'Citizen profile and address details linked one-to-one to users.';
COMMENT ON TABLE public.personal_access_tokens IS 'Hashed bearer-token records used by the application API for sessions.';
COMMENT ON TABLE public.reports IS 'Citizen-submitted reports, their workflow status, and optional binary image data.';
COMMENT ON TABLE public.notifications IS 'Admin-facing notifications generated by report and status changes.';
COMMENT ON TABLE public.system_settings IS 'Key/value storage for administrator-managed platform settings.';
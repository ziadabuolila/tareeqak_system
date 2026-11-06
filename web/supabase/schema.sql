-- Tareeqak PostgreSQL schema for Supabase.
-- Safe to run repeatedly: it creates missing objects and does not drop tables,
-- rows, triggers, policies, or other database objects.
-- Replace this placeholder with databaseRole from `npm run db:check`.
SELECT set_config(
  'app.tareeqak_db_role',
  'REPLACE_WITH_DATABASE_ROLE_FROM_DB_CHECK',
  false
);

DO $$
DECLARE
  app_db_role TEXT := NULLIF(current_setting('app.tareeqak_db_role', true), '');
BEGIN
  IF app_db_role IS NULL
     OR app_db_role = 'REPLACE_WITH_DATABASE_ROLE_FROM_DB_CHECK'
     OR app_db_role IN ('anon', 'authenticated')
     OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = app_db_role) THEN
    RAISE EXCEPTION 'Set app.tareeqak_db_role to the actual DATABASE_URL database role before running this schema';
  END IF;
END;
$$;

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
CREATE INDEX IF NOT EXISTS reports_created_idx
  ON public.reports (created_at DESC, id DESC);
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

DO $$
DECLARE
  app_db_role TEXT := COALESCE(
    NULLIF(current_setting('app.tareeqak_db_role', true), ''),
    ''
  );
  target_table TEXT;
  existing_policy_cmd TEXT;
  existing_policy_permissive TEXT;
  existing_policy_roles NAME[];
  existing_policy_using TEXT;
  existing_policy_check TEXT;
  sequence_name TEXT;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = app_db_role
  ) OR app_db_role IN ('anon', 'authenticated') THEN
    RAISE EXCEPTION 'Configured Tareeqak database role is missing or is a browser role';
  END IF;

  EXECUTE 'REVOKE CREATE ON SCHEMA public FROM PUBLIC, anon, authenticated';
  EXECUTE format('REVOKE CREATE ON SCHEMA public FROM %I', app_db_role);
  EXECUTE format('GRANT USAGE ON SCHEMA public TO %I', app_db_role);

  EXECUTE 'REVOKE ALL PRIVILEGES ON TABLE
    public.users,
    public.citizens,
    public.personal_access_tokens,
    public.reports,
    public.notifications,
    public.system_settings
    FROM PUBLIC, anon, authenticated';

  FOREACH target_table IN ARRAY ARRAY[
    'users',
    'citizens',
    'personal_access_tokens',
    'reports',
    'notifications',
    'system_settings'
  ] LOOP
    EXECUTE format(
      'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO %I',
      target_table,
      app_db_role
    );

    SELECT cmd, permissive, roles, qual, with_check
    INTO existing_policy_cmd, existing_policy_permissive,
         existing_policy_roles, existing_policy_using, existing_policy_check
    FROM pg_catalog.pg_policies
    WHERE schemaname = 'public'
      AND tablename = target_table
      AND policyname = 'tareeqak_server_role_access';

    IF FOUND THEN
      IF existing_policy_cmd <> 'ALL'
         OR existing_policy_permissive <> 'PERMISSIVE'
         OR COALESCE(existing_policy_using, '') NOT IN ('true', '(true)')
         OR COALESCE(existing_policy_check, '') NOT IN ('true', '(true)')
         OR COALESCE(array_length(existing_policy_roles, 1), 0) <> 1
         OR existing_policy_roles[1]::TEXT NOT IN ('service_role', app_db_role) THEN
        RAISE EXCEPTION 'Existing tareeqak_server_role_access policy on public.% must be reviewed', target_table;
      END IF;
      EXECUTE format(
        'ALTER POLICY tareeqak_server_role_access ON public.%I TO %I USING (true) WITH CHECK (true)',
        target_table,
        app_db_role
      );
    ELSE
      EXECUTE format(
        'CREATE POLICY tareeqak_server_role_access ON public.%I FOR ALL TO %I USING (true) WITH CHECK (true)',
        target_table,
        app_db_role
      );
    END IF;

    EXECUTE format(
      'COMMENT ON POLICY tareeqak_server_role_access ON public.%I IS %L',
      target_table,
      'Allows the trusted Tareeqak server database role only.'
    );

    sequence_name := pg_get_serial_sequence(format('public.%I', target_table), 'id');
    IF sequence_name IS NOT NULL THEN
      EXECUTE format(
        'REVOKE ALL PRIVILEGES ON SEQUENCE %s FROM PUBLIC, anon, authenticated',
        sequence_name
      );
      EXECUTE format(
        'GRANT USAGE, SELECT ON SEQUENCE %s TO %I',
        sequence_name,
        app_db_role
      );
    END IF;
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

-- Read-only verification: expected application tables.
SELECT expected.table_name,
  to_regclass(format('public.%I', expected.table_name)) IS NOT NULL AS table_exists
FROM (VALUES
  ('users'),
  ('citizens'),
  ('personal_access_tokens'),
  ('reports'),
  ('notifications'),
  ('system_settings')
) AS expected(table_name)
ORDER BY expected.table_name;

-- Read-only verification: columns currently present on application tables.
SELECT table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN (
    'users', 'citizens', 'personal_access_tokens', 'reports',
    'notifications', 'system_settings'
  )
ORDER BY table_name, ordinal_position;

-- Read-only verification: expected columns missing from existing application tables.
WITH expected_columns(table_name, column_name) AS (
  VALUES
    ('users', 'id'), ('users', 'name'), ('users', 'phone'), ('users', 'email'),
    ('users', 'email_verified_at'), ('users', 'password'), ('users', 'role'),
    ('users', 'status'), ('users', 'employee_number'), ('users', 'job_title'),
    ('users', 'department'), ('users', 'employment_type'), ('users', 'hire_date'),
    ('users', 'birth_date'), ('users', 'gender'), ('users', 'national_id'),
    ('users', 'address'), ('users', 'emergency_contact_name'),
    ('users', 'emergency_contact_phone'), ('users', 'salary'), ('users', 'notes'),
    ('users', 'remember_token'), ('users', 'created_at'), ('users', 'updated_at'),
    ('citizens', 'id'), ('citizens', 'user_id'), ('citizens', 'name'),
    ('citizens', 'gender'), ('citizens', 'age'), ('citizens', 'address'),
    ('citizens', 'governorate'), ('citizens', 'city'), ('citizens', 'phone'),
    ('citizens', 'national_id'), ('citizens', 'front_of_card'),
    ('citizens', 'back_of_card'), ('citizens', 'created_at'), ('citizens', 'updated_at'),
    ('personal_access_tokens', 'id'), ('personal_access_tokens', 'tokenable_type'),
    ('personal_access_tokens', 'tokenable_id'), ('personal_access_tokens', 'name'),
    ('personal_access_tokens', 'token'), ('personal_access_tokens', 'abilities'),
    ('personal_access_tokens', 'last_used_at'), ('personal_access_tokens', 'expires_at'),
    ('personal_access_tokens', 'created_at'), ('personal_access_tokens', 'updated_at'),
    ('reports', 'id'), ('reports', 'reference'), ('reports', 'user_id'),
    ('reports', 'title'), ('reports', 'category'), ('reports', 'description'),
    ('reports', 'status'), ('reports', 'governorate'), ('reports', 'city'),
    ('reports', 'location'), ('reports', 'image_url'), ('reports', 'image_data'),
    ('reports', 'image_type'), ('reports', 'created_at'), ('reports', 'updated_at'),
    ('notifications', 'id'), ('notifications', 'title'), ('notifications', 'body'),
    ('notifications', 'kind'), ('notifications', 'is_read'), ('notifications', 'created_at'),
    ('system_settings', 'setting_key'), ('system_settings', 'value'),
    ('system_settings', 'updated_at')
)
SELECT expected.table_name, expected.column_name AS missing_column
FROM expected_columns AS expected
LEFT JOIN information_schema.columns AS actual
  ON actual.table_schema = 'public'
 AND actual.table_name = expected.table_name
 AND actual.column_name = expected.column_name
WHERE actual.column_name IS NULL
ORDER BY expected.table_name, expected.column_name;

SELECT tc.table_name,
       tc.constraint_name,
       tc.constraint_type,
       STRING_AGG(kcu.column_name, ', ' ORDER BY kcu.ordinal_position) AS columns,
       MAX(ccu.table_name) AS referenced_table,
       STRING_AGG(ccu.column_name, ', ' ORDER BY ccu.column_name)
         FILTER (WHERE tc.constraint_type = 'FOREIGN KEY') AS referenced_columns
FROM information_schema.table_constraints AS tc
LEFT JOIN information_schema.key_column_usage AS kcu
  ON kcu.constraint_schema = tc.constraint_schema
 AND kcu.constraint_name = tc.constraint_name
 AND kcu.table_name = tc.table_name
LEFT JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_schema = tc.constraint_schema
 AND ccu.constraint_name = tc.constraint_name
 AND tc.constraint_type = 'FOREIGN KEY'
WHERE tc.constraint_schema = 'public'
  AND tc.table_name IN (
    'users', 'citizens', 'personal_access_tokens', 'reports',
    'notifications', 'system_settings'
  )
GROUP BY tc.table_name, tc.constraint_name, tc.constraint_type
ORDER BY tc.table_name, tc.constraint_type, tc.constraint_name;

-- Read-only verification: application indexes.
SELECT schemaname, tablename, indexname, indexdef
FROM pg_catalog.pg_indexes
WHERE schemaname = 'public'
  AND tablename IN (
    'users', 'citizens', 'personal_access_tokens', 'reports',
    'notifications', 'system_settings'
  )
ORDER BY tablename, indexname;

-- Review this result before adding any UNIQUE constraint on employee_number.
SELECT employee_number, COUNT(*) AS duplicate_count
FROM public.users
WHERE employee_number IS NOT NULL
  AND BTRIM(employee_number) <> ''
GROUP BY employee_number
HAVING COUNT(*) > 1
ORDER BY employee_number;

-- Read-only verification: row-level security is enabled on each application table.
SELECT cls.relname AS table_name,
       cls.relrowsecurity AS rls_enabled,
       cls.relforcerowsecurity AS rls_forced
FROM pg_catalog.pg_class AS cls
JOIN pg_catalog.pg_namespace AS ns ON ns.oid = cls.relnamespace
WHERE ns.nspname = 'public'
  AND cls.relname IN (
    'users', 'citizens', 'personal_access_tokens', 'reports',
    'notifications', 'system_settings'
  )
  AND cls.relkind = 'r'
ORDER BY cls.relname;

-- Read-only verification: policies applied to application tables.
SELECT schemaname, tablename, policyname, roles, cmd, qual, with_check
FROM pg_catalog.pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'users', 'citizens', 'personal_access_tokens', 'reports',
    'notifications', 'system_settings'
  )
ORDER BY tablename, policyname;

-- Read-only verification: role used by this SQL session and configured for the app.
WITH configured_role AS (
  SELECT current_user::TEXT AS schema_executor_role,
         current_setting('app.tareeqak_db_role', true) AS database_role
)
SELECT schema_executor_role, database_role
FROM configured_role;

-- Read-only verification: required table privileges for the app role and no browser-role access.
WITH configured_role AS (
  SELECT current_setting('app.tareeqak_db_role', true) AS database_role
),
required_tables(table_name) AS (
  VALUES
    ('users'), ('citizens'), ('personal_access_tokens'),
    ('reports'), ('notifications'), ('system_settings')
),
required_privileges(privilege_type) AS (
  VALUES ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE')
)
SELECT tables.table_name,
       privileges.privilege_type,
       has_table_privilege(
         configured_role.database_role,
         format('public.%I', tables.table_name),
         privileges.privilege_type
       ) AS app_role_has_privilege,
       has_table_privilege('anon', format('public.%I', tables.table_name), privileges.privilege_type)
         AS anon_has_privilege,
       has_table_privilege('authenticated', format('public.%I', tables.table_name), privileges.privilege_type)
         AS authenticated_has_privilege
FROM configured_role
CROSS JOIN required_tables AS tables
CROSS JOIN required_privileges AS privileges
ORDER BY tables.table_name, privileges.privilege_type;

-- Read-only verification: app role can use ID sequences; browser roles cannot.
WITH configured_role AS (
  SELECT current_setting('app.tareeqak_db_role', true) AS database_role
),
sequence_tables(table_name) AS (
  VALUES ('users'), ('citizens'), ('personal_access_tokens'), ('reports'), ('notifications')
)
SELECT sequence_tables.table_name,
       pg_get_serial_sequence(format('public.%I', sequence_tables.table_name), 'id') AS sequence_name,
       has_sequence_privilege(
         configured_role.database_role,
         pg_get_serial_sequence(format('public.%I', sequence_tables.table_name), 'id'),
         'USAGE'
       ) AS app_role_has_usage,
       has_sequence_privilege(
         'anon',
         pg_get_serial_sequence(format('public.%I', sequence_tables.table_name), 'id'),
         'USAGE'
       ) AS anon_has_usage,
       has_sequence_privilege(
         'authenticated',
         pg_get_serial_sequence(format('public.%I', sequence_tables.table_name), 'id'),
         'USAGE'
       ) AS authenticated_has_usage
FROM configured_role
CROSS JOIN sequence_tables
ORDER BY sequence_tables.table_name;
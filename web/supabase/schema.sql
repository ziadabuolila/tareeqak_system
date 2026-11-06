
-- Tareeqak PostgreSQL schema for Supabase.
-- Safe to run repeatedly: it creates missing objects and does not drop tables,
-- rows, triggers, policies, or other database objects.

-- The application connects using this restricted database role.
SELECT set_config(
  'app.tareeqak_db_role',
  'tareeqak_app',
  false
);

DO $$
DECLARE
  app_db_role TEXT := NULLIF(current_setting('app.tareeqak_db_role', true), '');
BEGIN
  IF app_db_role IS NULL
     OR app_db_role IN ('anon', 'authenticated')
     OR NOT EXISTS (
       SELECT 1
       FROM pg_catalog.pg_roles
       WHERE rolname = app_db_role
     ) THEN
    RAISE EXCEPTION
      'Configured Tareeqak database role is missing or is a browser role';
  END IF;
END;
$$;

-- =========================================================
-- 1. TABLES
-- =========================================================

CREATE TABLE IF NOT EXISTS public.users (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(255) NOT NULL UNIQUE,
  email VARCHAR(255) UNIQUE,
  email_verified_at TIMESTAMPTZ,
  password VARCHAR(255) NOT NULL,
  role VARCHAR(32) NOT NULL DEFAULT 'employee',
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
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE,
  password VARCHAR(255) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'active',
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
  CONSTRAINT citizens_status_check CHECK (status IN ('active','blocked'))
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
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.citizen_login_requests (
  id BIGSERIAL PRIMARY KEY,
  request_id VARCHAR(64) NOT NULL UNIQUE,
  citizen_id BIGINT NOT NULL REFERENCES public.citizens(id) ON DELETE CASCADE,
  device_label VARCHAR(120) NOT NULL DEFAULT 'جهاز جديد',
  status VARCHAR(16) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT citizen_login_requests_status_check CHECK (status IN ('pending','approved','rejected','expired','completed'))
);

CREATE TABLE IF NOT EXISTS public.reports (
  id BIGSERIAL PRIMARY KEY,
  reference VARCHAR(64) NOT NULL UNIQUE,
  citizen_id BIGINT,
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
  CONSTRAINT reports_citizen_id_foreign
    FOREIGN KEY (citizen_id)
    REFERENCES public.citizens(id)
    ON DELETE SET NULL
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

-- =========================================================
-- 2. COMPATIBILITY COLUMNS
-- =========================================================

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

-- =========================================================
-- 3. INDEXES
-- =========================================================

CREATE INDEX IF NOT EXISTS users_role_created_idx
  ON public.users (role, created_at);

CREATE INDEX IF NOT EXISTS personal_access_tokens_tokenable_idx
  ON public.personal_access_tokens (tokenable_type, tokenable_id);

CREATE INDEX IF NOT EXISTS reports_status_created_idx
  ON public.reports (status, created_at);

CREATE INDEX IF NOT EXISTS reports_citizen_created_idx
  ON public.reports (citizen_id, created_at DESC);

CREATE INDEX IF NOT EXISTS citizen_login_requests_citizen_status_idx
  ON public.citizen_login_requests (citizen_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS reports_created_idx
  ON public.reports (created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS notifications_created_idx
  ON public.notifications (created_at DESC, id DESC);

-- =========================================================
-- 4. UPDATED_AT FUNCTION AND TRIGGERS
-- =========================================================

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
    'citizen_login_requests',
    'reports',
    'system_settings'
  ]
  LOOP
    trigger_name := target_table || '_updated_at';

    IF NOT EXISTS (
      SELECT 1
      FROM pg_catalog.pg_trigger
      WHERE tgrelid = format('public.%I', target_table)::regclass
        AND tgname = trigger_name
        AND NOT tgisinternal
    ) THEN
      EXECUTE format(
        'CREATE TRIGGER %I
         BEFORE UPDATE ON public.%I
         FOR EACH ROW
         EXECUTE FUNCTION public.set_updated_at()',
        trigger_name,
        target_table
      );
    END IF;
  END LOOP;
END;
$$;

-- =========================================================
-- 5. ENABLE ROW LEVEL SECURITY
-- =========================================================

-- Browser clients must use the Next.js API.
-- The application database role is used only by the trusted server.

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.citizens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personal_access_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.citizen_login_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- 6. DATABASE ROLE PERMISSIONS AND RLS POLICIES
-- =========================================================

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
    SELECT 1
    FROM pg_catalog.pg_roles
    WHERE rolname = app_db_role
  ) OR app_db_role IN ('anon', 'authenticated') THEN
    RAISE EXCEPTION
      'Configured Tareeqak database role is missing or is a browser role';
  END IF;

  -- Schema permissions.
  EXECUTE
    'REVOKE CREATE ON SCHEMA public FROM PUBLIC, anon, authenticated';

  EXECUTE format(
    'REVOKE CREATE ON SCHEMA public FROM %I',
    app_db_role
  );

  EXECUTE format(
    'GRANT USAGE ON SCHEMA public TO %I',
    app_db_role
  );

  -- Remove direct table privileges from browser roles.
  EXECUTE '
    REVOKE ALL PRIVILEGES ON TABLE
      public.users,
      public.citizens,
      public.personal_access_tokens,
      public.citizen_login_requests,
      public.reports,
      public.notifications,
      public.system_settings
    FROM PUBLIC, anon, authenticated
  ';

  FOREACH target_table IN ARRAY ARRAY[
    'users',
    'citizens',
    'personal_access_tokens',
    'citizen_login_requests',
    'reports',
    'notifications',
    'system_settings'
  ]
  LOOP
    -- Grant the application role the permissions required by the API.
    EXECUTE format(
      'GRANT SELECT, INSERT, UPDATE, DELETE
       ON TABLE public.%I TO %I',
      target_table,
      app_db_role
    );

    -- Check whether the policy already exists.
    SELECT
      cmd,
      permissive,
      roles,
      qual,
      with_check
    INTO
      existing_policy_cmd,
      existing_policy_permissive,
      existing_policy_roles,
      existing_policy_using,
      existing_policy_check
    FROM pg_catalog.pg_policies
    WHERE schemaname = 'public'
      AND tablename = target_table
      AND policyname = 'tareeqak_server_role_access';

    IF FOUND THEN
      -- Do not silently overwrite an unexpected policy.
      IF existing_policy_cmd <> 'ALL'
         OR existing_policy_permissive <> 'PERMISSIVE'
         OR COALESCE(existing_policy_using, '') NOT IN ('true', '(true)')
         OR COALESCE(existing_policy_check, '') NOT IN ('true', '(true)')
         OR COALESCE(array_length(existing_policy_roles, 1), 0) <> 1
         OR existing_policy_roles[1]::TEXT NOT IN (
           'service_role',
           app_db_role
         ) THEN

        RAISE EXCEPTION
          'Existing tareeqak_server_role_access policy on public.% must be reviewed',
          target_table;
      END IF;

      EXECUTE format(
        'ALTER POLICY tareeqak_server_role_access
         ON public.%I
         TO %I
         USING (true)
         WITH CHECK (true)',
        target_table,
        app_db_role
      );

    ELSE
      EXECUTE format(
        'CREATE POLICY tareeqak_server_role_access
         ON public.%I
         FOR ALL
         TO %I
         USING (true)
         WITH CHECK (true)',
        target_table,
        app_db_role
      );
    END IF;

    EXECUTE format(
      'COMMENT ON POLICY tareeqak_server_role_access
       ON public.%I IS %L',
      target_table,
      'Allows the trusted Tareeqak server database role only.'
    );

    -- Grant sequence access only when the table actually has an id column.
    -- This avoids errors on system_settings, which uses setting_key as its PK.

    sequence_name := NULL;

    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = target_table
        AND column_name = 'id'
    ) THEN
      sequence_name := pg_get_serial_sequence(
        format('public.%I', target_table),
        'id'
      );
    END IF;

    IF sequence_name IS NOT NULL THEN
      EXECUTE format(
        'REVOKE ALL PRIVILEGES ON SEQUENCE %s
         FROM PUBLIC, anon, authenticated',
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

-- =========================================================
-- 7. TABLE COMMENTS
-- =========================================================

COMMENT ON TABLE public.users IS
  'Employee, manager, and administrator accounts; citizen credentials live in the citizens table.';

COMMENT ON TABLE public.citizens IS
  'Citizen credentials and profile details, kept separately from staff accounts.';

COMMENT ON TABLE public.personal_access_tokens IS
  'Hashed bearer-token records used by the application API for sessions.';

COMMENT ON TABLE public.citizen_login_requests IS
  'Short lived approval requests for signing a citizen account into another device.';

COMMENT ON TABLE public.reports IS
  'Citizen-submitted reports, their workflow status, and optional binary image data.';

COMMENT ON TABLE public.notifications IS
  'Admin-facing notifications generated by report and status changes.';

COMMENT ON TABLE public.system_settings IS
  'Key/value storage for administrator-managed platform settings.';

-- =========================================================
-- 8. VERIFICATION: EXPECTED TABLES
-- =========================================================

SELECT
  expected.table_name,
  to_regclass(format('public.%I', expected.table_name)) IS NOT NULL
    AS table_exists
FROM (
  VALUES
    ('users'),
    ('citizens'),
    ('personal_access_tokens'),
    ('citizen_login_requests'),
    ('reports'),
    ('notifications'),
    ('system_settings')
) AS expected(table_name)
ORDER BY expected.table_name;

-- =========================================================
-- 9. VERIFICATION: EXISTING COLUMNS
-- =========================================================

SELECT
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN (
    'users',
    'citizens',
    'personal_access_tokens',
    'citizen_login_requests',
    'reports',
    'notifications',
    'system_settings'
  )
ORDER BY table_name, ordinal_position;

-- =========================================================
-- 10. VERIFICATION: MISSING EXPECTED COLUMNS
-- =========================================================

WITH expected_columns(table_name, column_name) AS (
  VALUES
    ('users', 'id'),
    ('users', 'name'),
    ('users', 'phone'),
    ('users', 'email'),
    ('users', 'email_verified_at'),
    ('users', 'password'),
    ('users', 'role'),
    ('users', 'status'),
    ('users', 'employee_number'),
    ('users', 'job_title'),
    ('users', 'department'),
    ('users', 'employment_type'),
    ('users', 'hire_date'),
    ('users', 'birth_date'),
    ('users', 'gender'),
    ('users', 'national_id'),
    ('users', 'address'),
    ('users', 'emergency_contact_name'),
    ('users', 'emergency_contact_phone'),
    ('users', 'salary'),
    ('users', 'notes'),
    ('users', 'remember_token'),
    ('users', 'created_at'),
    ('users', 'updated_at'),

    ('citizens', 'id'),
    ('citizens', 'name'),
    ('citizens', 'email'),
    ('citizens', 'password'),
    ('citizens', 'status'),
    ('citizens', 'gender'),
    ('citizens', 'age'),
    ('citizens', 'address'),
    ('citizens', 'governorate'),
    ('citizens', 'city'),
    ('citizens', 'phone'),
    ('citizens', 'national_id'),
    ('citizens', 'front_of_card'),
    ('citizens', 'back_of_card'),
    ('citizens', 'created_at'),
    ('citizens', 'updated_at'),

    ('personal_access_tokens', 'id'),
    ('personal_access_tokens', 'tokenable_type'),
    ('personal_access_tokens', 'tokenable_id'),
    ('personal_access_tokens', 'name'),
    ('personal_access_tokens', 'token'),
    ('personal_access_tokens', 'abilities'),
    ('personal_access_tokens', 'last_used_at'),
    ('personal_access_tokens', 'expires_at'),
    ('personal_access_tokens', 'created_at'),
    ('personal_access_tokens', 'updated_at'),

    ('citizen_login_requests', 'id'),
    ('citizen_login_requests', 'request_id'),
    ('citizen_login_requests', 'citizen_id'),
    ('citizen_login_requests', 'device_label'),
    ('citizen_login_requests', 'status'),
    ('citizen_login_requests', 'created_at'),
    ('citizen_login_requests', 'expires_at'),

    ('reports', 'id'),
    ('reports', 'reference'),
    ('reports', 'citizen_id'),
    ('reports', 'title'),
    ('reports', 'category'),
    ('reports', 'description'),
    ('reports', 'status'),
    ('reports', 'governorate'),
    ('reports', 'city'),
    ('reports', 'location'),
    ('reports', 'image_url'),
    ('reports', 'image_data'),
    ('reports', 'image_type'),
    ('reports', 'created_at'),
    ('reports', 'updated_at'),

    ('notifications', 'id'),
    ('notifications', 'title'),
    ('notifications', 'body'),
    ('notifications', 'kind'),
    ('notifications', 'is_read'),
    ('notifications', 'created_at'),

    ('system_settings', 'setting_key'),
    ('system_settings', 'value'),
    ('system_settings', 'updated_at')
)
SELECT
  expected.table_name,
  expected.column_name AS missing_column
FROM expected_columns AS expected
LEFT JOIN information_schema.columns AS actual
  ON actual.table_schema = 'public'
 AND actual.table_name = expected.table_name
 AND actual.column_name = expected.column_name
WHERE actual.column_name IS NULL
ORDER BY expected.table_name, expected.column_name;

-- =========================================================
-- 11. VERIFICATION: CONSTRAINTS
-- =========================================================

SELECT
  tc.table_name,
  tc.constraint_name,
  tc.constraint_type,
  STRING_AGG(
    kcu.column_name,
    ', '
    ORDER BY kcu.ordinal_position
  ) AS columns,
  MAX(ccu.table_name) AS referenced_table,
  STRING_AGG(
    ccu.column_name,
    ', '
    ORDER BY ccu.column_name
  ) FILTER (
    WHERE tc.constraint_type = 'FOREIGN KEY'
  ) AS referenced_columns
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
    'users',
    'citizens',
    'personal_access_tokens',
    'citizen_login_requests',
    'reports',
    'notifications',
    'system_settings'
  )
GROUP BY
  tc.table_name,
  tc.constraint_name,
  tc.constraint_type
ORDER BY
  tc.table_name,
  tc.constraint_type,
  tc.constraint_name;

-- =========================================================
-- 12. VERIFICATION: INDEXES
-- =========================================================

SELECT
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_catalog.pg_indexes
WHERE schemaname = 'public'
  AND tablename IN (
    'users',
    'citizens',
    'personal_access_tokens',
    'citizen_login_requests',
    'reports',
    'notifications',
    'system_settings'
  )
ORDER BY tablename, indexname;

-- =========================================================
-- 13. VERIFICATION: DUPLICATE EMPLOYEE NUMBERS
-- =========================================================

SELECT
  employee_number,
  COUNT(*) AS duplicate_count
FROM public.users
WHERE employee_number IS NOT NULL
  AND BTRIM(employee_number) <> ''
GROUP BY employee_number
HAVING COUNT(*) > 1
ORDER BY employee_number;

-- =========================================================
-- 14. VERIFICATION: RLS STATUS
-- =========================================================

SELECT
  cls.relname AS table_name,
  cls.relrowsecurity AS rls_enabled,
  cls.relforcerowsecurity AS rls_forced
FROM pg_catalog.pg_class AS cls
JOIN pg_catalog.pg_namespace AS ns
  ON ns.oid = cls.relnamespace
WHERE ns.nspname = 'public'
  AND cls.relname IN (
    'users',
    'citizens',
    'personal_access_tokens',
    'citizen_login_requests',
    'reports',
    'notifications',
    'system_settings'
  )
  AND cls.relkind = 'r'
ORDER BY cls.relname;

-- =========================================================
-- 15. VERIFICATION: RLS POLICIES
-- =========================================================

SELECT
  schemaname,
  tablename,
  policyname,
  roles,
  cmd,
  qual,
  with_check
FROM pg_catalog.pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'users',
    'citizens',
    'personal_access_tokens',
    'citizen_login_requests',
    'reports',
    'notifications',
    'system_settings'
  )
ORDER BY tablename, policyname;

-- =========================================================
-- 16. VERIFICATION: DATABASE ROLE
-- =========================================================

WITH configured_role AS (
  SELECT
    current_user::TEXT AS schema_executor_role,
    current_setting('app.tareeqak_db_role', true) AS database_role
)
SELECT
  schema_executor_role,
  database_role
FROM configured_role;

-- =========================================================
-- 17. VERIFICATION: TABLE PRIVILEGES
-- =========================================================

WITH configured_role AS (
  SELECT current_setting(
    'app.tareeqak_db_role',
    true
  ) AS database_role
),
required_tables(table_name) AS (
  VALUES
    ('users'),
    ('citizens'),
    ('personal_access_tokens'),
    ('citizen_login_requests'),
    ('reports'),
    ('notifications'),
    ('system_settings')
),
required_privileges(privilege_type) AS (
  VALUES
    ('SELECT'),
    ('INSERT'),
    ('UPDATE'),
    ('DELETE')
)
SELECT
  tables.table_name,
  privileges.privilege_type,

  has_table_privilege(
    configured_role.database_role,
    format('public.%I', tables.table_name),
    privileges.privilege_type
  ) AS app_role_has_privilege,

  has_table_privilege(
    'anon',
    format('public.%I', tables.table_name),
    privileges.privilege_type
  ) AS anon_has_privilege,

  has_table_privilege(
    'authenticated',
    format('public.%I', tables.table_name),
    privileges.privilege_type
  ) AS authenticated_has_privilege

FROM configured_role
CROSS JOIN required_tables AS tables
CROSS JOIN required_privileges AS privileges
ORDER BY tables.table_name, privileges.privilege_type;

-- =========================================================
-- 18. VERIFICATION: SEQUENCE PRIVILEGES
-- =========================================================

-- This query checks only sequences that actually exist.
-- It safely skips tables without an id column or without a serial sequence.

WITH configured_role AS (
  SELECT current_setting(
    'app.tareeqak_db_role',
    true
  ) AS database_role
),
sequence_tables(table_name) AS (
  VALUES
    ('users'),
    ('citizens'),
    ('personal_access_tokens'),
    ('citizen_login_requests'),
    ('reports'),
    ('notifications')
),
existing_sequences AS (
  SELECT
    sequence_tables.table_name,
    pg_get_serial_sequence(
      format('public.%I', sequence_tables.table_name),
      'id'
    ) AS sequence_name
  FROM sequence_tables
  WHERE EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = sequence_tables.table_name
      AND column_name = 'id'
  )
)
SELECT
  existing_sequences.table_name,
  existing_sequences.sequence_name,

  has_sequence_privilege(
    configured_role.database_role,
    existing_sequences.sequence_name,
    'USAGE'
  ) AS app_role_has_usage,

  has_sequence_privilege(
    'anon',
    existing_sequences.sequence_name,
    'USAGE'
  ) AS anon_has_usage,

  has_sequence_privilege(
    'authenticated',
    existing_sequences.sequence_name,
    'USAGE'
  ) AS authenticated_has_usage

FROM configured_role
JOIN existing_sequences
  ON existing_sequences.sequence_name IS NOT NULL
ORDER BY existing_sequences.table_name;

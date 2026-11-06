BEGIN;

-- Preserve the credentials and status already held by the citizen user rows.
ALTER TABLE public.citizens ADD COLUMN IF NOT EXISTS email VARCHAR(255);
ALTER TABLE public.citizens ADD COLUMN IF NOT EXISTS password VARCHAR(255);
ALTER TABLE public.citizens ADD COLUMN IF NOT EXISTS status VARCHAR(32) NOT NULL DEFAULT 'active';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.users u
    LEFT JOIN public.citizens c ON c.user_id=u.id
    WHERE u.role='citizen' AND c.id IS NULL
  ) THEN
    RAISE EXCEPTION 'Citizen migration stopped: a citizen users row has no matching citizens profile.';
  END IF;
END $$;

UPDATE public.citizens c
SET email=u.email,password=u.password,status=u.status,created_at=u.created_at,updated_at=u.updated_at
FROM public.users u
WHERE u.id=c.user_id AND u.role='citizen';

ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS citizen_id BIGINT;
UPDATE public.reports r SET citizen_id=c.id
FROM public.citizens c WHERE r.user_id=c.user_id AND r.citizen_id IS NULL;

ALTER TABLE public.citizen_login_requests ADD COLUMN IF NOT EXISTS citizen_id BIGINT;
UPDATE public.citizen_login_requests r SET citizen_id=c.id
FROM public.citizens c WHERE r.user_id=c.user_id AND r.citizen_id IS NULL;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.citizen_login_requests WHERE citizen_id IS NULL) THEN
    RAISE EXCEPTION 'Citizen migration stopped: a login request has no matching citizen profile.';
  END IF;
END $$;

UPDATE public.personal_access_tokens t
SET tokenable_type='App\Models\Citizen',tokenable_id=c.id
FROM public.citizens c
WHERE t.tokenable_type='App\Models\User' AND t.tokenable_id=c.user_id;

ALTER TABLE public.personal_access_tokens DROP CONSTRAINT IF EXISTS personal_access_tokens_user_foreign;
ALTER TABLE public.citizen_login_requests DROP CONSTRAINT IF EXISTS citizen_login_requests_user_id_fkey;
ALTER TABLE public.reports DROP CONSTRAINT IF EXISTS reports_user_id_foreign;
ALTER TABLE public.citizens DROP CONSTRAINT IF EXISTS citizens_user_id_foreign;

DROP INDEX IF EXISTS public.citizen_login_requests_user_status_idx;
DROP INDEX IF EXISTS public.reports_user_created_idx;

ALTER TABLE public.citizen_login_requests DROP COLUMN IF EXISTS user_id;
ALTER TABLE public.citizen_login_requests ALTER COLUMN citizen_id SET NOT NULL;
ALTER TABLE public.citizen_login_requests
  ADD CONSTRAINT citizen_login_requests_citizen_id_fkey
  FOREIGN KEY (citizen_id) REFERENCES public.citizens(id) ON DELETE CASCADE;

ALTER TABLE public.reports DROP COLUMN IF EXISTS user_id;
ALTER TABLE public.reports
  ADD CONSTRAINT reports_citizen_id_foreign
  FOREIGN KEY (citizen_id) REFERENCES public.citizens(id) ON DELETE SET NULL;

ALTER TABLE public.citizens ALTER COLUMN password SET NOT NULL;
ALTER TABLE public.citizens
  ADD CONSTRAINT citizens_status_check CHECK (status IN ('active','blocked'));
ALTER TABLE public.citizens DROP COLUMN IF EXISTS user_id;

ALTER TABLE public.users ALTER COLUMN role SET DEFAULT 'employee';
DELETE FROM public.users WHERE role='citizen';

CREATE INDEX IF NOT EXISTS citizen_login_requests_citizen_status_idx
  ON public.citizen_login_requests (citizen_id,status,created_at DESC);
CREATE INDEX IF NOT EXISTS reports_citizen_created_idx
  ON public.reports (citizen_id,created_at DESC);

COMMIT;

BEGIN;

ALTER TABLE public.citizens
  ADD COLUMN IF NOT EXISTS primary_device_id VARCHAR(64);

ALTER TABLE public.citizen_login_requests
  ADD COLUMN IF NOT EXISTS device_id VARCHAR(64) NOT NULL DEFAULT '';

COMMIT;

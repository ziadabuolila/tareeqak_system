# Next.js API

The backend runs inside the Next.js server and stores data in PostgreSQL. Configure the server-side `DATABASE_URL` using `web/.env.example` as a guide.

Use `http://<computer-ip>:3000/api` as the base URL on a phone connected to the same network; the `/api` prefix stays the same as the Laravel service.

## Routes

Citizen report submissions may include numeric `latitude` and `longitude` fields. When both values are valid, the API keeps the supplied readable place in `location` and appends a `GPS:latitude,longitude` marker to that same value, allowing the admin map to plot it without showing raw coordinates in report details or notifications. Mobile clients should continue sending `city` and `governorate` for the readable area.

## Citizen app catalog

- `GET /api/citizen/catalog?kind=governorate` returns the current governorates.
- `GET /api/citizen/catalog?kind=center&governorate=القاهرة` returns centers for the selected governorate.
- `GET /api/citizen/catalog?kind=problem_type` returns report problem types.
- The catalog is stored in `citizen_catalog` and seeded with the existing Egypt locations and problem types when first requested. The system settings page manages it through authenticated `GET/POST /api/admin/catalog` and `PATCH/DELETE /api/admin/catalog/{id}`. Center entries require a governorate; deleting a governorate also deletes its centers.
- Mobile clients should load these lists from the API and show a loading indicator while requests are in flight. The API response is `{ status: true, data: { items: [{ id, kind, name, parent_name }] } }`.

- `POST /api/admin/login` with administrator `email` and `password` for the web dashboard.
- `POST /api/citizen/register` with `name`, `phone`, `governorate`, `city`, `password`, and `password_confirmation`. Registration creates the credential and profile only in `citizens`; it does not create a row in the staff `users` table or an authenticated session. Phone numbers are unique within each account table, so a citizen may use the same number as an employee account.
- `POST /api/citizen/login` with `phone`, `password`, and (for current mobile apps) a persistent installation `device_id` plus `requires_approval: true`.
- Citizen login returns HTTP 404 with `هذا الحساب غير موجود. ادخل اعمل إنشاء حساب جديد وحاول مرة أخرى.` when the phone is not registered in `citizens`, HTTP 403 with `حسابك مغلق...` when that citizen is blocked, and HTTP 401 with `كلمة المرور غير صحيحة.` for an active account with a wrong password. Staff accounts in `users` are not considered citizen accounts, even if they use the same phone.
- `GET /api/citizen/me` with `Authorization: Bearer <token>`.
- `DELETE /api/citizen/me` with `Authorization: Bearer <token>` to revoke the current token.

## Citizen profile and device approval

- `GET /api/citizen/profile` returns the saved profile plus `complete` and `missing_fields`.
- `PATCH /api/citizen/profile` accepts `name`, `gender`, `age`, `address`, `governorate`, `city`, and `national_id`. The name is required; saving an empty name returns HTTP 422.
- `GET /api/citizen/me` also includes `profile`, `profile_complete`, and `profile_missing_fields` so the app can ask only citizens with unfinished profiles.
- If a token still belongs to a citizen account that was blocked, `GET /api/citizen/me` returns HTTP 403 with `data.reason: "account_blocked"` and an Arabic message. Invalid or revoked tokens continue to return HTTP 401.
- For approval based sign-in, the app sends `requires_approval: true` and `device_label` to `POST /api/citizen/login`. If another mobile session exists, HTTP 202 returns `request_id` and the recommended polling interval.
- The app keeps a random installation ID outside the login session and sends it as `device_id` on login and `X-Device-ID` with authenticated requests. The system records the account's primary device, so that same phone can sign in directly after an administrator reactivates the account. A different phone still needs approval while another mobile session exists; approving it transfers the primary-device marker.
- When upgrading an older account that has no recorded device ID, a single untagged legacy mobile session is claimed by the first upgraded app installation. This allows the original phone to recover after a block even when the older app had already cleared its local session. Multiple ambiguous legacy sessions still require approval.
- The existing device polls `GET /api/citizen/login-requests` with its bearer token and decides through `PATCH /api/citizen/login-requests/{request_id}` using `{ "action": "approve" }` or `{ "action": "reject" }`.
- The requesting device polls `GET /api/citizen/login-requests/{request_id}`. An approved request returns the new bearer token once and revokes the previous mobile sessions; a rejected request returns `state: "rejected"`.

Citizen credentials and staff accounts are separate: citizen tokens use the `App\Models\Citizen` token type, and citizen reports and login approvals reference `citizens.id`. For an existing database, apply `web/supabase/migrations/202611060001_citizen_accounts_separate_from_users.sql` once to move existing citizen credentials, tokens, reports, and pending approvals onto the citizen records and remove their duplicate `users` rows, then apply `web/supabase/migrations/202611060002_primary_citizen_device.sql` for primary-device recognition. For a new database, use the updated `web/supabase/schema.sql` instead.

The device approval flow requires the updated citizen tables in `web/supabase/schema.sql` (or the migration above on an existing database). Apply the schema change before enabling `requires_approval` in the mobile app.

Administrator accounts are created locally with `npm run admin:create`; citizen accounts cannot access the admin login. Successful login responses keep the Laravel shape: `{ status, message, data: { user, token, token_type } }`. Registration returns the new citizen profile without a token so the app must sign in explicitly. Passwords are hashed with bcrypt and only token hashes are stored.

The Next.js server requires Node.js 22.13 or later. Run `npm install` and `npm run dev` from the project root.

# Next.js API

The backend runs inside the Next.js server and stores data in PostgreSQL. Configure the server-side `DATABASE_URL` using `web/.env.example` as a guide.

Use `http://<computer-ip>:3000/api` as the base URL on a phone connected to the same network; the `/api` prefix stays the same as the Laravel service.

## Routes

Citizen report submissions may include numeric `latitude` and `longitude` fields. When both values are valid, the API stores the GPS point as the report's `location` value so the admin map can plot the submitted position. Mobile clients should continue sending `city` and `governorate` for the readable area.

- `POST /api/admin/login` with administrator `email` and `password` for the web dashboard.
- `POST /api/citizen/register` with `name`, `phone`, `governorate`, `city`, `password`, and `password_confirmation`. Registration creates the credential and profile only in `citizens`; it does not create a row in the staff `users` table or an authenticated session.
- `POST /api/citizen/login` with `phone` and `password`.
- `GET /api/citizen/me` with `Authorization: Bearer <token>`.
- `DELETE /api/citizen/me` with `Authorization: Bearer <token>` to revoke the current token.

## Citizen profile and device approval

- `GET /api/citizen/profile` returns the saved profile plus `complete` and `missing_fields`.
- `PATCH /api/citizen/profile` accepts `name`, `gender`, `age`, `address`, `governorate`, `city`, and `national_id`. The name is required; saving an empty name returns HTTP 422.
- `GET /api/citizen/me` also includes `profile`, `profile_complete`, and `profile_missing_fields` so the app can ask only citizens with unfinished profiles.
- If a token still belongs to a citizen account that was blocked, `GET /api/citizen/me` returns HTTP 403 with `data.reason: "account_blocked"` and an Arabic message. Invalid or revoked tokens continue to return HTTP 401.
- For approval based sign-in, the app sends `requires_approval: true` and `device_label` to `POST /api/citizen/login`. If another mobile session exists, HTTP 202 returns `request_id` and the recommended polling interval.
- The existing device polls `GET /api/citizen/login-requests` with its bearer token and decides through `PATCH /api/citizen/login-requests/{request_id}` using `{ "action": "approve" }` or `{ "action": "reject" }`.
- The requesting device polls `GET /api/citizen/login-requests/{request_id}`. An approved request returns the new bearer token once and revokes the previous mobile sessions; a rejected request returns `state: "rejected"`.

Citizen credentials and staff accounts are separate: citizen tokens use the `App\Models\Citizen` token type, and citizen reports and login approvals reference `citizens.id`. For an existing database, apply `web/supabase/migrations/202611060001_citizen_accounts_separate_from_users.sql` once to move existing citizen credentials, tokens, reports, and pending approvals onto the citizen records and remove their duplicate `users` rows. For a new database, use the updated `web/supabase/schema.sql` instead.

The device approval flow requires the updated citizen tables in `web/supabase/schema.sql` (or the migration above on an existing database). Apply the schema change before enabling `requires_approval` in the mobile app.

Administrator accounts are created locally with `npm run admin:create`; citizen accounts cannot access the admin login. Successful login responses keep the Laravel shape: `{ status, message, data: { user, token, token_type } }`. Registration returns the new citizen profile without a token so the app must sign in explicitly. Passwords are hashed with bcrypt and only token hashes are stored.

The Next.js server requires Node.js 22.13 or later. Run `npm install` and `npm run dev` from the project root.

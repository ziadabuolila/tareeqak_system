# Next.js API

The backend runs inside the Next.js server and stores data in `web/api/database.sqlite` by default. Set `TAREEQAK_DATABASE_PATH` to use another SQLite file.

Use `http://<computer-ip>:3000/api` as the base URL on a phone connected to the same network; the `/api` prefix stays the same as the Laravel service.

## Routes

- `POST /api/admin/login` with administrator `email` and `password` for the web dashboard.
- `POST /api/citizen/register` with `name`, `phone`, `governorate`, `city`, `password`, and `password_confirmation`.
- `POST /api/citizen/login` with `phone` and `password`.
- `GET /api/citizen/me` with `Authorization: Bearer <token>`.
- `DELETE /api/citizen/me` with `Authorization: Bearer <token>` to revoke the current token.

Administrator accounts are created locally with `npm run admin:create`; citizen accounts cannot access the admin login. Successful authentication responses keep the Laravel shape: `{ status, message, data: { user, token, token_type } }`. Passwords are hashed with bcrypt and only token hashes are stored.

The Next.js server requires Node.js 22.13 or later for its built-in SQLite driver. Run `npm install` and `npm run dev` from the project root.

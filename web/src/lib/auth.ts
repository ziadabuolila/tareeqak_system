import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { execute, row, type RowDataPacket } from "@/lib/database";

export type PublicUser = {
  id: number;
  name: string;
  phone: string;
  email: string | null;
  email_verified_at: string | null;
  created_at: string;
  updated_at: string;
  role?: string;
  status?: string;
};

export type AuthenticatedUser = PublicUser & {
  password: string;
  remember_token: string | null;
};

export function publicUser(user: AuthenticatedUser | undefined): PublicUser | null {
  if (!user) return null;
  const { id, name, phone, email, email_verified_at, created_at, updated_at, role, status } = user;
  return { id, name, phone, email, email_verified_at, created_at, updated_at, role, status };
}

export async function createToken(userId: number, name = "mobile-app"): Promise<string> {
  const secret = randomBytes(32).toString("hex");
  const expiresAt = name === "admin-web" ? "NOW() + INTERVAL '1 hour'" : "NULL";
  const result = await execute(`
    INSERT INTO personal_access_tokens (tokenable_type, tokenable_id, name, token, abilities, expires_at)
    VALUES ($1, $2, $3, $4, $5, ${expiresAt})
    RETURNING id
  `, ["App\\Models\\User", userId, name, createHash("sha256").update(secret).digest("hex"), '["*"]']);

  return `${result.insertId ?? userId}|${secret}`;
}

export async function getUserForToken(token: string | null | undefined): Promise<AuthenticatedUser | null> {
  if (!token) return null;
  const separator = token.indexOf("|");
  if (separator < 1) return null;

  const tokenId = Number(token.slice(0, separator));
  const secret = token.slice(separator + 1);
  if (!Number.isSafeInteger(tokenId) || !secret) return null;

  const tokenHash = createHash("sha256").update(secret).digest("hex");
  const record = await row<AuthenticatedUser & RowDataPacket>(`
    SELECT users.*, personal_access_tokens.id AS token_id
    FROM personal_access_tokens
    JOIN users ON users.id = personal_access_tokens.tokenable_id
    WHERE personal_access_tokens.id = ?
      AND personal_access_tokens.token = ?
      AND personal_access_tokens.tokenable_type = ?
      AND users.status = 'active'
      AND (personal_access_tokens.expires_at IS NULL OR personal_access_tokens.expires_at > CURRENT_TIMESTAMP)
  `, [tokenId, tokenHash, "App\\Models\\User"]);

  if (!record) return null;
  await execute(`UPDATE personal_access_tokens
    SET last_used_at = NOW(),
        updated_at = NOW(),
        expires_at = CASE WHEN name = 'admin-web' THEN NOW() + INTERVAL '1 hour' ELSE expires_at END
    WHERE id = $1`, [tokenId]);
  return record;
}

export async function getStaffForRequest(request: Request): Promise<AuthenticatedUser | null> {
  const token = await getRequestToken(request);
  const user = await getUserForToken(token);
  if (!user || !["admin", "manager", "employee"].includes(user.role ?? "")) return null;
  return user;
}

export async function getManagerForRequest(request: Request): Promise<AuthenticatedUser | null> {
  const user = await getStaffForRequest(request);
  return user && ["admin", "manager"].includes(user.role ?? "") ? user : null;
}

export async function getAdminForRequest(request: Request): Promise<AuthenticatedUser | null> {
  const user = await getStaffForRequest(request);
  return user?.role === "admin" ? user : null;
}

export async function getRequestToken(request: Request): Promise<string | null> {
  const authorization = request.headers.get("authorization");
  const bearer = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (bearer) return bearer;

  return (await cookies()).get("tareeqak_token")?.value ?? null;
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  if (hash.startsWith("$2")) return bcrypt.compare(password, hash);


  return false;
}

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}





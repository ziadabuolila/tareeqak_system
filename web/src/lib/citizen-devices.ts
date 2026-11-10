import { execute, row } from "@/lib/database";
import type { RowDataPacket } from "@/lib/database";

export const citizenDeviceIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function isCitizenDeviceBlocked(citizenId: number, deviceId: string) {
  if (!citizenDeviceIdPattern.test(deviceId)) return false;
  const device = await row<{ status: string } & RowDataPacket>(
    "SELECT status FROM citizen_devices WHERE citizen_id=? AND device_id=? LIMIT 1",
    [citizenId, deviceId.toLowerCase()],
  );
  return device?.status === "blocked";
}

export async function registerCitizenDevice(citizenId: number, deviceId: string, label: string) {
  if (!citizenDeviceIdPattern.test(deviceId)) return false;
  await execute(`INSERT INTO citizen_devices(citizen_id,device_id,device_label,status,first_seen_at,last_seen_at,created_at,updated_at)
    VALUES(?,?,?,'active',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
    ON CONFLICT(citizen_id,device_id) DO UPDATE SET
      device_label=CASE WHEN citizen_devices.status='active' THEN EXCLUDED.device_label ELSE citizen_devices.device_label END,
      last_seen_at=CASE WHEN citizen_devices.status='active' THEN CURRENT_TIMESTAMP ELSE citizen_devices.last_seen_at END,
      updated_at=CURRENT_TIMESTAMP`,
  [citizenId, deviceId.toLowerCase(), label.trim().slice(0, 120) || "هاتف محمول"]);
  return !(await isCitizenDeviceBlocked(citizenId, deviceId));
}

export async function bindCurrentCitizenTokenToDevice(token: string | null, citizenId: number, deviceId: string) {
  if (!token || !citizenDeviceIdPattern.test(deviceId)) return;
  const separator = token.indexOf("|");
  const tokenId = Number(separator > 0 ? token.slice(0, separator) : "");
  if (!Number.isSafeInteger(tokenId) || tokenId <= 0) return;
  await execute(`UPDATE personal_access_tokens SET name=CASE WHEN name='mobile-app' THEN ? ELSE name END,
    last_used_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP
    WHERE id=? AND tokenable_id=? AND tokenable_type='App\\Models\\Citizen'`,
  [`mobile-app:${deviceId.toLowerCase()}`, tokenId, citizenId]);
}

export async function isCitizenOwnerDevice(citizenId: number, deviceId: string) {
  if (!citizenDeviceIdPattern.test(deviceId)) return false;
  await execute("UPDATE citizens SET primary_device_id=? WHERE id=? AND primary_device_id IS NULL", [deviceId.toLowerCase(), citizenId]);
  const citizen = await row<{ primary_device_id: string | null } & RowDataPacket>(
    "SELECT primary_device_id FROM citizens WHERE id=? LIMIT 1",
    [citizenId],
  );
  return citizen?.primary_device_id?.toLowerCase() === deviceId.toLowerCase();
}

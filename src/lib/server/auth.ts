import { createHash, randomBytes } from "crypto";
import { db, type ParticipantRow, type RoomRow, type SessionRow } from "./db";
import { ApiError } from "./errors";

export const newToken = () => randomBytes(32).toString("hex");
/** Only the SHA-256 of a session token is stored, so a DB leak can't be replayed. */
export const hashToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");

export async function getRoomByCode(code: string): Promise<RoomRow> {
  const { data, error } = await db()
    .from("game_rooms")
    .select("*")
    .eq("code", code.toUpperCase())
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new ApiError(404, "Walang room na may ganyang code.");
  const room = data as RoomRow;
  if (room.status === "expired" || new Date(room.expires_at) < new Date()) {
    throw new ApiError(410, "Expired na ang room na ito.");
  }
  return room;
}

export async function getSession(roomId: string): Promise<SessionRow> {
  const { data, error } = await db()
    .from("game_sessions")
    .select("*")
    .eq("room_id", roomId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new ApiError(500, "Walang game session ang room.");
  return data as SessionRow;
}

export function tokenFrom(req: Request): string | null {
  return req.headers.get("x-session-token");
}

export async function authParticipant(
  roomId: string,
  token: string | null,
): Promise<ParticipantRow> {
  if (!token || token.length > 128) throw new ApiError(401, "Hindi ka pa nakasali sa room.");
  const { data, error } = await db()
    .from("room_participants")
    .select("id, room_id, nickname, is_host, last_seen_at")
    .eq("room_id", roomId)
    .eq("session_token", hashToken(token))
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new ApiError(401, "Hindi ka pa nakasali sa room.");
  return data as ParticipantRow;
}

/** Host-only guard. The host flag lives in the DB and is checked on every action. */
export function requireHost(p: ParticipantRow, room: RoomRow) {
  if (!p.is_host || p.id !== room.host_id) {
    throw new ApiError(403, "Host lang ang pwedeng gumawa nito.");
  }
}

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { ApiError } from "./errors";

let client: SupabaseClient | null = null;

/**
 * Service-role Supabase client. Only ever used inside API routes, so the key never
 * reaches the browser. Created lazily so builds succeed without env vars.
 */
export function db(): SupabaseClient {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new ApiError(
      500,
      "Hindi pa naka-set ang Supabase. Idagdag ang NEXT_PUBLIC_SUPABASE_URL at SUPABASE_SERVICE_ROLE_KEY sa Vercel.",
    );
  }
  client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}

/** Test hook: lets integration tests swap in an in-memory fake. */
export function __setDbForTests(fake: unknown) {
  client = fake as SupabaseClient | null;
}

export interface RoomRow {
  id: string;
  code: string;
  host_id: string;
  status: "waiting" | "playing" | "paused" | "finished" | "expired";
  current_question_id: string | null;
  current_question_index: number;
  settings: unknown;
  expires_at: string;
}

export interface SessionRow {
  id: string;
  room_id: string;
  question_ids: string[];
  current_index: number;
  votes_revealed: boolean;
  voting_ends_at: string | null;
  paused_remaining_ms: number | null;
}

export interface ParticipantRow {
  id: string;
  room_id: string;
  nickname: string;
  is_host: boolean;
  last_seen_at: string;
}

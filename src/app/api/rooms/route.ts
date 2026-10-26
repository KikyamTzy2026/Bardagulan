import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/server/db";
import { ApiError, handle, readJson } from "@/lib/server/errors";
import { hashToken, newToken } from "@/lib/server/auth";
import { generateRoomCode, validateNickname } from "@/lib/game";
import { normalizeSettings, settingsInputSchema } from "@/lib/settings";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  nickname: z.string(),
  settings: settingsInputSchema.optional(),
});

export const POST = handle(async (req: Request) => {
  const body = bodySchema.parse(await readJson(req));
  const nickname = validateNickname(body.nickname);
  if (!nickname) throw new ApiError(400, "Nickname: 2 hanggang 20 characters.");

  const settings = normalizeSettings(body.settings);
  const sb = db();
  const hostId = crypto.randomUUID();

  let roomId: string | null = null;
  let code = "";
  for (let attempt = 0; attempt < 6 && !roomId; attempt++) {
    code = generateRoomCode();
    const { data, error } = await sb
      .from("game_rooms")
      .insert({ code, host_id: hostId, settings })
      .select("id")
      .single();
    if (!error) roomId = data.id as string;
    else if (error.code !== "23505") throw error; // retry only on duplicate code
  }
  if (!roomId) throw new ApiError(500, "Hindi makagawa ng room code. Subukan ulit.");

  const token = newToken();
  const { error: pErr } = await sb.from("room_participants").insert({
    id: hostId,
    room_id: roomId,
    nickname,
    is_host: true,
    session_token: hashToken(token),
  });
  if (pErr) throw pErr;

  const { error: sErr } = await sb
    .from("game_sessions")
    .insert({ room_id: roomId, question_ids: [] });
  if (sErr) throw sErr;

  return NextResponse.json({ code, token, participantId: hostId });
});

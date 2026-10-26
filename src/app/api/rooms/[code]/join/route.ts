import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/server/db";
import { ApiError, handle, readJson } from "@/lib/server/errors";
import { getRoomByCode, hashToken, newToken } from "@/lib/server/auth";
import { validateNickname } from "@/lib/game";

export const dynamic = "force-dynamic";

const MAX_PLAYERS = 60;
const bodySchema = z.object({ nickname: z.string() });

export const POST = handle(
  async (req: Request, ctx: { params: Promise<{ code: string }> }) => {
    const { code } = await ctx.params;
    const body = bodySchema.parse(await readJson(req));
    const nickname = validateNickname(body.nickname);
    if (!nickname) throw new ApiError(400, "Nickname: 2 hanggang 20 characters.");

    const room = await getRoomByCode(code);
    if (room.status === "finished") throw new ApiError(409, "Tapos na ang larong ito.");

    const sb = db();
    const { data: existing, error } = await sb
      .from("room_participants")
      .select("nickname")
      .eq("room_id", room.id);
    if (error) throw error;
    const names = (existing ?? []).map((p) => (p.nickname as string).toLowerCase());
    if (names.length >= MAX_PLAYERS) throw new ApiError(409, "Puno na ang room.");
    if (names.includes(nickname.toLowerCase())) {
      throw new ApiError(409, "May gumagamit na ng nickname na iyan sa room.");
    }

    const token = newToken();
    const { data, error: iErr } = await sb
      .from("room_participants")
      .insert({
        room_id: room.id,
        nickname,
        is_host: false,
        session_token: hashToken(token),
      })
      .select("id")
      .single();
    if (iErr) {
      if (iErr.code === "23505") throw new ApiError(409, "May gumagamit na ng nickname na iyan.");
      throw iErr;
    }

    return NextResponse.json({ code: room.code, token, participantId: data.id });
  },
);

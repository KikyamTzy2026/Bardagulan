import { NextResponse } from "next/server";
import { db } from "@/lib/server/db";
import { handle } from "@/lib/server/errors";
import {
  authParticipant,
  getRoomByCode,
  getSession,
  tokenFrom,
} from "@/lib/server/auth";
import { buildState } from "@/lib/server/state";

export const dynamic = "force-dynamic";

export const GET = handle(
  async (req: Request, ctx: { params: Promise<{ code: string }> }) => {
    const { code } = await ctx.params;
    const room = await getRoomByCode(code);
    const me = await authParticipant(room.id, tokenFrom(req));
    const session = await getSession(room.id);

    // Heartbeat (throttled) so the lobby can show who's online.
    if (Date.now() - new Date(me.last_seen_at).getTime() > 8_000) {
      await db()
        .from("room_participants")
        .update({ last_seen_at: new Date().toISOString() })
        .eq("id", me.id);
    }

    const state = await buildState(room, session, me);
    return NextResponse.json(state, { headers: { "Cache-Control": "no-store" } });
  },
);

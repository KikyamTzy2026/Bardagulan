import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/server/db";
import { ApiError, handle, readJson } from "@/lib/server/errors";
import {
  authParticipant,
  getRoomByCode,
  getSession,
  tokenFrom,
} from "@/lib/server/auth";
import { isValidCandidate } from "@/lib/candidates";
import { canVote } from "@/lib/game";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ candidate: z.string() });

export const POST = handle(
  async (req: Request, ctx: { params: Promise<{ code: string }> }) => {
    const { code } = await ctx.params;
    const { candidate } = bodySchema.parse(await readJson(req));
    if (!isValidCandidate(candidate)) throw new ApiError(400, "Hindi kilalang pangalan.");

    const room = await getRoomByCode(code);
    const me = await authParticipant(room.id, tokenFrom(req));
    const session = await getSession(room.id);

    const check = canVote({
      roomStatus: room.status,
      hasQuestion: !!room.current_question_id,
      revealed: session.votes_revealed,
      votingEndsAt: session.voting_ends_at
        ? new Date(session.voting_ends_at).getTime()
        : null,
      now: Date.now(),
    });
    if (!check.ok) throw new ApiError(409, check.error);

    // UNIQUE(room_id, question_id, participant_id) guarantees one vote per person.
    const { error } = await db().from("votes").insert({
      room_id: room.id,
      question_id: room.current_question_id,
      participant_id: me.id,
      candidate_name: candidate,
    });
    if (error) {
      if (error.code === "23505") throw new ApiError(409, "Naka-vote ka na sa tanong na ito.");
      throw error;
    }
    return NextResponse.json({ ok: true });
  },
);

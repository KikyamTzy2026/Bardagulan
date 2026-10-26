import { NextResponse } from "next/server";
import { z } from "zod";
import { db, type RoomRow, type SessionRow } from "@/lib/server/db";
import { ApiError, handle, readJson } from "@/lib/server/errors";
import {
  authParticipant,
  getRoomByCode,
  getSession,
  requireHost,
  tokenFrom,
} from "@/lib/server/auth";
import { ALL_QUESTIONS, QUESTION_MAP } from "@/lib/questions";
import { pickQuestions } from "@/lib/game";
import { normalizeSettings, settingsInputSchema } from "@/lib/settings";

export const dynamic = "force-dynamic";

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("start") }),
  z.object({ action: z.literal("reveal") }),
  z.object({ action: z.literal("next") }),
  z.object({ action: z.literal("skip") }),
  z.object({ action: z.literal("pause") }),
  z.object({ action: z.literal("resume") }),
  z.object({ action: z.literal("end") }),
  z.object({ action: z.literal("pick"), questionId: z.string().max(20) }),
  z.object({ action: z.literal("settings"), settings: settingsInputSchema }),
]);

const timerEnd = (seconds: number) =>
  seconds > 0 ? new Date(Date.now() + seconds * 1000).toISOString() : null;

async function updateRoom(id: string, patch: Record<string, unknown>) {
  const { error } = await db().from("game_rooms").update(patch).eq("id", id);
  if (error) throw error;
}
async function updateSession(id: string, patch: Record<string, unknown>) {
  const { error } = await db().from("game_sessions").update(patch).eq("id", id);
  if (error) throw error;
}

/** Records a question in played_questions once. */
async function markPlayed(roomId: string, questionId: string, skipped: boolean) {
  const sb = db();
  const { data } = await sb
    .from("played_questions")
    .select("id")
    .eq("room_id", roomId)
    .eq("question_id", questionId)
    .maybeSingle();
  if (data) {
    if (!skipped) {
      await sb
        .from("played_questions")
        .update({ revealed_at: new Date().toISOString(), skipped: false })
        .eq("id", data.id);
    }
    return;
  }
  await sb.from("played_questions").insert({
    room_id: roomId,
    question_id: questionId,
    skipped,
    revealed_at: skipped ? null : new Date().toISOString(),
  });
}

const FRESH = {
  votes_revealed: false,
  paused_remaining_ms: null,
};

async function showQuestion(
  room: RoomRow,
  session: SessionRow,
  index: number,
  questionId: string,
  timer: number,
) {
  await updateSession(session.id, {
    ...FRESH,
    current_index: index,
    voting_ends_at: timerEnd(timer),
  });
  await updateRoom(room.id, {
    status: "playing",
    current_question_id: questionId,
    current_question_index: index,
  });
}

async function finishGame(room: RoomRow, session: SessionRow) {
  await updateSession(session.id, { ...FRESH, voting_ends_at: null });
  await updateRoom(room.id, { status: "finished", current_question_id: null });
}

export const POST = handle(
  async (req: Request, ctx: { params: Promise<{ code: string }> }) => {
    const { code } = await ctx.params;
    const body = actionSchema.parse(await readJson(req));

    const room = await getRoomByCode(code);
    const me = await authParticipant(room.id, tokenFrom(req));
    requireHost(me, room);
    const session = await getSession(room.id);
    const settings = normalizeSettings(room.settings as never);
    const qid = room.current_question_id;
    const live = room.status === "playing" || room.status === "paused";

    switch (body.action) {
      case "settings": {
        if (room.status !== "waiting") {
          throw new ApiError(409, "Hindi na mababago ang settings habang naglalaro.");
        }
        const next = normalizeSettings({ ...settings, ...body.settings });
        await updateRoom(room.id, { settings: next });
        break;
      }

      case "start": {
        if (room.status !== "waiting") throw new ApiError(409, "Nagsimula na ang laro.");
        if (settings.mode === "host_led") {
          await updateSession(session.id, {
            ...FRESH,
            question_ids: [],
            current_index: 0,
            voting_ends_at: null,
          });
          await updateRoom(room.id, { status: "playing", current_question_id: null });
        } else {
          const ids = pickQuestions(ALL_QUESTIONS, settings);
          if (ids.length === 0) throw new ApiError(500, "Walang mapiling tanong.");
          await updateSession(session.id, { question_ids: ids });
          await showQuestion(room, { ...session, question_ids: ids }, 0, ids[0], settings.votingTimer);
        }
        break;
      }

      case "pick": {
        if (settings.mode !== "host_led") throw new ApiError(409, "Para lang ito sa Host-Led mode.");
        if (!live || qid) throw new ApiError(409, "Tapusin muna ang kasalukuyang tanong.");
        if (!QUESTION_MAP.has(body.questionId)) throw new ApiError(404, "Walang ganyang tanong.");
        if (session.question_ids.includes(body.questionId)) {
          throw new ApiError(409, "Nalaro na ang tanong na iyan.");
        }
        const ids = [...session.question_ids, body.questionId];
        await updateSession(session.id, { question_ids: ids });
        await showQuestion(room, session, ids.length - 1, body.questionId, settings.votingTimer);
        break;
      }

      case "pause": {
        if (room.status !== "playing" || !qid || session.votes_revealed) {
          throw new ApiError(409, "Walang pwedeng i-pause ngayon.");
        }
        const remaining = session.voting_ends_at
          ? Math.max(0, new Date(session.voting_ends_at).getTime() - Date.now())
          : null;
        await updateSession(session.id, {
          paused_remaining_ms: remaining,
          voting_ends_at: null,
        });
        await updateRoom(room.id, { status: "paused" });
        break;
      }

      case "resume": {
        if (room.status !== "paused") throw new ApiError(409, "Hindi naka-pause ang laro.");
        await updateSession(session.id, {
          paused_remaining_ms: null,
          voting_ends_at:
            session.paused_remaining_ms !== null
              ? new Date(Date.now() + session.paused_remaining_ms).toISOString()
              : null,
        });
        await updateRoom(room.id, { status: "playing" });
        break;
      }

      case "reveal": {
        if (!live || !qid) throw new ApiError(409, "Walang tanong na pwedeng i-reveal.");
        if (session.votes_revealed) break;
        await updateSession(session.id, { votes_revealed: true, voting_ends_at: null });
        await updateRoom(room.id, { status: "playing" });
        await markPlayed(room.id, qid, false);
        break;
      }

      case "next":
      case "skip": {
        if (!live) throw new ApiError(409, "Hindi pa/tapos na ang laro.");
        if (body.action === "next" && qid && !session.votes_revealed) {
          throw new ApiError(409, "I-reveal muna ang results (o gamitin ang Skip).");
        }
        if (qid && body.action === "skip") await markPlayed(room.id, qid, true);

        if (settings.mode === "host_led") {
          // Host picks the next one from the library.
          await updateSession(session.id, { ...FRESH, voting_ends_at: null });
          await updateRoom(room.id, { status: "playing", current_question_id: null });
        } else {
          const nextIndex = session.current_index + 1;
          if (nextIndex >= session.question_ids.length) {
            await finishGame(room, session);
          } else {
            await showQuestion(
              room,
              session,
              nextIndex,
              session.question_ids[nextIndex],
              settings.votingTimer,
            );
          }
        }
        break;
      }

      case "end": {
        if (room.status === "finished") break;
        await finishGame(room, session);
        break;
      }
    }

    return NextResponse.json({ ok: true });
  },
);

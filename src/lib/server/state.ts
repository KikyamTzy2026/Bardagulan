import { db, type ParticipantRow, type RoomRow, type SessionRow } from "./db";
import { QUESTION_MAP } from "../questions";
import { normalizeSettings } from "../settings";
import { tally, winnersOf } from "../game";
import type { Phase, RecapRow, RoomState } from "../types";

const ONLINE_MS = 15_000;

/**
 * Builds exactly what this participant is allowed to see. Vote contents are only
 * included once the host has revealed the current question.
 */
export async function buildState(
  room: RoomRow,
  session: SessionRow,
  me: ParticipantRow,
): Promise<RoomState> {
  const sb = db();
  const settings = normalizeSettings(room.settings as never);
  const now = Date.now();

  const { data: parts, error: pErr } = await sb
    .from("room_participants")
    .select("id, nickname, is_host, last_seen_at")
    .eq("room_id", room.id)
    .order("joined_at");
  if (pErr) throw pErr;

  const qid = room.current_question_id;
  let questionVotes: { participant_id: string; candidate_name: string }[] = [];
  if (qid) {
    const { data, error } = await sb
      .from("votes")
      .select("participant_id, candidate_name")
      .eq("room_id", room.id)
      .eq("question_id", qid);
    if (error) throw error;
    questionVotes = data ?? [];
  }
  const voted = new Set(questionVotes.map((v) => v.participant_id));
  const myVote =
    questionVotes.find((v) => v.participant_id === me.id)?.candidate_name ?? null;

  const participants = (parts ?? []).map((p) => ({
    id: p.id as string,
    nickname: p.nickname as string,
    isHost: p.is_host as boolean,
    hasVoted: voted.has(p.id as string),
    online: now - new Date(p.last_seen_at as string).getTime() < ONLINE_MS,
  }));

  let game: RoomState["game"] = null;
  if (room.status === "playing" || room.status === "paused") {
    const q = qid ? QUESTION_MAP.get(qid) : undefined;
    const endsAt = session.voting_ends_at
      ? new Date(session.voting_ends_at).getTime()
      : null;

    let phase: Phase = "voting";
    if (session.votes_revealed) phase = "revealed";
    else if (room.status === "paused") phase = "paused";
    else if (endsAt !== null && now >= endsAt) phase = "closed";

    let results: NonNullable<RoomState["game"]>["results"] = null;
    if (session.votes_revealed && q) {
      const rows = tally(questionVotes.map((v) => v.candidate_name));
      results = {
        tally: rows,
        totalVotes: questionVotes.length,
        winners: winnersOf(rows),
      };
    }

    game = {
      index: session.current_index,
      total: settings.mode === "host_led" ? null : session.question_ids.length,
      question: q ? { id: q.id, category: q.category, text: q.question } : null,
      phase,
      votingEndsAt: endsAt,
      pausedRemainingMs: session.paused_remaining_ms,
      myVote: phase === "revealed" || myVote ? myVote : null,
      votedCount: voted.size,
      results,
    };
  }

  let final: RoomState["final"] = null;
  if (room.status === "finished") final = await buildFinal(room.id);

  return {
    serverNow: now,
    room: {
      code: room.code,
      status: room.status,
      settings,
      expiresAt: room.expires_at,
    },
    me: { id: me.id, nickname: me.nickname, isHost: me.is_host },
    participants,
    game,
    final,
  };
}

/** Final leaderboard + per-question recap. Only counts questions that were revealed. */
async function buildFinal(roomId: string): Promise<RoomState["final"]> {
  const sb = db();
  const { data: played } = await sb
    .from("played_questions")
    .select("question_id, created_at")
    .eq("room_id", roomId)
    .eq("skipped", false)
    .not("revealed_at", "is", null)
    .order("created_at");
  const ids = (played ?? []).map((p) => p.question_id as string);
  if (ids.length === 0) return { overall: tally([]), recap: [] };

  const { data: votes } = await sb
    .from("votes")
    .select("question_id, candidate_name")
    .eq("room_id", roomId)
    .in("question_id", ids);

  const byQuestion = new Map<string, string[]>();
  for (const v of votes ?? []) {
    const list = byQuestion.get(v.question_id as string) ?? [];
    list.push(v.candidate_name as string);
    byQuestion.set(v.question_id as string, list);
  }

  const recap: RecapRow[] = [];
  for (const id of ids) {
    const q = QUESTION_MAP.get(id);
    if (!q) continue;
    const rows = tally(byQuestion.get(id) ?? []);
    const winners = winnersOf(rows);
    recap.push({
      questionId: id,
      text: q.question,
      category: q.category,
      winners,
      count: winners.length ? rows[0].count : 0,
      totalVotes: (byQuestion.get(id) ?? []).length,
    });
  }

  return {
    overall: tally((votes ?? []).map((v) => v.candidate_name as string)),
    recap,
  };
}

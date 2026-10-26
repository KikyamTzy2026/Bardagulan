import { test } from "node:test";
import assert from "node:assert/strict";
import { __setDbForTests } from "../src/lib/server/db";
import { createFakeDb } from "./fake-db";
import { POST as createRoom } from "../src/app/api/rooms/route";
import { POST as joinRoom } from "../src/app/api/rooms/[code]/join/route";
import { GET as getState } from "../src/app/api/rooms/[code]/state/route";
import { POST as castVote } from "../src/app/api/rooms/[code]/vote/route";
import { POST as doAction } from "../src/app/api/rooms/[code]/action/route";

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const post = (url: string, body: unknown, token?: string) =>
  new Request(`http://t${url}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(token ? { "x-session-token": token } : {}) },
    body: JSON.stringify(body),
  });

async function call(res: Promise<Response>): Promise<{ status: number; body: Json }> {
  const r = await res;
  return { status: r.status, body: (await r.json()) as Json };
}

function setup() {
  const fake = createFakeDb();
  __setDbForTests(fake);
  return fake;
}

async function newGame(settings: Json = { mode: "quick", votingTimer: 0 }) {
  const host = await call(createRoom(post("/api/rooms", { nickname: "Boss", settings })));
  assert.equal(host.status, 200);
  const code = host.body.code as string;
  const ctx = { params: Promise.resolve({ code }) };
  const joined = await call(joinRoom(post(`/api/rooms/${code}/join`, { nickname: "Pat" }), ctx));
  assert.equal(joined.status, 200);
  const hostToken = host.body.token as string;
  const patToken = joined.body.token as string;

  const state = async (token: string) => {
    const r = await call(getState(new Request("http://t/s", { headers: { "x-session-token": token } }), ctx));
    return r;
  };
  const act = (token: string, body: Json) => call(doAction(post("/a", body, token), ctx));
  const vote = (token: string, candidate: string) => call(castVote(post("/v", { candidate }, token), ctx));
  return { code, hostToken, patToken, state, act, vote, ctx };
}

test("full quick game: hidden votes, one vote each, host-only controls, reveal, finish", async () => {
  const fake = setup();
  const g = await newGame();

  // Duplicate nickname is rejected
  const dup = await call(joinRoom(post(`/api/rooms/${g.code}/join`, { nickname: "pat" }), g.ctx));
  assert.equal(dup.status, 409);

  // Tokens are stored hashed
  assert.ok(fake.tables.room_participants.every((p) => p.session_token !== g.hostToken && p.session_token !== g.patToken));

  // Unauthenticated / wrong token cannot read state
  assert.equal((await g.state("nope")).status, 401);

  // Non-host cannot start; host can
  assert.equal((await g.act(g.patToken, { action: "start" })).status, 403);
  assert.equal((await g.act(g.hostToken, { action: "start" })).status, 200);

  let s = (await g.state(g.patToken)).body;
  assert.equal(s.room.status, "playing");
  assert.equal(s.game.total, 10);
  assert.ok(s.game.question.text.length > 5);
  assert.equal(s.game.phase, "voting");

  // Voting
  assert.equal((await g.vote(g.hostToken, "DANNA")).status, 200);
  assert.equal((await g.vote(g.hostToken, "RABS")).status, 409); // one vote per participant
  assert.equal((await g.vote(g.patToken, "NOBODY")).status, 400); // invalid candidate
  assert.equal((await g.vote(g.patToken, "DANNA")).status, 200);

  // Hidden until reveal: no results, and nobody sees other people's votes
  s = (await g.state(g.patToken)).body;
  assert.equal(s.game.results, null);
  assert.equal(s.game.votedCount, 2);
  assert.equal(s.game.myVote, "DANNA");
  const raw = JSON.stringify((await g.state(g.patToken)).body);
  assert.ok(!raw.includes("candidate_name"));

  // Only the host can reveal / skip / end; can't go next before reveal
  assert.equal((await g.act(g.patToken, { action: "reveal" })).status, 403);
  assert.equal((await g.act(g.patToken, { action: "end" })).status, 403);
  assert.equal((await g.act(g.hostToken, { action: "next" })).status, 409);

  assert.equal((await g.act(g.hostToken, { action: "reveal" })).status, 200);
  s = (await g.state(g.patToken)).body;
  assert.equal(s.game.phase, "revealed");
  assert.equal(s.game.results.totalVotes, 2);
  assert.deepEqual(s.game.results.winners, ["DANNA"]);
  assert.equal(s.game.results.tally[0].count, 2);

  // Votes after reveal are refused
  assert.equal((await g.vote(g.patToken, "VI")).status, 409);

  // Next question has a clean slate
  assert.equal((await g.act(g.hostToken, { action: "next" })).status, 200);
  s = (await g.state(g.hostToken)).body;
  assert.equal(s.game.index, 1);
  assert.equal(s.game.phase, "voting");
  assert.equal(s.game.myVote, null);
  assert.equal(s.game.votedCount, 0);

  // Skip then end
  assert.equal((await g.act(g.hostToken, { action: "skip" })).status, 200);
  assert.equal((await g.act(g.hostToken, { action: "end" })).status, 200);
  s = (await g.state(g.patToken)).body;
  assert.equal(s.room.status, "finished");
  assert.equal(s.final.recap.length, 1); // only the revealed question counts
  assert.equal(s.final.overall[0].name, "DANNA");
  assert.equal(s.final.overall[0].count, 2);
});

test("a game with N questions finishes after the last reveal", async () => {
  setup();
  const g = await newGame({ mode: "full", questionCount: 5, votingTimer: 0, categories: ["walang_takas"] });
  await g.act(g.hostToken, { action: "start" });
  for (let i = 0; i < 5; i++) {
    await g.act(g.hostToken, { action: "reveal" });
    await g.act(g.hostToken, { action: "next" });
  }
  const s = (await g.state(g.hostToken)).body;
  assert.equal(s.room.status, "finished");
});

test("timer: votes after the deadline are rejected; pause blocks voting and resume restores time", async () => {
  const fake = setup();
  const g = await newGame({ mode: "quick", votingTimer: 30 });
  await g.act(g.hostToken, { action: "start" });

  // Pause blocks votes
  assert.equal((await g.act(g.hostToken, { action: "pause" })).status, 200);
  let s = (await g.state(g.patToken)).body;
  assert.equal(s.game.phase, "paused");
  assert.ok(s.game.pausedRemainingMs > 25_000);
  assert.equal((await g.vote(g.patToken, "VI")).status, 409);

  assert.equal((await g.act(g.hostToken, { action: "resume" })).status, 200);
  assert.equal((await g.vote(g.patToken, "VI")).status, 200);

  // Force the deadline into the past
  fake.tables.game_sessions[0].voting_ends_at = new Date(Date.now() - 1000).toISOString();
  s = (await g.state(g.hostToken)).body;
  assert.equal(s.game.phase, "closed");
  assert.equal((await g.vote(g.hostToken, "VI")).status, 409);
});

test("host-led mode: host picks questions, no repeats", async () => {
  setup();
  const g = await newGame({ mode: "host_led", votingTimer: 0 });
  await g.act(g.hostToken, { action: "start" });
  let s = (await g.state(g.patToken)).body;
  assert.equal(s.game.question, null);
  assert.equal(s.game.total, null);

  assert.equal((await g.act(g.patToken, { action: "pick", questionId: "ok-0001" })).status, 403);
  assert.equal((await g.act(g.hostToken, { action: "pick", questionId: "nope" })).status, 404);
  assert.equal((await g.act(g.hostToken, { action: "pick", questionId: "ok-0001" })).status, 200);
  s = (await g.state(g.patToken)).body;
  assert.equal(s.game.question.id, "ok-0001");

  await g.vote(g.patToken, "MARK");
  await g.act(g.hostToken, { action: "reveal" });
  await g.act(g.hostToken, { action: "next" });
  s = (await g.state(g.patToken)).body;
  assert.equal(s.game.question, null);
  assert.equal((await g.act(g.hostToken, { action: "pick", questionId: "ok-0001" })).status, 409);
  assert.equal((await g.act(g.hostToken, { action: "pick", questionId: "ok-0002" })).status, 200);
});

test("settings can only change in the lobby, and only by the host", async () => {
  setup();
  const g = await newGame();
  assert.equal((await g.act(g.patToken, { action: "settings", settings: { votingTimer: 15 } })).status, 403);
  assert.equal((await g.act(g.hostToken, { action: "settings", settings: { votingTimer: 15 } })).status, 200);
  assert.equal((await g.state(g.hostToken)).body.room.settings.votingTimer, 15);
  await g.act(g.hostToken, { action: "start" });
  assert.equal((await g.act(g.hostToken, { action: "settings", settings: { votingTimer: 45 } })).status, 409);
});

test("a late joiner can vote, and a finished room refuses new players", async () => {
  setup();
  const g = await newGame();
  await g.act(g.hostToken, { action: "start" });
  const late = await call(joinRoom(post(`/api/rooms/${g.code}/join`, { nickname: "Late" }), g.ctx));
  assert.equal(late.status, 200);
  assert.equal((await g.vote(late.body.token, "ARLYN")).status, 200);
  await g.act(g.hostToken, { action: "end" });
  const tooLate = await call(joinRoom(post(`/api/rooms/${g.code}/join`, { nickname: "Tooooo" }), g.ctx));
  assert.equal(tooLate.status, 409);
});

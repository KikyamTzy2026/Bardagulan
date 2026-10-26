import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  canVote,
  generateRoomCode,
  isValidRoomCode,
  mulberry32,
  pickQuestions,
  tally,
  validateNickname,
  winnersOf,
  type QuestionRow,
} from "../src/lib/game";
import { CANDIDATES, isValidCandidate } from "../src/lib/candidates";
import { normalizeSettings } from "../src/lib/settings";
import { hashToken, newToken } from "../src/lib/server/auth";

const questions: QuestionRow[] = JSON.parse(
  readFileSync(join(process.cwd(), "data", "questions.json"), "utf8"),
);

test("there are exactly 21 uppercase candidates", () => {
  assert.equal(CANDIDATES.length, 21);
  assert.equal(new Set(CANDIDATES).size, 21);
  assert.ok(CANDIDATES.every((c) => c === c.toUpperCase()));
  assert.ok(isValidCandidate("DANNA"));
  assert.ok(!isValidCandidate("danna"));
  assert.ok(!isValidCandidate("NOBODY"));
});

test("question bank is 2100 with 800/650/650 split", () => {
  assert.equal(questions.length, 2100);
  const count = (c: string) => questions.filter((q) => q.category === c).length;
  assert.equal(count("office_kalokohan"), 800);
  assert.equal(count("lovelife_edition"), 650);
  assert.equal(count("walang_takas"), 650);
  assert.equal(new Set(questions.map((q) => q.id)).size, 2100);
});

test("room codes are 6 chars from the safe alphabet", () => {
  const rng = mulberry32(1);
  for (let i = 0; i < 200; i++) {
    const code = generateRoomCode(rng);
    assert.equal(code.length, 6);
    assert.ok(isValidRoomCode(code), code);
  }
});

test("nickname validation trims and enforces length", () => {
  assert.equal(validateNickname("  Kuya   Jun "), "Kuya Jun");
  assert.equal(validateNickname("a"), null);
  assert.equal(validateNickname("x".repeat(21)), null);
  assert.equal(validateNickname(42), null);
});

test("tally counts one vote each and sorts by votes then name", () => {
  const rows = tally(["RABS", "DANNA", "RABS", "VI", "RABS", "DANNA"]);
  assert.equal(rows.length, 21);
  assert.deepEqual(rows.slice(0, 3), [
    { name: "RABS", count: 3 },
    { name: "DANNA", count: 2 },
    { name: "VI", count: 1 },
  ]);
  assert.deepEqual(winnersOf(rows), ["RABS"]);
});

test("ties produce multiple winners and no votes produce none", () => {
  assert.deepEqual(winnersOf(tally(["VI", "DEN"])), ["DEN", "VI"]);
  assert.deepEqual(winnersOf(tally([])), []);
});

test("invalid candidate names are ignored by tally", () => {
  const rows = tally(["NOBODY", "VI"]);
  assert.equal(rows.reduce((n, r) => n + r.count, 0), 1);
});

test("quick mode picks 10 unique questions", () => {
  const ids = pickQuestions(questions, { mode: "quick" }, mulberry32(7));
  assert.equal(ids.length, 10);
  assert.equal(new Set(ids).size, 10);
});

test("full mode keeps round order and splits evenly", () => {
  const ids = pickQuestions(questions, { mode: "full", questionCount: 30 }, mulberry32(3));
  const cats = ids.map((id) => questions.find((q) => q.id === id)!.category);
  assert.equal(ids.length, 30);
  assert.deepEqual(cats.slice(0, 10), Array(10).fill("office_kalokohan"));
  assert.deepEqual(cats.slice(10, 20), Array(10).fill("lovelife_edition"));
  assert.deepEqual(cats.slice(20), Array(10).fill("walang_takas"));
});

test("category mode only uses one category", () => {
  const ids = pickQuestions(
    questions,
    { mode: "category", categories: ["walang_takas", "lovelife_edition"], questionCount: 15 },
    mulberry32(5),
  );
  const cats = new Set(ids.map((id) => questions.find((q) => q.id === id)!.category));
  assert.deepEqual([...cats], ["walang_takas"]);
  assert.equal(ids.length, 15);
});

test("host-led mode preselects nothing", () => {
  assert.deepEqual(pickQuestions(questions, { mode: "host_led" }), []);
  assert.equal(normalizeSettings({ mode: "host_led" }).questionCount, 0);
});

test("settings are clamped", () => {
  const s = normalizeSettings({ mode: "random", questionCount: 9999, votingTimer: 9999 });
  assert.equal(s.questionCount, 100);
  assert.equal(s.votingTimer, 120);
  assert.ok(s.categories.length === 3);
});

test("voting rules: only while playing, not revealed, before the timer ends", () => {
  const base = {
    roomStatus: "playing" as const,
    hasQuestion: true,
    revealed: false,
    votingEndsAt: 2000,
    now: 1000,
  };
  assert.equal(canVote(base).ok, true);
  assert.equal(canVote({ ...base, now: 2500 }).ok, false);
  assert.equal(canVote({ ...base, revealed: true }).ok, false);
  assert.equal(canVote({ ...base, roomStatus: "paused" }).ok, false);
  assert.equal(canVote({ ...base, roomStatus: "waiting" }).ok, false);
  assert.equal(canVote({ ...base, hasQuestion: false }).ok, false);
  assert.equal(canVote({ ...base, votingEndsAt: null, now: 9e12 }).ok, true);
});

test("session tokens are random and stored only as hashes", () => {
  const a = newToken();
  const b = newToken();
  assert.notEqual(a, b);
  assert.equal(a.length, 64);
  assert.equal(hashToken(a), hashToken(a));
  assert.notEqual(hashToken(a), a);
  assert.equal(hashToken(a).length, 64);
});

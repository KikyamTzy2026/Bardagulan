import { CANDIDATES, isValidCandidate } from "./candidates";
import {
  CATEGORY_IDS,
  type CategoryId,
  type GameSettings,
  normalizeSettings,
} from "./settings";

export interface QuestionRow {
  id: string;
  category: CategoryId;
  question: string;
  humor_tags?: string[];
  order?: number;
}

export type Rng = () => number;

/** Small deterministic RNG, handy for tests. */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(items: readonly T[], rng: Rng = Math.random): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I, O, 0, 1

export function generateRoomCode(rng: Rng = Math.random, length = 6): string {
  let out = "";
  for (let i = 0; i < length; i++) {
    out += CODE_ALPHABET[Math.floor(rng() * CODE_ALPHABET.length)];
  }
  return out;
}

export function isValidRoomCode(code: string): boolean {
  return /^[A-Z2-9]{6}$/.test(code) && !/[IO]/.test(code);
}

export function validateNickname(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const nick = raw.trim().replace(/\s+/g, " ");
  if (nick.length < 2 || nick.length > 20) return null;
  return nick;
}

const byOrder = (a: QuestionRow, b: QuestionRow) =>
  (a.order ?? 0) - (b.order ?? 0);

/** Picks the question ids for a game according to its settings. */
export function pickQuestions(
  pool: readonly QuestionRow[],
  rawSettings: Partial<GameSettings>,
  rng: Rng = Math.random,
): string[] {
  const s = normalizeSettings(rawSettings);
  if (s.mode === "host_led") return [];

  const allowed = new Set<CategoryId>(s.categories);
  const eligible = pool.filter((q) => allowed.has(q.category));
  const take = (list: QuestionRow[], n: number) =>
    (s.randomize ? shuffle(list, rng) : [...list].sort(byOrder)).slice(0, n);

  if (s.mode === "full") {
    const cats = CATEGORY_IDS.filter((c) => allowed.has(c));
    const base = Math.floor(s.questionCount / cats.length);
    const extra = s.questionCount % cats.length;
    return cats.flatMap((cat, i) =>
      take(
        eligible.filter((q) => q.category === cat),
        base + (i < extra ? 1 : 0),
      ).map((q) => q.id),
    );
  }

  return take(eligible, s.questionCount).map((q) => q.id);
}

export interface TallyRow {
  name: string;
  count: number;
}

/** Counts votes per candidate. Every candidate is listed; sorted by votes then name. */
export function tally(
  votes: readonly string[],
  candidates: readonly string[] = CANDIDATES,
): TallyRow[] {
  const counts = new Map<string, number>(candidates.map((c) => [c, 0]));
  for (const v of votes) {
    if (isValidCandidate(v) || counts.has(v)) {
      counts.set(v, (counts.get(v) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

export function winnersOf(rows: readonly TallyRow[]): string[] {
  const max = rows.reduce((m, r) => Math.max(m, r.count), 0);
  if (max === 0) return [];
  return rows.filter((r) => r.count === max).map((r) => r.name);
}

export type RoomStatusLite = "waiting" | "playing" | "paused" | "finished" | "expired";

/** Can this participant still cast a vote right now? Pure rule check used by the vote API. */
export function canVote(args: {
  roomStatus: RoomStatusLite;
  hasQuestion: boolean;
  revealed: boolean;
  votingEndsAt: number | null;
  now: number;
}): { ok: true } | { ok: false; error: string } {
  if (args.roomStatus === "paused") return { ok: false, error: "Naka-pause ang laro." };
  if (args.roomStatus !== "playing") return { ok: false, error: "Hindi pa/tapos na ang laro." };
  if (!args.hasQuestion) return { ok: false, error: "Wala pang tanong." };
  if (args.revealed) return { ok: false, error: "Na-reveal na ang results." };
  if (args.votingEndsAt !== null && args.now > args.votingEndsAt) {
    return { ok: false, error: "Tapos na ang oras!" };
  }
  return { ok: true };
}

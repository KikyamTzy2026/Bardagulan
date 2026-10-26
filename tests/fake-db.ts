/* eslint-disable @typescript-eslint/no-explicit-any */
// Minimal in-memory stand-in for the Supabase query builder, just enough for the API routes.
type Row = Record<string, any>;

const UNIQUE: Record<string, string[][]> = {
  game_rooms: [["code"]],
  room_participants: [["room_id", "nickname"]],
  votes: [["room_id", "question_id", "participant_id"]],
  game_sessions: [["room_id"]],
};

export function createFakeDb() {
  const tables: Record<string, Row[]> = {
    game_rooms: [],
    room_participants: [],
    game_sessions: [],
    votes: [],
    played_questions: [],
  };

  function defaults(table: string, row: Row): Row {
    const now = new Date().toISOString();
    const base: Row = { id: crypto.randomUUID(), created_at: now };
    if (table === "game_rooms") {
      Object.assign(base, {
        status: "waiting",
        current_question_id: null,
        current_question_index: 0,
        expires_at: new Date(Date.now() + 864e5).toISOString(),
      });
    }
    if (table === "room_participants") Object.assign(base, { joined_at: now, last_seen_at: now });
    if (table === "game_sessions") {
      Object.assign(base, {
        question_ids: [],
        current_index: 0,
        votes_revealed: false,
        voting_ends_at: null,
        paused_remaining_ms: null,
      });
    }
    if (table === "played_questions") Object.assign(base, { skipped: false, revealed_at: null });
    return { ...base, ...row };
  }

  class Q implements PromiseLike<any> {
    private filters: ((r: Row) => boolean)[] = [];
    private op: "select" | "insert" | "update" = "select";
    private payload: Row = {};
    private mode: "none" | "maybe" | "one" = "none";
    private orderBy: string | null = null;
    private selectCols = "*";
    constructor(private table: string) {}

    select(cols = "*") { this.selectCols = cols; return this; }
    insert(p: Row) { this.op = "insert"; this.payload = p; return this; }
    update(p: Row) { this.op = "update"; this.payload = p; return this; }
    eq(c: string, v: any) { this.filters.push((r) => r[c] === v); return this; }
    in(c: string, vs: any[]) { this.filters.push((r) => vs.includes(r[c])); return this; }
    not(c: string, _op: string, v: any) { this.filters.push((r) => r[c] !== v); return this; }
    order(c: string) { this.orderBy = c; return this; }
    maybeSingle() { this.mode = "maybe"; return this; }
    single() { this.mode = "one"; return this; }

    private run(): { data: any; error: any } {
      const rows = tables[this.table];
      if (this.op === "insert") {
        const row = defaults(this.table, this.payload);
        for (const cols of UNIQUE[this.table] ?? []) {
          if (rows.some((r) => cols.every((c) => r[c] === row[c]))) {
            return { data: null, error: { code: "23505", message: "duplicate" } };
          }
        }
        rows.push(row);
        return { data: this.mode === "none" ? null : pick(row, this.selectCols), error: null };
      }
      const matched = rows.filter((r) => this.filters.every((f) => f(r)));
      if (this.op === "update") {
        matched.forEach((r) => Object.assign(r, this.payload));
        return { data: null, error: null };
      }
      let out = matched.map((r) => pick(r, this.selectCols));
      if (this.orderBy) {
        const k = this.orderBy;
        out = out.sort((a, b) => String(a[k] ?? "").localeCompare(String(b[k] ?? "")));
      }
      if (this.mode === "maybe") return { data: out[0] ?? null, error: null };
      if (this.mode === "one") return { data: out[0] ?? null, error: out[0] ? null : { message: "no rows" } };
      return { data: out, error: null };
    }

    then<T1 = any, T2 = never>(
      ok?: ((v: any) => T1 | PromiseLike<T1>) | null,
      err?: ((e: any) => T2 | PromiseLike<T2>) | null,
    ): PromiseLike<T1 | T2> {
      return Promise.resolve(this.run()).then(ok, err);
    }
  }
  function pick(row: Row, cols: string): Row {
    if (cols === "*") return { ...row };
    const out: Row = {};
    for (const c of cols.split(",").map((s) => s.trim())) out[c] = row[c];
    return out;
  }

  return { from: (t: string) => new Q(t), tables };
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, Copy, Crown, Loader2, Users } from "lucide-react";
import {
  ApiClientError,
  apiFetch,
  clearToken,
  loadToken,
  saveToken,
} from "@/lib/client-api";
import { CATEGORY_META, MODE_META, type GameSettings } from "@/lib/settings";
import type { RoomState } from "@/lib/types";
import { cn } from "@/lib/cn";
import { Confetti } from "./Confetti";
import { GameView } from "./GameView";
import { SettingsForm } from "./SettingsForm";

export function RoomClient({ code }: { code: string }) {
  const [token, setToken] = useState<string | null | undefined>(undefined);
  const [state, setState] = useState<RoomState | null>(null);
  const [offset, setOffset] = useState(0);
  const [fatal, setFatal] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [burst, setBurst] = useState(0);

  useEffect(() => {
    setToken(loadToken(code));
  }, [code]);

  const refresh = useCallback(async () => {
    if (!token) return;
    try {
      const s = await apiFetch<RoomState>(`/api/rooms/${code}/state`, { token });
      setState(s);
      setOffset(s.serverNow - Date.now());
      setFatal(null);
    } catch (e) {
      const err = e as ApiClientError;
      if (err.status === 401) {
        clearToken(code);
        setToken(null);
        setState(null);
      } else if (err.status === 404 || err.status === 410) {
        setFatal(err.message);
      }
      // other errors are treated as transient; the next poll will retry
    }
  }, [code, token]);

  // Polling keeps every device in sync. All state lives on the server.
  useEffect(() => {
    if (!token) return;
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    const loop = async () => {
      if (stop) return;
      if (!document.hidden) await refresh();
      timer = setTimeout(loop, 1500);
    };
    loop();
    return () => {
      stop = true;
      clearTimeout(timer);
    };
  }, [token, refresh]);

  // Confetti when results are revealed or the game ends.
  const burstKey =
    state?.room.status === "finished"
      ? "final"
      : state?.game?.phase === "revealed"
        ? `rev:${state.game.question?.id}`
        : null;
  const lastBurst = useRef<string | null>(null);
  useEffect(() => {
    if (burstKey && burstKey !== lastBurst.current) {
      lastBurst.current = burstKey;
      setBurst((b) => b + 1);
    }
  }, [burstKey]);

  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const run = useCallback(
    async (path: string, body: unknown) => {
      setBusy(true);
      try {
        await apiFetch(`/api/rooms/${code}/${path}`, { token, body });
        await refresh();
      } catch (e) {
        flash((e as Error).message);
        await refresh();
      } finally {
        setBusy(false);
      }
    },
    [code, token, refresh],
  );

  if (fatal) {
    return (
      <Centered>
        <p className="text-2xl font-black">😵 {fatal}</p>
        <Link href="/" className="btn btn-primary mt-6 px-6 py-3">
          Bumalik sa home
        </Link>
      </Centered>
    );
  }

  if (token === undefined) {
    return (
      <Centered>
        <Loader2 className="h-8 w-8 animate-spin text-neon-pink" />
      </Centered>
    );
  }

  if (token === null) {
    return (
      <JoinPrompt
        code={code}
        onJoined={(t) => {
          saveToken(code, t);
          setToken(t);
        }}
      />
    );
  }

  if (!state) {
    return (
      <Centered>
        <Loader2 className="h-8 w-8 animate-spin text-neon-pink" />
        <p className="mt-3 text-white/60">Kumokonekta sa room…</p>
      </Centered>
    );
  }

  const status = state.room.status;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-10">
      <Confetti burst={burst} />
      <RoomHeader state={state} />

      {toast && (
        <div role="alert" className="glass pop mb-4 rounded-xl border-neon-pink/50 p-3 text-center text-sm text-neon-pink">
          {toast}
        </div>
      )}

      {status === "waiting" && (
        <Lobby
          state={state}
          busy={busy}
          onSettings={(settings) => run("action", { action: "settings", settings })}
          onStart={() => run("action", { action: "start" })}
        />
      )}

      {(status === "playing" || status === "paused") && state.game && (
        <GameView
          state={state}
          offset={offset}
          busy={busy}
          onVote={(candidate) => run("vote", { candidate })}
          onAction={(body) => run("action", body)}
        />
      )}

      {status === "finished" && <Final state={state} />}
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-4 text-center">
      {children}
    </div>
  );
}

function JoinPrompt({ code, onJoined }: { code: string; onJoined: (token: string) => void }) {
  const [nick, setNick] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await apiFetch<{ token: string }>(`/api/rooms/${code}/join`, {
        body: { nickname: nick },
      });
      onJoined(r.token);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <Centered>
      <form onSubmit={submit} className="glass w-full max-w-sm space-y-4 rounded-2xl p-6">
        <p className="text-sm uppercase tracking-widest text-neon-blue">Room</p>
        <p className="font-mono text-4xl font-black tracking-[0.3em] neon-text">{code.toUpperCase()}</p>
        <input
          className="input"
          placeholder="Nickname (anonymous)"
          maxLength={20}
          value={nick}
          onChange={(e) => setNick(e.target.value)}
          required
          autoFocus
        />
        {error && <p className="text-sm text-neon-pink">{error}</p>}
        <button className="btn btn-primary w-full px-6 py-3" disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sumali!"}
        </button>
        <Link href="/" className="block text-xs text-white/50 hover:text-white">
          Bumalik sa home
        </Link>
      </form>
    </Centered>
  );
}

function RoomHeader({ state }: { state: RoomState }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/room/${state.room.code}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked */
    }
  };
  return (
    <div className="mb-5 flex items-center justify-between gap-3">
      <div>
        <p className="text-[10px] uppercase tracking-[0.25em] text-white/50">Room code</p>
        <p className="font-mono text-2xl font-black tracking-[0.25em] text-neon-pink neon-text">
          {state.room.code}
        </p>
      </div>
      <div className="flex items-center gap-2 text-sm">
        <span className="glass flex items-center gap-1.5 rounded-full px-3 py-1.5">
          <Users className="h-4 w-4 text-neon-blue" /> {state.participants.length}
        </span>
        <button className="btn btn-ghost px-3 py-1.5" onClick={copy}>
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {copied ? "Na-copy!" : "Link"}
        </button>
      </div>
    </div>
  );
}

function Lobby({
  state,
  busy,
  onSettings,
  onStart,
}: {
  state: RoomState;
  busy: boolean;
  onSettings: (s: GameSettings) => void;
  onStart: () => void;
}) {
  const isHost = state.me.isHost;
  const s = state.room.settings;
  const [pending, setPending] = useState<GameSettings | null>(null);
  const shown = pending ?? s;

  return (
    <div className="space-y-5">
      <div className="glass rounded-2xl p-5">
        <h2 className="mb-3 text-lg font-black">
          Mga player <span className="text-white/50">({state.participants.length})</span>
        </h2>
        <ul className="flex flex-wrap gap-2">
          {state.participants.map((p) => (
            <li
              key={p.id}
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold",
                p.id === state.me.id ? "border-neon-blue bg-neon-blue/15" : "border-white/12 bg-white/6",
              )}
            >
              <span
                className={cn("h-2 w-2 rounded-full", p.online ? "bg-emerald-400" : "bg-white/25")}
                aria-label={p.online ? "online" : "offline"}
              />
              {p.isHost && <Crown className="h-3.5 w-3.5 text-yellow-300" />}
              {p.nickname}
              {p.id === state.me.id && <span className="text-xs text-white/50">(ikaw)</span>}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-white/50">
          I-share ang code o ang link sa mga kasama mo. Anonymous ang lahat ng nickname.
        </p>
      </div>

      <div className="glass rounded-2xl p-5">
        <h2 className="mb-3 text-lg font-black">Game settings</h2>
        {isHost ? (
          <SettingsForm
            value={shown}
            disabled={busy}
            onChange={(next) => {
              setPending(next);
              onSettings(next);
            }}
          />
        ) : (
          <dl className="space-y-1 text-sm text-white/80">
            <div><dt className="inline text-white/50">Mode: </dt><dd className="inline font-semibold">{MODE_META[s.mode].label}</dd></div>
            {s.mode !== "host_led" && (
              <div>
                <dt className="inline text-white/50">Round: </dt>
                <dd className="inline font-semibold">
                  {s.categories.map((c) => CATEGORY_META[c].label).join(", ")}
                </dd>
              </div>
            )}
            {s.mode !== "host_led" && (
              <div><dt className="inline text-white/50">Tanong: </dt><dd className="inline font-semibold">{s.questionCount}</dd></div>
            )}
            <div>
              <dt className="inline text-white/50">Oras: </dt>
              <dd className="inline font-semibold">{s.votingTimer ? `${s.votingTimer}s` : "Walang timer"}</dd>
            </div>
          </dl>
        )}
      </div>

      {isHost ? (
        <button className="btn btn-primary w-full px-6 py-4 text-xl" disabled={busy} onClick={onStart}>
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : "Simulan na! 🔥"}
        </button>
      ) : (
        <p className="glass rounded-2xl p-5 text-center text-white/70">
          Hinihintay si host na simulan ang laro…
        </p>
      )}
    </div>
  );
}

function Final({ state }: { state: RoomState }) {
  const final = state.final;
  const ranked = (final?.overall ?? []).filter((r) => r.count > 0);
  const max = ranked[0]?.count ?? 1;
  const top = ranked.slice(0, 3);

  return (
    <div className="space-y-6">
      <div className="glass pop rounded-2xl p-6 text-center">
        <p className="text-sm uppercase tracking-[0.3em] text-neon-blue">Tapos na ang bardagulan</p>
        <h2 className="mt-1 text-3xl font-black neon-text sm:text-4xl">Final Results</h2>
        {top.length > 0 ? (
          <div className="mt-5 flex items-end justify-center gap-3">
            {[top[1], top[0], top[2]].map((t, i) =>
              t ? (
                <div key={t.name} className="flex flex-col items-center">
                  <span className="mb-1 text-2xl">{["🥈", "🥇", "🥉"][i]}</span>
                  <div
                    className={cn(
                      "flex w-24 flex-col items-center justify-end rounded-t-xl bg-gradient-to-t from-neon-violet/60 to-neon-pink/70 px-2 pb-2 text-center sm:w-32",
                      i === 1 ? "h-36" : i === 0 ? "h-28" : "h-20",
                    )}
                  >
                    <span className="text-sm font-black sm:text-base">{t.name}</span>
                    <span className="text-xs text-white/80">{t.count} boto</span>
                  </div>
                </div>
              ) : (
                <div key={i} className="w-24 sm:w-32" />
              ),
            )}
          </div>
        ) : (
          <p className="mt-4 text-white/60">Walang boto na na-reveal. 🦗</p>
        )}
      </div>

      {ranked.length > 0 && (
        <ul className="glass space-y-2 rounded-2xl p-4">
          {ranked.map((row) => (
            <li key={row.name} className="flex items-center gap-3">
              <span className="w-24 shrink-0 text-right text-sm font-black">{row.name}</span>
              <div className="relative h-6 flex-1 overflow-hidden rounded-lg bg-white/8">
                <div
                  className="bar-grow absolute inset-y-0 left-0 rounded-lg bg-gradient-to-r from-neon-violet to-neon-blue"
                  style={{ width: `${Math.max(6, (row.count / max) * 100)}%` }}
                />
              </div>
              <span className="w-10 shrink-0 text-sm tabular-nums text-white/70">{row.count}</span>
            </li>
          ))}
        </ul>
      )}

      {final && final.recap.length > 0 && (
        <details className="glass rounded-2xl p-4">
          <summary className="cursor-pointer font-bold">Recap ng bawat tanong ({final.recap.length})</summary>
          <ul className="mt-3 space-y-3">
            {final.recap.map((r) => (
              <li key={r.questionId} className="border-t border-white/10 pt-3 text-sm">
                <p className="text-white/90">{r.text}</p>
                <p className="mt-1 text-neon-pink">
                  {r.winners.length ? `👑 ${r.winners.join(" & ")} (${r.count}/${r.totalVotes})` : "Walang boto"}
                </p>
              </li>
            ))}
          </ul>
        </details>
      )}

      <Link href="/" className="btn btn-primary w-full px-6 py-3.5 text-lg">
        Laro ulit!
      </Link>
    </div>
  );
}

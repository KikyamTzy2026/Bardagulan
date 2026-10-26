"use client";

import { useEffect, useState } from "react";
import {
  Check,
  Crown,
  Eye,
  FastForward,
  Flag,
  Loader2,
  Pause,
  Play,
  SkipForward,
  Timer,
} from "lucide-react";
import { CANDIDATES } from "@/lib/candidates";
import { CATEGORY_META } from "@/lib/settings";
import type { RoomState, TallyRow } from "@/lib/types";
import { cn } from "@/lib/cn";
import { QuestionBrowser } from "./QuestionBrowser";

type Game = NonNullable<RoomState["game"]>;

function useCountdown(endsAt: number | null, offset: number): number | null {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!endsAt) return;
    const i = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(i);
  }, [endsAt]);
  if (!endsAt) return null;
  return Math.max(0, Math.ceil((endsAt - (now + offset)) / 1000));
}

export function GameView({
  state,
  offset,
  busy,
  onVote,
  onAction,
}: {
  state: RoomState;
  offset: number;
  busy: boolean;
  onVote: (candidate: string) => void;
  onAction: (body: Record<string, unknown>) => void;
}) {
  const game = state.game!;
  const isHost = state.me.isHost;
  const online = state.participants.filter((p) => p.online).length;

  // Host-led: nothing on screen until the host picks a question.
  if (!game.question) {
    return (
      <div className="space-y-4">
        <div className="glass rounded-2xl p-6 text-center">
          <p className="text-2xl font-black">Susunod na tanong…</p>
          <p className="mt-1 text-white/60">
            {isHost
              ? "Pumili ng tanong mula sa library para magsimula ang botohan."
              : "Si host ang pipili ng susunod na tanong. Antay lang!"}
          </p>
        </div>
        {isHost && (
          <>
            <div className="glass rounded-2xl p-4">
              <QuestionBrowser busy={busy} onPick={(id) => onAction({ action: "pick", questionId: id })} />
            </div>
            <HostBar game={game} state={state} busy={busy} onAction={onAction} />
          </>
        )}
      </div>
    );
  }

  const meta = CATEGORY_META[game.question.category];

  return (
    <div className="space-y-5 pb-28">
      <div className="flex items-center justify-between text-sm">
        <span className="rounded-full bg-neon-violet/25 px-3 py-1 font-semibold">
          {meta.emoji} {meta.label}
        </span>
        <span className="text-white/60">
          Tanong {game.index + 1}
          {game.total ? ` / ${game.total}` : ""}
        </span>
      </div>

      <div className="glass pop rounded-2xl p-6 text-center sm:p-10">
        <h2 className="text-2xl font-black leading-snug sm:text-4xl">{game.question.text}</h2>
        <TimerPill game={game} offset={offset} />
      </div>

      {game.phase === "revealed" && game.results ? (
        <Results game={game} />
      ) : (
        <VotePanel game={game} online={online} onVote={onVote} busy={busy} />
      )}

      {isHost && <HostBar game={game} state={state} busy={busy} onAction={onAction} />}
    </div>
  );
}

function TimerPill({ game, offset }: { game: Game; offset: number }) {
  const left = useCountdown(game.phase === "voting" ? game.votingEndsAt : null, offset);
  if (game.phase === "revealed") return null;

  let label: React.ReactNode = null;
  if (game.phase === "paused") {
    const s = game.pausedRemainingMs !== null ? Math.ceil(game.pausedRemainingMs / 1000) : null;
    label = <>⏸ Naka-pause{s !== null ? ` · ${s}s ang natitira` : ""}</>;
  } else if (game.phase === "closed" || left === 0) {
    label = <>⏰ Tapos na ang oras!</>;
  } else if (left !== null) {
    label = (
      <>
        <Timer className="h-4 w-4" /> {left}s
      </>
    );
  }
  if (!label) return null;
  return (
    <div
      className={cn(
        "mx-auto mt-5 inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-bold tabular-nums",
        left !== null && left <= 5 && game.phase === "voting"
          ? "border-neon-pink bg-neon-pink/20 text-neon-pink"
          : "border-white/20 bg-white/5",
      )}
    >
      {label}
    </div>
  );
}

function VotePanel({
  game,
  online,
  onVote,
  busy,
}: {
  game: Game;
  online: number;
  onVote: (c: string) => void;
  busy: boolean;
}) {
  const [picked, setPicked] = useState<string | null>(null);
  const closed = game.phase !== "voting";

  if (game.myVote) {
    return (
      <div className="glass pop rounded-2xl p-6 text-center">
        <Check className="mx-auto mb-2 h-8 w-8 text-neon-blue" />
        <p className="text-xl font-black">Naka-vote ka na kay {game.myVote}!</p>
        <p className="mt-1 text-white/60">
          Hintayin ang reveal ni host. {game.votedCount} / {Math.max(online, game.votedCount)} ang
          nakaboto.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-center text-sm text-white/60">
        {closed ? "Hindi ka na pwedeng bumoto sa tanong na ito." : "Sino sa tingin mo? Pumili ng isa."}
      </p>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-7">
        {CANDIDATES.map((name) => (
          <button
            key={name}
            disabled={closed || busy}
            onClick={() => setPicked(name)}
            className={cn(
              "rounded-xl border px-2 py-3 text-sm font-black tracking-wide transition disabled:opacity-40",
              picked === name
                ? "border-neon-pink bg-neon-pink/25 shadow-[0_0_20px_rgba(255,62,165,0.5)]"
                : "border-white/12 bg-white/6 hover:border-neon-violet hover:bg-white/12",
            )}
          >
            {name}
          </button>
        ))}
      </div>
      <button
        className="btn btn-primary w-full px-6 py-3.5 text-lg"
        disabled={!picked || closed || busy}
        onClick={() => picked && onVote(picked)}
      >
        {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : picked ? `I-vote si ${picked}` : "Pumili muna"}
      </button>
    </div>
  );
}

function Results({ game }: { game: Game }) {
  const r = game.results!;
  const voted: TallyRow[] = r.tally.filter((t) => t.count > 0);
  const zero = r.tally.filter((t) => t.count === 0).map((t) => t.name);
  const max = voted[0]?.count ?? 1;

  return (
    <div className="space-y-4">
      <div className="glass pop rounded-2xl p-5 text-center">
        {r.winners.length ? (
          <>
            <Crown className="mx-auto mb-1 h-8 w-8 text-yellow-300" />
            <p className="text-sm uppercase tracking-widest text-white/50">
              {r.winners.length > 1 ? "Tabla! Panalo sina" : "Panalo"}
            </p>
            <p className="text-4xl font-black text-neon-pink neon-text sm:text-5xl">
              {r.winners.join(" & ")}
            </p>
            <p className="text-white/60">
              {voted[0].count} boto{voted[0].count === 1 ? "" : "s"} sa {r.totalVotes} na bumoto
            </p>
          </>
        ) : (
          <p className="text-xl font-bold">Walang bumoto. Ang tahimik naman! 🦗</p>
        )}
      </div>

      {voted.length > 0 && (
        <ul className="glass space-y-2 rounded-2xl p-4">
          {voted.map((row, i) => (
            <li key={row.name} className="flex items-center gap-3">
              <span className="w-24 shrink-0 text-right text-sm font-black">{row.name}</span>
              <div className="relative h-7 flex-1 overflow-hidden rounded-lg bg-white/8">
                <div
                  className={cn(
                    "bar-grow absolute inset-y-0 left-0 rounded-lg",
                    i === 0 || row.count === max
                      ? "bg-gradient-to-r from-neon-pink to-neon-violet"
                      : "bg-gradient-to-r from-neon-violet/70 to-neon-blue/70",
                  )}
                  style={{ width: `${Math.max(6, (row.count / max) * 100)}%` }}
                />
              </div>
              <span className="w-16 shrink-0 text-sm tabular-nums text-white/70">
                {row.count} · {Math.round((row.count / r.totalVotes) * 100)}%
              </span>
            </li>
          ))}
        </ul>
      )}
      {zero.length > 0 && voted.length > 0 && (
        <p className="text-center text-xs text-white/40">Zero boto: {zero.join(", ")}</p>
      )}
    </div>
  );
}

function HostBar({
  game,
  state,
  busy,
  onAction,
}: {
  game: Game;
  state: RoomState;
  busy: boolean;
  onAction: (body: Record<string, unknown>) => void;
}) {
  const hostLed = state.room.settings.mode === "host_led";
  const isLast = game.total !== null && game.index + 1 >= game.total;
  const revealed = game.phase === "revealed";
  const paused = game.phase === "paused";
  const hasQuestion = !!game.question;

  const confirmEnd = () => {
    if (window.confirm("Tapusin ang laro para sa lahat?")) onAction({ action: "end" });
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/12 bg-ink/85 backdrop-blur-xl">
      <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-center gap-2 px-4 py-3">
        <span className="mr-auto text-xs font-semibold text-white/60">
          👑 HOST
          {hasQuestion && !revealed && (
            <>
              {" "}
              · {game.votedCount}/{state.participants.length} bumoto
            </>
          )}
        </span>

        {hasQuestion && !revealed && (
          <>
            {paused ? (
              <button className="btn btn-ghost px-3 py-2 text-sm" disabled={busy} onClick={() => onAction({ action: "resume" })}>
                <Play className="h-4 w-4" /> Resume
              </button>
            ) : (
              <button className="btn btn-ghost px-3 py-2 text-sm" disabled={busy} onClick={() => onAction({ action: "pause" })}>
                <Pause className="h-4 w-4" /> Pause
              </button>
            )}
            <button className="btn btn-ghost px-3 py-2 text-sm" disabled={busy} onClick={() => onAction({ action: "skip" })}>
              <SkipForward className="h-4 w-4" /> Skip
            </button>
            <button className="btn btn-primary px-4 py-2 text-sm" disabled={busy || paused} onClick={() => onAction({ action: "reveal" })}>
              <Eye className="h-4 w-4" /> Reveal
            </button>
          </>
        )}

        {revealed && (
          <button className="btn btn-primary px-4 py-2 text-sm" disabled={busy} onClick={() => onAction({ action: "next" })}>
            {hostLed ? (
              <>
                <FastForward className="h-4 w-4" /> Pumili ng susunod
              </>
            ) : isLast ? (
              <>
                <Flag className="h-4 w-4" /> Final results
              </>
            ) : (
              <>
                <FastForward className="h-4 w-4" /> Susunod
              </>
            )}
          </button>
        )}

        <button className="btn btn-ghost px-3 py-2 text-sm text-neon-pink" disabled={busy} onClick={confirmEnd}>
          <Flag className="h-4 w-4" /> Tapusin
        </button>
      </div>
    </div>
  );
}

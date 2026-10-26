"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, PartyPopper, LogIn } from "lucide-react";
import { apiFetch, saveToken } from "@/lib/client-api";
import { DEFAULT_SETTINGS, type GameSettings } from "@/lib/settings";
import { SettingsForm } from "./SettingsForm";

interface JoinResp {
  code: string;
  token: string;
}

export function HomeForms() {
  const router = useRouter();
  const [hostNick, setHostNick] = useState("");
  const [settings, setSettings] = useState<GameSettings>(DEFAULT_SETTINGS);
  const [joinCode, setJoinCode] = useState("");
  const [joinNick, setJoinNick] = useState("");
  const [busy, setBusy] = useState<"create" | "join" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy("create");
    setError(null);
    try {
      const r = await apiFetch<JoinResp>("/api/rooms", {
        body: { nickname: hostNick, settings },
      });
      saveToken(r.code, r.token);
      router.push(`/room/${r.code}`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(null);
    }
  }

  async function join(e: React.FormEvent) {
    e.preventDefault();
    setBusy("join");
    setError(null);
    const code = joinCode.trim().toUpperCase();
    try {
      const r = await apiFetch<JoinResp>(`/api/rooms/${encodeURIComponent(code)}/join`, {
        body: { nickname: joinNick },
      });
      saveToken(r.code, r.token);
      router.push(`/room/${r.code}`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      {error && (
        <p role="alert" className="glass rounded-xl border-neon-pink/50 p-3 text-center text-sm text-neon-pink">
          {error}
        </p>
      )}

      <form onSubmit={join} className="glass space-y-4 rounded-2xl p-5">
        <h2 className="flex items-center gap-2 text-xl font-black">
          <LogIn className="h-5 w-5 text-neon-blue" /> Sumali sa Room
        </h2>
        <div className="grid gap-3 sm:grid-cols-[1fr_1.4fr_auto]">
          <input
            className="input text-center font-mono text-lg uppercase tracking-[0.3em]"
            placeholder="CODE"
            maxLength={8}
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
            required
            aria-label="Room code"
          />
          <input
            className="input"
            placeholder="Nickname (anonymous)"
            maxLength={20}
            value={joinNick}
            onChange={(e) => setJoinNick(e.target.value)}
            required
            aria-label="Nickname"
          />
          <button className="btn btn-primary px-6 py-3" disabled={busy !== null}>
            {busy === "join" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sali na!"}
          </button>
        </div>
      </form>

      <form onSubmit={create} className="glass space-y-5 rounded-2xl p-5">
        <h2 className="flex items-center gap-2 text-xl font-black">
          <PartyPopper className="h-5 w-5 text-neon-pink" /> Gumawa ng Room (Host)
        </h2>
        <input
          className="input"
          placeholder="Nickname mo (anonymous)"
          maxLength={20}
          value={hostNick}
          onChange={(e) => setHostNick(e.target.value)}
          required
          aria-label="Host nickname"
        />
        <SettingsForm value={settings} onChange={setSettings} />
        <button className="btn btn-primary w-full px-6 py-3.5 text-lg" disabled={busy !== null}>
          {busy === "create" ? <Loader2 className="h-5 w-5 animate-spin" /> : "Simulan ang Bardagulan 🔥"}
        </button>
      </form>
    </div>
  );
}

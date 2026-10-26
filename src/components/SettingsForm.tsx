"use client";

import {
  CATEGORY_IDS,
  CATEGORY_META,
  MODES,
  MODE_META,
  normalizeSettings,
  type CategoryId,
  type GameSettings,
} from "@/lib/settings";
import { cn } from "@/lib/cn";

const TIMERS = [
  { v: 0, label: "Walang timer" },
  { v: 15, label: "15s" },
  { v: 20, label: "20s" },
  { v: 30, label: "30s" },
  { v: 45, label: "45s" },
  { v: 60, label: "60s" },
];

export function SettingsForm({
  value,
  onChange,
  disabled,
}: {
  value: GameSettings;
  onChange: (s: GameSettings) => void;
  disabled?: boolean;
}) {
  const set = (patch: Partial<GameSettings>) =>
    onChange(normalizeSettings({ ...value, ...patch }));

  const toggleCategory = (c: CategoryId) => {
    if (value.mode === "category") return set({ categories: [c] });
    const has = value.categories.includes(c);
    const next = has ? value.categories.filter((x) => x !== c) : [...value.categories, c];
    if (next.length === 0) return; // keep at least one
    set({ categories: next });
  };

  const showCount = value.mode === "full" || value.mode === "category" || value.mode === "random";
  const showCategories = value.mode !== "host_led";

  return (
    <fieldset disabled={disabled} className="space-y-5">
      <div>
        <p className="mb-2 text-sm font-semibold text-neon-blue">Game mode</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {MODES.map((m) => (
            <button
              type="button"
              key={m}
              onClick={() => set({ mode: m })}
              className={cn(
                "rounded-xl border p-3 text-left transition",
                value.mode === m
                  ? "border-neon-pink bg-neon-pink/15 shadow-[0_0_18px_rgba(255,62,165,0.3)]"
                  : "border-white/12 bg-white/5 hover:bg-white/10",
              )}
            >
              <span className="block font-bold">{MODE_META[m].label}</span>
              <span className="block text-xs text-white/60">{MODE_META[m].blurb}</span>
            </button>
          ))}
        </div>
      </div>

      {showCategories && (
        <div>
          <p className="mb-2 text-sm font-semibold text-neon-blue">
            {value.mode === "category" ? "Piliin ang round" : "Mga round na kasali"}
          </p>
          <div className="flex flex-wrap gap-2">
            {CATEGORY_IDS.map((c) => {
              const on = value.categories.includes(c);
              return (
                <button
                  type="button"
                  key={c}
                  onClick={() => toggleCategory(c)}
                  className={cn(
                    "rounded-full border px-4 py-2 text-sm font-semibold transition",
                    on
                      ? "border-neon-violet bg-neon-violet/25"
                      : "border-white/12 bg-white/5 text-white/60 hover:bg-white/10",
                  )}
                >
                  {CATEGORY_META[c].emoji} {CATEGORY_META[c].label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {showCount && (
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-neon-blue">
              Bilang ng tanong: {value.questionCount}
            </span>
            <input
              type="range"
              min={5}
              max={60}
              step={5}
              value={value.questionCount}
              onChange={(e) => set({ questionCount: Number(e.target.value) })}
              className="w-full accent-[#ff3ea5]"
            />
          </label>
        )}
        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-neon-blue">Oras sa pagboto</span>
          <select
            className="input"
            value={value.votingTimer}
            onChange={(e) => set({ votingTimer: Number(e.target.value) })}
          >
            {TIMERS.map((t) => (
              <option key={t.v} value={t.v} className="bg-panel">
                {t.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {(value.mode === "full" || value.mode === "category") && (
        <label className="flex items-center gap-3 text-sm">
          <input
            type="checkbox"
            checked={value.randomize}
            onChange={(e) => set({ randomize: e.target.checked })}
            className="h-4 w-4 accent-[#ff3ea5]"
          />
          I-randomize ang pagkakasunod ng mga tanong
        </label>
      )}
    </fieldset>
  );
}

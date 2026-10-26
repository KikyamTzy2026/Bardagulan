import { z } from "zod";

export const CATEGORY_IDS = [
  "office_kalokohan",
  "lovelife_edition",
  "walang_takas",
] as const;
export type CategoryId = (typeof CATEGORY_IDS)[number];

export const CATEGORY_META: Record<
  CategoryId,
  { label: string; round: number; emoji: string; blurb: string }
> = {
  office_kalokohan: {
    label: "Office Kalokohan",
    round: 1,
    emoji: "🏢",
    blurb: "Chismis sa cubicle, meeting, at pantry.",
  },
  lovelife_edition: {
    label: "Lovelife Edition",
    round: 2,
    emoji: "💘",
    blurb: "Kilig, hugot, at harutan (safe pa rin sa HR).",
  },
  walang_takas: {
    label: "Walang Takas",
    round: 3,
    emoji: "🔥",
    blurb: "Final round. Walang ligtas sa tawanan!",
  },
};

export const MODES = ["quick", "full", "category", "random", "host_led"] as const;
export type GameMode = (typeof MODES)[number];

export const MODE_META: Record<GameMode, { label: string; blurb: string }> = {
  quick: { label: "Quick Game", blurb: "10 tanong, halo-halo. Pang-break time." },
  full: {
    label: "Full Game",
    blurb: "Round 1 hanggang 3, in order. Pang-buong party.",
  },
  category: { label: "Category", blurb: "Isang round lang ang lalaruin." },
  random: { label: "Random Mix", blurb: "Shuffle lahat. Bahala na si Batman." },
  host_led: {
    label: "Host-Led",
    blurb: "Host ang pipili ng bawat tanong mula sa library.",
  },
};

export interface GameSettings {
  mode: GameMode;
  questionCount: number;
  categories: CategoryId[];
  votingTimer: number; // seconds, 0 = no timer
  randomize: boolean;
}

export const DEFAULT_SETTINGS: GameSettings = {
  mode: "quick",
  questionCount: 10,
  categories: [...CATEGORY_IDS],
  votingTimer: 30,
  randomize: true,
};

export const settingsInputSchema = z
  .object({
    mode: z.enum(MODES),
    questionCount: z.number().int().min(1).max(100),
    categories: z.array(z.enum(CATEGORY_IDS)).max(3),
    votingTimer: z.number().int().min(0).max(120),
    randomize: z.boolean(),
  })
  .partial();

/** Fills in defaults and enforces the rules of each mode. Pure, safe on client + server. */
export function normalizeSettings(
  input?: Partial<GameSettings> | null,
): GameSettings {
  const base = { ...DEFAULT_SETTINGS, ...(input ?? {}) };

  let categories = Array.from(new Set(base.categories)).filter((c) =>
    (CATEGORY_IDS as readonly string[]).includes(c),
  ) as CategoryId[];
  if (categories.length === 0) categories = [...CATEGORY_IDS];

  let questionCount = Math.min(100, Math.max(5, Math.round(base.questionCount)));
  let randomize = base.randomize;

  switch (base.mode) {
    case "quick":
      questionCount = 10;
      randomize = true;
      break;
    case "random":
      randomize = true;
      break;
    case "category":
      categories = [categories[0]];
      break;
    case "host_led":
      questionCount = 0;
      break;
    default:
      break;
  }

  return {
    mode: base.mode,
    questionCount,
    categories,
    votingTimer: Math.min(120, Math.max(0, Math.round(base.votingTimer))),
    randomize,
  };
}

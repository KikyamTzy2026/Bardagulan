import type { CategoryId, GameSettings } from "./settings";
import type { RoomStatusLite, TallyRow } from "./game";

export type { TallyRow };
export type Phase = "voting" | "paused" | "closed" | "revealed";

export interface PublicParticipant {
  id: string;
  nickname: string;
  isHost: boolean;
  hasVoted: boolean;
  online: boolean;
}

export interface RecapRow {
  questionId: string;
  text: string;
  category: CategoryId;
  winners: string[];
  count: number;
  totalVotes: number;
}

export interface RoomState {
  serverNow: number;
  room: {
    code: string;
    status: RoomStatusLite;
    settings: GameSettings;
    expiresAt: string;
  };
  me: { id: string; nickname: string; isHost: boolean };
  participants: PublicParticipant[];
  game: null | {
    index: number;
    total: number | null; // null in host-led mode
    question: { id: string; category: CategoryId; text: string } | null;
    phase: Phase;
    votingEndsAt: number | null;
    pausedRemainingMs: number | null;
    myVote: string | null;
    votedCount: number;
    results: null | { tally: TallyRow[]; totalVotes: number; winners: string[] };
  };
  final: null | { overall: TallyRow[]; recap: RecapRow[] };
}

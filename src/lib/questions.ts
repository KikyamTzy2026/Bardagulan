import raw from "../../data/questions.json";
import type { QuestionRow } from "./game";

/** Bundled question bank (2,100 questions). Server-side only: don't import in client components. */
export const ALL_QUESTIONS = raw as unknown as QuestionRow[];
export const QUESTION_MAP = new Map<string, QuestionRow>(
  ALL_QUESTIONS.map((q) => [q.id, q]),
);

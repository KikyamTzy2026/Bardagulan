/** The 21 coworker candidates everybody votes on. Names are uppercase. */
export const CANDIDATES = [
  "DANNA",
  "RABS",
  "TRINA",
  "YUUJI",
  "BAL",
  "RAF",
  "SAMMY",
  "VI",
  "GREG",
  "KHAOKIE",
  "RAP",
  "RHEIN",
  "SAM",
  "DEN",
  "JASMINE",
  "JOSHUA",
  "MARK",
  "MITS",
  "ROX",
  "ARLYN",
  "ARRIANE",
] as const;

export type Candidate = (typeof CANDIDATES)[number];

export function isValidCandidate(name: unknown): name is Candidate {
  return typeof name === "string" && (CANDIDATES as readonly string[]).includes(name);
}

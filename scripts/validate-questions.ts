/**
 * OFFICE BARDAGULAN 2100 - Question Dataset Validator
 *
 * Checks:
 * - Exactly 2,100 questions
 * - Exactly 800 / 650 / 650 distribution
 * - All IDs unique
 * - No empty questions
 * - No placeholder / lorem / TODO style text
 * - No exact duplicates
 * - Flags highly similar questions (simple word-overlap heuristic)
 * - Valid categories only
 * - Confirms the 21 coworker names are present in config
 */

import { readFileSync, existsSync } from "fs";
import { join } from "path";

type Category = "office_kalokohan" | "lovelife_edition" | "walang_takas";

interface Question {
  id: string;
  category: Category;
  question: string;
  humor_tags?: string[];
  order?: number;
}

const REQUIRED_TOTAL = 2100;
const REQUIRED_COUNTS: Record<Category, number> = {
  office_kalokohan: 800,
  lovelife_edition: 650,
  walang_takas: 650,
};

const VALID_CATEGORIES = new Set<Category>([
  "office_kalokohan",
  "lovelife_edition",
  "walang_takas",
]);

const COWORKERS = [
  "DANNA", "RABS", "TRINA", "YUUJI", "BAL", "RAF", "SAMMY", "VI", "GREG",
  "KHAOKIE", "RAP", "RHEIN", "SAM", "DEN", "JASMINE", "JOSHUA", "MARK",
  "MITS", "ROX", "ARLYN", "ARRIANE",
];

const PLACEHOLDER_PATTERNS = [
  /lorem ipsum/i,
  /placeholder/i,
  /todo[:\s]/i,
  /fixme/i,
  /xxx+/i,
  /test question/i,
  /sample question/i,
  /question \d+/i,
  /\[insert/i,
  /\{.*\}/,
];

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\sà-ü]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function wordSet(text: string): Set<string> {
  return new Set(normalize(text).split(" ").filter((w) => w.length > 2));
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let inter = 0;
  for (const w of a) if (b.has(w)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

function main() {
  const dataPath = join(process.cwd(), "data", "questions.json");
  if (!existsSync(dataPath)) {
    console.error("❌ data/questions.json not found. Run: npm run generate:questions");
    process.exit(1);
  }

  let questions: Question[];
  try {
    questions = JSON.parse(readFileSync(dataPath, "utf-8"));
  } catch (e) {
    console.error("❌ Failed to parse questions.json:", e);
    process.exit(1);
  }

  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. Total count
  if (questions.length !== REQUIRED_TOTAL) {
    errors.push(`Total questions: ${questions.length} (expected ${REQUIRED_TOTAL})`);
  } else {
    console.log(`✓ Total questions: ${questions.length}`);
  }

  // 2. Category distribution
  const counts: Record<string, number> = {};
  for (const q of questions) {
    counts[q.category] = (counts[q.category] || 0) + 1;
  }
  for (const [cat, required] of Object.entries(REQUIRED_COUNTS)) {
    const actual = counts[cat] || 0;
    if (actual !== required) {
      errors.push(`Category ${cat}: ${actual} (expected ${required})`);
    } else {
      console.log(`✓ ${cat}: ${actual}`);
    }
  }

  // 3. Valid categories
  for (const q of questions) {
    if (!VALID_CATEGORIES.has(q.category)) {
      errors.push(`Invalid category on ${q.id}: ${q.category}`);
    }
  }

  // 4. Unique IDs
  const ids = new Set<string>();
  const dupIds: string[] = [];
  for (const q of questions) {
    if (ids.has(q.id)) dupIds.push(q.id);
    ids.add(q.id);
  }
  if (dupIds.length) {
    errors.push(`Duplicate IDs: ${dupIds.slice(0, 5).join(", ")}${dupIds.length > 5 ? "..." : ""}`);
  } else {
    console.log(`✓ All ${ids.size} IDs unique`);
  }

  // 5. Empty / too short / placeholder
  let emptyCount = 0;
  let placeholderCount = 0;
  for (const q of questions) {
    const text = (q.question || "").trim();
    if (!text || text.length < 15) {
      emptyCount++;
      if (emptyCount <= 3) errors.push(`Empty/short question: ${q.id}`);
    }
    for (const pat of PLACEHOLDER_PATTERNS) {
      if (pat.test(text)) {
        placeholderCount++;
        if (placeholderCount <= 3) errors.push(`Placeholder-like: ${q.id} → ${text.slice(0, 60)}`);
        break;
      }
    }
  }
  if (emptyCount === 0) console.log("✓ No empty or too-short questions");
  else errors.push(`Total empty/short: ${emptyCount}`);
  if (placeholderCount === 0) console.log("✓ No placeholder patterns detected");
  else errors.push(`Total placeholder-like: ${placeholderCount}`);

  // 6. Exact duplicates
  const seenText = new Map<string, string>();
  const exactDups: string[] = [];
  for (const q of questions) {
    const norm = normalize(q.question);
    if (seenText.has(norm)) {
      exactDups.push(`${q.id} ≈ ${seenText.get(norm)}`);
    } else {
      seenText.set(norm, q.id);
    }
  }
  if (exactDups.length) {
    errors.push(`Exact duplicates (${exactDups.length}): ${exactDups.slice(0, 3).join("; ")}`);
  } else {
    console.log("✓ No exact duplicate questions");
  }

  // 7. Highly similar (Jaccard > 0.75 on word sets) – sample to keep runtime reasonable
  const similarPairs: string[] = [];
  const sampleSize = Math.min(questions.length, 1200);
  for (let i = 0; i < sampleSize; i++) {
    const a = wordSet(questions[i].question);
    for (let j = i + 1; j < Math.min(i + 80, sampleSize); j++) {
      const b = wordSet(questions[j].question);
      const sim = jaccard(a, b);
      if (sim >= 0.78) {
        similarPairs.push(`${questions[i].id} ↔ ${questions[j].id} (${(sim * 100).toFixed(0)}%)`);
        if (similarPairs.length >= 15) break;
      }
    }
    if (similarPairs.length >= 15) break;
  }
  if (similarPairs.length) {
    warnings.push(`Highly similar pairs (sample): ${similarPairs.slice(0, 8).join("; ")}`);
  } else {
    console.log("✓ No highly similar pairs found in sample");
  }

  // 8. Coworker names config
  if (COWORKERS.length !== 21) {
    errors.push(`Coworker list length: ${COWORKERS.length} (expected 21)`);
  } else {
    console.log(`✓ 21 coworker names configured`);
  }
  const upper = COWORKERS.every((n) => n === n.toUpperCase());
  if (!upper) errors.push("Some coworker names are not uppercase");
  else console.log("✓ Coworker names are uppercase");

  // Summary
  console.log("\n========== VALIDATION SUMMARY ==========");
  if (errors.length === 0 && warnings.length === 0) {
    console.log("✅ ALL CHECKS PASSED");
    process.exit(0);
  }
  if (errors.length) {
    console.log("\n❌ ERRORS:");
    errors.forEach((e) => console.log("  - " + e));
  }
  if (warnings.length) {
    console.log("\n⚠️  WARNINGS (review recommended):");
    warnings.forEach((w) => console.log("  - " + w));
  }
  process.exit(errors.length ? 1 : 0);
}

main();

/**
 * Optional: copies the bundled question bank into the Supabase `questions` table.
 * The game itself reads data/questions.json, so seeding is only needed if you want the
 * questions queryable in SQL.
 *
 *   npm run seed        (reads .env.local)
 */
import { readFileSync } from "fs";
import { join } from "path";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

interface Q {
  id: string;
  category: string;
  question: string;
  humor_tags?: string[];
  order?: number;
}

async function main() {
  const questions: Q[] = JSON.parse(
    readFileSync(join(process.cwd(), "data", "questions.json"), "utf8"),
  );
  const sb = createClient(url!, key!, { auth: { persistSession: false } });
  const rows = questions.map((q, i) => ({
    id: q.id,
    category: q.category,
    question: q.question,
    humor_tags: q.humor_tags ?? [],
    sort_order: q.order ?? i + 1,
  }));

  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await sb.from("questions").upsert(rows.slice(i, i + 500));
    if (error) throw error;
    console.log(`Seeded ${Math.min(i + 500, rows.length)} / ${rows.length}`);
  }
  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

import { NextResponse } from "next/server";
import { ALL_QUESTIONS } from "@/lib/questions";
import { CATEGORY_IDS } from "@/lib/settings";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 20;

/** Public question library (the questions are not secret, only who voted for whom is). */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const category = url.searchParams.get("category") ?? "";
  const q = (url.searchParams.get("q") ?? "").trim().toLowerCase().slice(0, 60);
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1") || 1);

  let list = ALL_QUESTIONS;
  if ((CATEGORY_IDS as readonly string[]).includes(category)) {
    list = list.filter((x) => x.category === category);
  }
  if (q) list = list.filter((x) => x.question.toLowerCase().includes(q));

  const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  const safePage = Math.min(page, pages);
  const items = list
    .slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)
    .map((x) => ({ id: x.id, category: x.category, text: x.question }));

  return NextResponse.json({ items, total: list.length, page: safePage, pages });
}

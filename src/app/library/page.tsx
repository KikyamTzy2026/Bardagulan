import type { Metadata } from "next";
import { Shell } from "@/components/Shell";
import { QuestionBrowser } from "@/components/QuestionBrowser";

export const metadata: Metadata = { title: "Question Library | OFFICE BARDAGULAN 2100" };

export default function LibraryPage() {
  return (
    <Shell>
      <h1 className="mb-1 text-3xl font-black neon-text">Question Library</h1>
      <p className="mb-6 text-white/60">
        Lahat ng 2,100 tanong, tatlong round. Hanapin ang paborito mo.
      </p>
      <QuestionBrowser />
    </Shell>
  );
}

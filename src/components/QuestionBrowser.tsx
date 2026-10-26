"use client";

import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { apiFetch } from "@/lib/client-api";
import { CATEGORY_IDS, CATEGORY_META, type CategoryId } from "@/lib/settings";
import { cn } from "@/lib/cn";

interface Item {
  id: string;
  category: CategoryId;
  text: string;
}
interface Resp {
  items: Item[];
  total: number;
  page: number;
  pages: number;
}

/** Browse/search the 2,100 questions. With `onPick`, each row gets a "Play" button (host-led mode). */
export function QuestionBrowser({
  onPick,
  busy,
}: {
  onPick?: (id: string) => void;
  busy?: boolean;
}) {
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [category, setCategory] = useState<"" | CategoryId>("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Resp | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(q);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams({ page: String(page) });
    if (category) params.set("category", category);
    if (debounced) params.set("q", debounced);
    apiFetch<Resp>(`/api/questions?${params}`)
      .then((r) => {
        if (!cancelled) {
          setData(r);
          setError(null);
        }
      })
      .catch((e: Error) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [debounced, category, page]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
          <input
            className="input pl-10"
            placeholder="Maghanap ng tanong…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <select
          className="input sm:w-56"
          value={category}
          onChange={(e) => {
            setCategory(e.target.value as "" | CategoryId);
            setPage(1);
          }}
        >
          <option value="" className="bg-panel">Lahat ng round</option>
          {CATEGORY_IDS.map((c) => (
            <option key={c} value={c} className="bg-panel">
              {CATEGORY_META[c].label}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="text-sm text-neon-pink">{error}</p>}

      <ul className="space-y-2">
        {data?.items.map((it) => (
          <li
            key={it.id}
            className="glass flex items-start justify-between gap-3 rounded-xl p-3 text-sm"
          >
            <div>
              <span className="mr-2 text-xs font-semibold text-neon-violet">
                {CATEGORY_META[it.category].emoji} {CATEGORY_META[it.category].label}
              </span>
              <p className="mt-1 text-white/90">{it.text}</p>
            </div>
            {onPick && (
              <button
                className="btn btn-primary shrink-0 px-3 py-1.5 text-xs"
                disabled={busy}
                onClick={() => onPick(it.id)}
              >
                Laruin
              </button>
            )}
          </li>
        ))}
        {data && data.items.length === 0 && (
          <li className="py-6 text-center text-white/50">Walang nahanap.</li>
        )}
      </ul>

      {data && (
        <div className="flex items-center justify-between text-sm text-white/60">
          <span>{data.total.toLocaleString()} tanong</span>
          <div className="flex items-center gap-2">
            <button
              className="btn btn-ghost px-3 py-1.5"
              disabled={data.page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Nakaraan
            </button>
            <span className={cn("tabular-nums")}>
              {data.page} / {data.pages}
            </span>
            <button
              className="btn btn-ghost px-3 py-1.5"
              disabled={data.page >= data.pages}
              onClick={() => setPage((p) => p + 1)}
            >
              Susunod
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

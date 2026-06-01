import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db";
import { charMap } from "../data/dataset";
import type { HanjaCharData } from "../data/types";
import HanjaCard from "../components/HanjaCard";
import PageHeader from "../components/PageHeader";

export default function HanjaDex() {
  const collected = useLiveQuery(() => db.chars.orderBy("count").reverse().toArray(), [], []);
  const [query, setQuery] = useState("");

  const totalChars = charMap.size;
  const countByChar = useMemo(
    () => new Map(collected.map((c) => [c.char, c.count])),
    [collected]
  );
  const ownedSet = useMemo(() => new Set(collected.map((c) => c.char)), [collected]);

  const q = query.trim();
  const searchResults = useMemo<HanjaCharData[]>(() => {
    if (!q) return [];
    const out: HanjaCharData[] = [];
    for (const c of charMap.values()) {
      if (c.char === q || c.jp === q || c.readings.some((r) => r.eum === q || r.hun === q)) {
        out.push(c);
        if (out.length >= 60) break;
      }
    }
    return out;
  }, [q]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="漢字図鑑"
        subtitle={
          <>
            収集 <span className="font-bold text-zinc-200">{collected.length}</span> / {totalChars}{" "}
            字
          </>
        }
      />

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="漢字・音で検索（例: 學 / 학）"
        className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-base outline-none placeholder:text-slate-500 focus:border-white/30"
      />

      {q ? (
        searchResults.length === 0 ? (
          <Empty>該当する漢字がありません。</Empty>
        ) : (
          <CardGrid
            chars={searchResults}
            ownedSet={ownedSet}
            countByChar={countByChar}
          />
        )
      ) : collected.length === 0 ? (
        <Empty>
          まだ漢字を集めていません。
          <br />
          漢字語を追加すると、その構成漢字がカードになります。
        </Empty>
      ) : (
        <CardGrid
          chars={collected
            .map((c) => charMap.get(c.char))
            .filter((c): c is HanjaCharData => c != null)}
          ownedSet={ownedSet}
          countByChar={countByChar}
        />
      )}
    </div>
  );
}

function CardGrid({
  chars,
  ownedSet,
  countByChar,
}: {
  chars: HanjaCharData[];
  ownedSet: Set<string>;
  countByChar: Map<string, number>;
}) {
  return (
    <div className="grid grid-cols-3 gap-2.5">
      {chars.map((c) => (
        <HanjaCard
          key={c.char}
          char={c.char}
          owned={ownedSet.has(c.char)}
          count={countByChar.get(c.char)}
          link
        />
      ))}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-8 text-center text-sm text-slate-500">
      {children}
    </p>
  );
}

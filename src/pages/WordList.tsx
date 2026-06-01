import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, removeWord, type CollectedWord } from "../db";
import { TrashIcon } from "../components/icons";
import HanjaText from "../components/HanjaText";
import { compareKo, leadConsonant, leadOrder } from "../util/korean";
import { splitHanja } from "../data/dataset";
import PageHeader from "../components/PageHeader";

type SortMode = "recent" | "alpha";
type LenFilter = "all" | "2" | "3" | "4+";

export default function WordList() {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortMode>("recent");
  const [len, setLen] = useState<LenFilter>("all");

  const words = useLiveQuery(
    () => db.words.orderBy("addedAt").reverse().toArray(),
    [],
    [] as CollectedWord[]
  );

  const q = query.trim();
  const filtered = useMemo(() => {
    return words.filter((w) => {
      if (q && !(w.hangul.includes(q) || w.hanja.includes(q) || w.gloss.includes(q))) return false;
      if (len !== "all") {
        const n = splitHanja(w.hanja).length;
        if (len === "2" && n !== 2) return false;
        if (len === "3" && n !== 3) return false;
        if (len === "4+" && n < 4) return false;
      }
      return true;
    });
  }, [words, q, len]);

  // 가나다順のときは初声でグルーピング、追加順のときは単一グループ。
  const groups = useMemo(() => {
    if (sort === "recent") {
      return [{ key: "", words: filtered }]; // 既に addedAt 降順
    }
    const map = new Map<string, CollectedWord[]>();
    for (const w of filtered) {
      const k = leadConsonant(w.hangul);
      (map.get(k) ?? map.set(k, []).get(k)!).push(w);
    }
    return [...map.entries()]
      .sort((a, b) => leadOrder(a[0]) - leadOrder(b[0]))
      .map(([key, ws]) => ({ key, words: ws.sort((x, y) => compareKo(x.hangul, y.hangul)) }));
  }, [filtered, sort]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="単語帳"
        subtitle={
          <>
            集めた漢字語：{words.length} 語
            {filtered.length !== words.length && `（表示 ${filtered.length}）`}
          </>
        }
      />

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="検索（ハングル・漢字・意味）"
        className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-base outline-none placeholder:text-slate-500 focus:border-amber-400/60"
      />

      <div className="flex flex-wrap items-center gap-2">
        <Segmented
          value={sort}
          onChange={setSort}
          options={[
            { value: "recent", label: "追加順" },
            { value: "alpha", label: "가나다순" },
          ]}
        />
        <Segmented
          value={len}
          onChange={setLen}
          options={[
            { value: "all", label: "全部" },
            { value: "2", label: "2字" },
            { value: "3", label: "3字" },
            { value: "4+", label: "4字+" },
          ]}
        />
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-8 text-center text-sm text-slate-500">
          {words.length === 0 ? "まだ何も集めていません。" : "該当する語がありません。"}
        </p>
      ) : (
        <div className="space-y-4">
          {groups.map((g) => (
            <section key={g.key || "all"}>
              {g.key && (
                <h2 className="mb-1.5 px-1 font-hanja text-sm font-bold text-zinc-400">
                  {g.key}
                </h2>
              )}
              <ul className="space-y-2">
                {g.words.map((w) => (
                  <li
                    key={w.id}
                    className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <div className="flex items-baseline gap-2">
                        <span className="text-lg font-semibold">{w.hangul}</span>
                        <HanjaText ko={w.hanja} jp={w.hanjaJp} className="text-sm text-slate-300" />
                      </div>
                      {w.gloss && <p className="truncate text-xs text-slate-400">{w.gloss}</p>}
                    </div>
                    <button
                      onClick={() => {
                        if (confirm(`「${w.hangul}」を削除しますか？`)) removeWord(w.id);
                      }}
                      className="ml-3 shrink-0 rounded-lg p-2 text-slate-500 hover:bg-slate-700 hover:text-rose-400"
                      aria-label="削除"
                    >
                      <TrashIcon size={18} />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="flex overflow-hidden rounded-lg border border-white/10">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`px-3 py-1.5 text-xs font-semibold transition-colors ${
            value === o.value
              ? "bg-zinc-100 text-zinc-900"
              : "bg-white/5 text-slate-400 hover:text-slate-200"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

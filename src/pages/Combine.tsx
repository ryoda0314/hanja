import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db";
import { getCharData } from "../data/dataset";
import { checkWordExists, discoverWords } from "../data/combine";
import { CheckIcon } from "../components/icons";
import HanjaText from "../components/HanjaText";
import PageHeader from "../components/PageHeader";
import { compareKo } from "../util/korean";

const DISCOVER_CAP = 40;

export default function Combine() {
  const collectedChars = useLiveQuery(() => db.chars.orderBy("count").reverse().toArray(), [], []);
  const ownedWords = useLiveQuery(() => db.words.toArray(), [], []);

  const [sequence, setSequence] = useState<string[]>([]);
  const [charFilter, setCharFilter] = useState(""); // ビルダーの漢字検索
  const [focusChar, setFocusChar] = useState<string | null>(null); // 発見の絞り込み

  const collectedSet = useMemo(
    () => new Set(collectedChars.map((c) => c.char)),
    [collectedChars]
  );
  const ownedHangul = useMemo(() => new Set(ownedWords.map((w) => w.hangul)), [ownedWords]);

  // 集めた漢字だけで作れる「まだ持っていない」実在語（＝発見対象）。
  const discoveries = useMemo(
    () => discoverWords(collectedSet, ownedHangul, true),
    [collectedSet, ownedHangul]
  );

  // 発見語に登場する漢字ごとの件数（絞り込みチップ用）。多い順。
  const focusCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const d of discoveries) for (const ch of new Set(d.chars)) m.set(ch, (m.get(ch) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [discoveries]);

  // 絞り込み＋並べ替え（短い語＝易しい順）＋上限。
  const shown = useMemo(() => {
    let list = focusChar ? discoveries.filter((d) => d.chars.includes(focusChar)) : discoveries;
    list = [...list].sort(
      (a, b) => a.chars.length - b.chars.length || compareKo(a.hangul, b.hangul)
    );
    return list;
  }, [discoveries, focusChar]);

  const sequenceCheck = sequence.length > 0 ? checkWordExists(sequence) : null;

  const filteredChars = charFilter.trim()
    ? collectedChars.filter(
        (c) => c.char === charFilter.trim() || getCharData(c.char)?.readings.some((r) => r.eum === charFilter.trim())
      )
    : collectedChars;

  if (collectedChars.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="font-hanja text-2xl font-bold text-amber-100">組み合わせ・発見</h1>
        <p className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-8 text-center text-sm text-slate-500">
          まず漢字語を集めましょう。集めた漢字を組み合わせて
          <br />
          新しい漢字語を発見できます。
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="組み合わせ・発見"
        subtitle={
          <>
            集めた漢字から作れる新しい語：
            <span className="font-bold text-amber-300"> {discoveries.length} 個</span>
          </>
        }
      />

      {/* 発見（漢字で絞り込み） */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-300">漢字で絞り込んで発見</h2>

        {focusCounts.length > 0 && (
          <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1">
            <FilterChip active={focusChar === null} onClick={() => setFocusChar(null)} label="すべて" />
            {focusCounts.map(([ch, n]) => (
              <FilterChip
                key={ch}
                active={focusChar === ch}
                onClick={() => setFocusChar(focusChar === ch ? null : ch)}
                label={`${ch} ${n}`}
              />
            ))}
          </div>
        )}

        {shown.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-8 text-center text-sm text-slate-500">
            新しく作れる語はありません。漢字語をもっと集めましょう。
          </p>
        ) : (
          <>
            <ul className="space-y-2">
              {shown.slice(0, DISCOVER_CAP).map((d) => {
                const readings = d.chars
                  .map((c) => getCharData(c)?.readings[0]?.eum ?? "?")
                  .join("");
                return (
                  <li
                    key={d.hangul + d.hanja}
                    className="flex items-center justify-between rounded-xl border border-amber-400/25 bg-amber-400/[0.06] px-4 py-3"
                  >
                    <div className="min-w-0">
                      <div className="flex items-baseline gap-2">
                        <span className="text-lg font-semibold">{d.hangul}</span>
                        <HanjaText ko={d.hanja} jp={d.hanjaJp} className="text-sm text-slate-300" />
                      </div>
                      <p className="truncate text-xs text-slate-500">
                        {readings} · {d.gloss}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-bold text-slate-900">
                      NEW
                    </span>
                  </li>
                );
              })}
            </ul>
            {shown.length > DISCOVER_CAP && (
              <p className="text-center text-xs text-slate-500">
                ほか {shown.length - DISCOVER_CAP} 件。漢字チップで絞り込めます。
              </p>
            )}
          </>
        )}
      </section>

      {/* 自由組み合わせチェッカー */}
      <section className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4">
        <h2 className="text-sm font-semibold text-slate-300">自由組み合わせ（漢字をタップ）</h2>

        {collectedChars.length > 16 && (
          <input
            value={charFilter}
            onChange={(e) => setCharFilter(e.target.value)}
            placeholder="漢字を絞り込む（漢字・音）"
            className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm outline-none placeholder:text-slate-500 focus:border-amber-400/60"
          />
        )}

        <div className="no-scrollbar flex max-h-36 flex-wrap gap-1.5 overflow-y-auto">
          {filteredChars.map((c) => (
            <button
              key={c.char}
              onClick={() => setSequence((seq) => [...seq, c.char])}
              className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 font-hanja text-lg active:scale-95 hover:border-amber-400/40"
            >
              {c.char}
            </button>
          ))}
        </div>

        <div className="flex min-h-[3rem] items-center justify-between rounded-xl border border-white/10 bg-black/20 px-4 py-2">
          <span className="font-hanja text-2xl">
            {sequence.length > 0 ? (
              sequence.join("")
            ) : (
              <span className="text-base text-slate-600">ここに組み合わせが表示されます</span>
            )}
          </span>
          {sequence.length > 0 && (
            <button
              onClick={() => setSequence([])}
              className="text-xs text-slate-400 hover:text-rose-400"
            >
              クリア
            </button>
          )}
        </div>

        {sequence.length > 0 &&
          (sequenceCheck ? (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-700 bg-emerald-900/30 px-4 py-3 text-sm text-emerald-200">
              <CheckIcon size={18} className="shrink-0" />
              <span>
                実在する漢字語です：
                <span className="ml-1 font-bold">{sequenceCheck.hangul}</span>
                <span className="ml-2 text-emerald-300/80">{sequenceCheck.gloss}</span>
              </span>
            </div>
          ) : (
            <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-slate-400">
              この組み合わせの実在語は見つかりませんでした。
            </div>
          ))}
      </section>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 rounded-full border px-3 py-1 font-hanja text-sm transition-colors ${
        active
          ? "border-zinc-100 bg-zinc-100 text-zinc-900"
          : "border-white/10 bg-white/5 text-slate-300"
      }`}
    >
      {label}
    </button>
  );
}

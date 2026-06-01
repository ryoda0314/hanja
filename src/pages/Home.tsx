import { Link } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db";
import { discoverWords } from "../data/combine";
import { PlusIcon } from "../components/icons";
import HanjaText from "../components/HanjaText";
import PageHeader from "../components/PageHeader";

export default function Home() {
  const wordCount = useLiveQuery(() => db.words.count(), [], -1);
  const charCount = useLiveQuery(() => db.chars.count(), [], -1);
  const collectedChars = useLiveQuery(() => db.chars.toArray(), [], []);
  const allWords = useLiveQuery(() => db.words.toArray(), [], []);
  const recent = useLiveQuery(
    () => db.words.orderBy("addedAt").reverse().limit(5).toArray(),
    [],
    []
  );

  const collectedSet = new Set(collectedChars.map((c) => c.char));
  const ownedHangul = new Set(allWords.map((w) => w.hangul));
  const newDiscoverable =
    collectedSet.size > 0 ? discoverWords(collectedSet, ownedHangul, true).length : 0;

  return (
    <div className="space-y-6">
      <PageHeader title="한자 도감" subtitle="韓国語の漢字語をあつめよう" />

      <div className="grid grid-cols-2 gap-3">
        <Stat label="集めた漢字語" value={wordCount < 0 ? "…" : `${wordCount}`} unit="語" />
        <Stat label="集めた漢字" value={charCount < 0 ? "…" : `${charCount}`} unit="字" />
      </div>

      <Link
        to="/combine"
        className="relative block overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-4 active:scale-[0.99]"
      >
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-zinc-300">いま作れる新しい漢字語</span>
          <span className="text-xs text-zinc-500">組み合わせへ →</span>
        </div>
        <p className="mt-1">
          <span className="font-hanja text-4xl font-bold text-amber-300">{newDiscoverable}</span>
          <span className="ml-2 text-sm text-zinc-500">語が発見できます</span>
        </p>
      </Link>

      <Link
        to="/add"
        className="flex items-center justify-center gap-2 rounded-2xl bg-zinc-100 py-4 text-base font-bold text-zinc-900 active:scale-[0.98]"
      >
        <PlusIcon size={20} />
        漢字語を追加する
      </Link>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-slate-300">最近あつめた語</h2>
        {recent.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-8 text-center text-sm text-slate-500">
            まだ何も集めていません。
            <br />
            勉強した漢字語を追加してみましょう。
          </p>
        ) : (
          <ul className="space-y-2">
            {recent.map((w) => (
              <li
                key={w.id}
                className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-2.5"
              >
                <div>
                  <span className="text-base font-semibold">{w.hangul}</span>
                  <HanjaText ko={w.hanja} jp={w.hanjaJp} className="ml-2 text-sm text-slate-400" />
                </div>
                <span className="text-xs text-slate-400">{w.gloss}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="text-xs text-zinc-500">{label}</div>
      <div className="mt-1">
        <span className="font-hanja text-3xl font-bold text-zinc-50">{value}</span>
        <span className="ml-1 text-sm text-zinc-500">{unit}</span>
      </div>
    </div>
  );
}

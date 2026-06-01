import { Link, useParams } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db";
import { charToWords, getCharData, splitHanja } from "../data/dataset";
import HanjaText from "../components/HanjaText";
import HanjaCard from "../components/HanjaCard";
import { rarityByStrokes } from "../util/rarity";
import { StarIcon } from "../components/icons";
import ScriptToggle from "../components/ScriptToggle";

export default function HanjaDetail() {
  const params = useParams();
  const char = decodeURIComponent(params.char ?? "");
  const data = getCharData(char);

  const collectedChars = useLiveQuery(() => db.chars.toArray(), [], []);
  const ownedWords = useLiveQuery(
    () => db.words.where("chars").equals(char).toArray(),
    [char],
    []
  );

  if (!data) {
    return (
      <div className="space-y-4">
        <Link to="/dex" className="text-sm text-zinc-400">
          ← 図鑑へ戻る
        </Link>
        <p className="text-slate-400">この漢字のデータがありません：{char}</p>
      </div>
    );
  }

  const collectedSet = new Set(collectedChars.map((c) => c.char));
  const owned = collectedSet.has(char);
  const stat = collectedChars.find((c) => c.char === char);
  const ownedHangul = new Set(ownedWords.map((w) => w.hangul));
  const rarity = rarityByStrokes(data.strokes);

  const candidates = charToWords.get(char) ?? [];
  const DISCOVER_LIMIT = 40;
  const discoverAll = candidates
    .filter((w) => !ownedHangul.has(w.hangul))
    .map((w) => ({
      word: w,
      formable: splitHanja(w.hanja).every((c) => collectedSet.has(c)),
    }))
    .sort(
      (a, b) =>
        Number(b.formable) - Number(a.formable) || a.word.hangul.localeCompare(b.word.hangul)
    );
  const discover = discoverAll.slice(0, DISCOVER_LIMIT);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link to="/dex" className="text-sm text-zinc-400 hover:text-zinc-200">
          ← 図鑑へ戻る
        </Link>
        <ScriptToggle />
      </div>

      {/* ヒーローカード */}
      <div className="flex items-center gap-5">
        <div className="w-32 shrink-0">
          <HanjaCard char={char} owned={owned} count={stat?.count} size="lg" />
        </div>
        <div className="space-y-2">
          <div className={`flex items-center gap-1 ${rarity.accentClass}`}>
            {Array.from({ length: rarity.stars }).map((_, i) => (
              <StarIcon key={i} size={14} />
            ))}
            <span className="ml-1 text-xs font-semibold">{rarity.label}</span>
          </div>
          {data.readings.map((r, i) => (
            <div key={i} className="text-emerald-300">
              {r.hun && <span className="text-lg font-semibold">{r.hun}</span>}
              <span className="ml-2 text-lg">{r.eum}</span>
            </div>
          ))}
          {data.meaning && <p className="text-sm text-slate-400">{data.meaning}</p>}
          <p className="text-xs text-slate-500">
            {data.strokes ? `${data.strokes} 画` : "画数不明"}
            {data.jp && data.jp !== char && (
              <span className="ml-2 text-sky-300">日本字: {data.jp}</span>
            )}
            {" · "}
            {owned ? (
              <span className="text-amber-300">収集済み（{stat?.count ?? 0} 語）</span>
            ) : (
              <span className="text-slate-500">未収集</span>
            )}
          </p>
        </div>
      </div>

      <Section title="集めた語の中で使われている">
        {ownedWords.length === 0 ? (
          <Empty>この漢字を含む語はまだ集めていません。</Empty>
        ) : (
          <WordRows
            rows={ownedWords.map((w) => ({
              hangul: w.hangul,
              hanja: w.hanja,
              hanjaJp: w.hanjaJp,
              gloss: w.gloss,
            }))}
          />
        )}
      </Section>

      <Section
        title={
          discoverAll.length > DISCOVER_LIMIT
            ? `この漢字を含む・発見できる語（上位${DISCOVER_LIMIT}件／全${discoverAll.length}件）`
            : "この漢字を含む・発見できる語"
        }
      >
        {discover.length === 0 ? (
          <Empty>発見できる語はありません。</Empty>
        ) : (
          <ul className="space-y-2">
            {discover.map(({ word, formable }) => (
              <li
                key={word.hangul + word.hanja}
                className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-2.5"
              >
                <div>
                  <span className="font-semibold">{word.hangul}</span>
                  <HanjaText
                    ko={word.hanja}
                    jp={word.hanjaJp}
                    className="ml-2 text-sm text-slate-400"
                  />
                  <span className="ml-2 text-xs text-slate-500">{word.gloss}</span>
                </div>
                {formable ? (
                  <span className="shrink-0 rounded-full bg-amber-400/20 px-2 py-0.5 text-[10px] text-amber-300">
                    今すぐ作れる
                  </span>
                ) : (
                  <span className="shrink-0 text-[10px] text-slate-600">未収集の字あり</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold text-slate-300">{title}</h2>
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] p-4 text-center text-sm text-slate-500">
      {children}
    </p>
  );
}

function WordRows({
  rows,
}: {
  rows: { hangul: string; hanja: string; hanjaJp?: string; gloss: string }[];
}) {
  return (
    <ul className="space-y-2">
      {rows.map((w) => (
        <li
          key={w.hangul + w.hanja}
          className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5"
        >
          <span className="font-semibold">{w.hangul}</span>
          <HanjaText ko={w.hanja} jp={w.hanjaJp} className="ml-2 text-sm text-slate-400" />
          <span className="ml-2 text-xs text-slate-500">{w.gloss}</span>
        </li>
      ))}
    </ul>
  );
}

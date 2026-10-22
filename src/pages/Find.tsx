import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { discoverWords, nearWords, unlockedBy, unlockers, wordKey } from "../data/combine";
import { getCharData } from "../data/dataset";
import type { WordData } from "../data/types";
import { t } from "../copy";
import { useChars, useSentences, useWords } from "../util/live";
import { Icon } from "../components/Icon";
import { WordRow } from "../components/WordRow";
import { WordSheet } from "../components/WordSheet";
import app from "../app.module.css";
import styles from "./Find.module.css";
import { Meet } from "./Meet";
import { TryRead } from "./TryRead";

type View = "meet" | "read" | "readable" | "near";
const VIEWS: View[] = ["meet", "read", "readable", "near"];
type Word = Pick<WordData, "hangul" | "hanja" | "gloss">;

const PAGE = 40;

/**
 * 見つける：文の中で出会う（ことのあめ の例文の雨）、集めた字だけでできた語を読んでみる、読める語の一覧、
 * あと1字で読める語。読みたい語は開いて、自分で打ってあつめる。
 */
export default function Find() {
  const [params, setParams] = useSearchParams();
  const view: View = VIEWS.find((v) => v === params.get("view")) ?? "meet";
  const words = useWords();
  const chars = useChars();
  const sentences = useSentences();
  const [sheet, setSheet] = useState<Word | null>(null);

  const ownedKeys = useMemo(() => new Set((words ?? []).map(wordKey)), [words]);
  const collected = useMemo(() => new Set((chars ?? []).map((c) => c.char)), [chars]);
  const readable = useMemo(() => discoverWords(collected, ownedKeys, true), [collected, ownedKeys]);
  const near = useMemo(() => nearWords(collected, ownedKeys), [collected, ownedKeys]);

  function show(next: View) {
    setParams(next === "meet" ? {} : { view: next }, { replace: true });
  }

  return (
    <>
      <header className={app.subbar}>
        <h1 className={app.subtitleStrong}>{t.find.title}</h1>
      </header>
      <div className={app.bodyTight}>
        {chars === undefined || words === undefined ? null : (
          <>
            <nav className={app.views} aria-label={t.find.viewsLabel}>
              {VIEWS.map((v) => (
                <button key={v} type="button" className={app.view} aria-pressed={view === v} onClick={() => show(v)}>
                  {t.find.views[v]}
                </button>
              ))}
            </nav>
            {view === "meet" ? (
              sentences === undefined ? (
                <p className={app.note}>{t.meet.loading}</p>
              ) : sentences === null ? (
                <p className={app.error}>{t.meet.failed}</p>
              ) : (
                <Meet data={sentences} collected={collected} owned={ownedKeys} onOpen={setSheet} />
              )
            ) : null}
            {view === "read" ? <TryRead pool={readable} onNear={() => show("near")} /> : null}
            {view === "readable" ? <Readable words={readable} onOpen={setSheet} /> : null}
            {view === "near" ? (
              <Near near={near} gain={(w) => unlockedBy(w, collected, ownedKeys).length} onOpen={setSheet} />
            ) : null}
          </>
        )}
      </div>
      {sheet ? <WordSheet key={wordKey(sheet)} word={sheet} onClose={() => setSheet(null)} /> : null}
    </>
  );
}

/** 集めた字だけで読める語。字で絞り込める。 */
function Readable({ words, onOpen }: { words: (WordData & { chars: string[] })[]; onOpen: (w: Word) => void }) {
  const [focus, setFocus] = useState<string | null>(null);
  const [limit, setLimit] = useState(PAGE);
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const w of words) for (const c of new Set(w.chars)) m.set(c, (m.get(c) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [words]);
  const shown = focus ? words.filter((w) => w.chars.includes(focus)) : words;

  if (words.length === 0) return <p className={app.lead}>{t.find.none}</p>;
  return (
    <section className={app.stackSm}>
      <p className={app.lead}>{t.find.lead}</p>
      <div className={app.filters} role="group" aria-label={t.find.filterLabel}>
        <Chip on={focus === null} onClick={() => setFocus(null)} label={t.find.all} count={words.length} />
        {counts.map(([c, n]) => (
          <Chip key={c} on={focus === c} onClick={() => setFocus(focus === c ? null : c)} label={c} count={n} hanja />
        ))}
      </div>
      <ul className={app.plainList}>
        {shown.slice(0, limit).map((w) => (
          <WordRow key={wordKey(w)} word={w} onOpen={() => onOpen(w)} />
        ))}
      </ul>
      {shown.length > limit ? (
        <button type="button" className={app.more} onClick={() => setLimit((n) => n + PAGE)}>
          {t.common.more}（{shown.length - limit}）
        </button>
      ) : null}
    </section>
  );
}

/** あと1字で読める語。次に出会うと読める語が増える字から絞り込める。 */
function Near({
  near,
  gain,
  onOpen,
}: {
  near: ReturnType<typeof nearWords>;
  /** その語をあつめると新しく読めるようになる語の数。 */
  gain: (w: Word) => number;
  onOpen: (w: Word) => void;
}) {
  const [focus, setFocus] = useState<string | null>(null);
  const [limit, setLimit] = useState(PAGE);
  const keys = useMemo(() => unlockers(near).slice(0, 24), [near]);
  const shown = focus ? near.filter((n) => n.missing === focus) : near;

  if (near.length === 0) return <p className={app.lead}>{t.find.nearNone}</p>;
  return (
    <section className={app.stackSm}>
      <p className={app.lead}>{t.find.nearLead}</p>
      <h2 className={`label ${styles.unlockLabel}`}>{t.find.unlockLabel}</h2>
      <div className={app.filters} role="group" aria-label={t.find.unlockLabel}>
        <Chip on={focus === null} onClick={() => setFocus(null)} label={t.find.all} count={near.length} />
        {keys.map((k) => (
          <Chip
            key={k.char}
            on={focus === k.char}
            onClick={() => setFocus(focus === k.char ? null : k.char)}
            label={k.char}
            count={t.find.unlockCount(k.count)}
            hanja
          />
        ))}
      </div>
      {focus ? (
        <Link to={`/hanja/${encodeURIComponent(focus)}`} className={app.quietAction}>
          <span className="hanja">{focus}</span>
          <span className="t-ko">{getCharData(focus)?.readings[0]?.eum}</span>
          <Icon name="arrow" size={16} />
        </Link>
      ) : null}
      <ul className={app.plainList}>
        {shown.slice(0, limit).map((n) => {
          const more = gain(n.word);
          return (
            <WordRow
              key={wordKey(n.word)}
              word={n.word}
              missing={n.missing}
              meta={
                <>
                  {t.find.missingNote(n.missing)}
                  {more > 0 ? <span className={styles.gain}>・{t.gain.row(more)}</span> : null}
                </>
              }
              onOpen={() => onOpen(n.word)}
            />
          );
        })}
      </ul>
      {shown.length > limit ? (
        <button type="button" className={app.more} onClick={() => setLimit((n) => n + PAGE)}>
          {t.common.more}（{shown.length - limit}）
        </button>
      ) : null}
    </section>
  );
}

function Chip({
  on,
  onClick,
  label,
  count,
  hanja = false,
}: {
  on: boolean;
  onClick: () => void;
  label: string;
  count: number | string;
  hanja?: boolean;
}) {
  return (
    <button type="button" className={on ? `${app.filter} ${app.filterOn}` : app.filter} aria-pressed={on} onClick={onClick}>
      <span className={hanja ? app.filterHanja : undefined}>{label}</span>
      <span className={app.filterCount}>{count}</span>
    </button>
  );
}

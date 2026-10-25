import { useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { discoverWords, nearWords, unlockedBy, unlockers, wordKey } from "../data/combine";
import { getCharData, glyphOf } from "../data/dataset";
import { learnerLevel } from "../data/sentences";
import { dueWords } from "../data/stage";
import type { WordData } from "../data/types";
import { t } from "../copy";
import { usePrefs } from "../prefs";
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
/** 戻るボタンで、直に開いたときに戻る先。 */
const PARENT: Record<View, View> = { meet: "meet", readable: "meet", near: "meet", read: "readable" };
type Word = Pick<WordData, "hangul" | "hanja" | "gloss">;

const PAGE = 40;

/**
 * 見つける：開くと、文の中で出会う（ことのあめ の例文の雨）。雨のあとに、ほかの見つけ方として
 * 集めた字だけで読める語（そこから読んでみる）と、あと1字で読める語。どちらも戻るボタンの付いた画面で開く。
 * 読みたい語は開いて、自分で打ってあつめる。
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
  const level = useMemo(() => learnerLevel(ownedKeys), [ownedKeys]);
  const due = useMemo(() => new Set(dueWords(words ?? [], Date.now()).map(wordKey)), [words]);

  const navigate = useNavigate();
  const location = useLocation();

  function open(next: View) {
    setParams(next === "meet" ? {} : { view: next });
    window.scrollTo({ top: 0 });
  }

  function back() {
    // 雨や一覧から来たなら戻る。直に開いたときは一つ上の画面に置き換える。
    if (location.key !== "default") navigate(-1);
    else setParams(PARENT[view] === "meet" ? {} : { view: PARENT[view] }, { replace: true });
  }

  const loaded = chars !== undefined && words !== undefined;
  const count = view === "readable" ? readable.length : view === "near" ? near.length : null;

  return (
    <>
      <header className={app.subbar}>
        {view === "meet" ? (
          <h1 className={app.subtitleStrong}>{t.find.title}</h1>
        ) : (
          <>
            <button type="button" className={app.iconLink} onClick={back} aria-label={t.common.back}>
              <Icon name="back" size={22} />
            </button>
            <h1 className={`${app.subtitleStrong} ${app.withBack}`}>{t.find.views[view]}</h1>
            {loaded && count !== null ? <span className={app.subCount}>{t.common.words(count)}</span> : null}
          </>
        )}
      </header>
      <div className={app.bodyTight}>
        {!loaded ? null : (
          <>
            {view === "meet" ? (
              <>
                {sentences === undefined ? (
                  <p className={app.note}>{t.meet.loading}</p>
                ) : sentences === null ? (
                  <p className={app.error}>{t.meet.failed}</p>
                ) : (
                  <Meet data={sentences} collected={collected} owned={ownedKeys} due={due} onOpen={setSheet} />
                )}
                {collected.size > 0 ? <Paths readable={readable.length} near={near.length} onOpen={open} /> : null}
                {sentences ? <p className={app.note}>{t.meet.source}</p> : null}
              </>
            ) : null}
            {view === "read" ? <TryRead pool={readable} level={level} onNear={() => open("near")} /> : null}
            {view === "readable" ? <Readable words={readable} onRead={() => open("read")} onOpen={setSheet} /> : null}
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

/** 雨のあとの、ほかの見つけ方（語の数つき）。 */
function Paths({ readable, near, onOpen }: { readable: number; near: number; onOpen: (v: View) => void }) {
  const rows = [
    { view: "readable" as const, count: readable, note: t.find.pathReadable },
    { view: "near" as const, count: near, note: t.find.pathNear },
  ];
  return (
    <section className={styles.paths} aria-labelledby="paths-title">
      <h2 id="paths-title" className={`label ${styles.pathsTitle}`}>
        {t.find.paths}
      </h2>
      <ul className={app.plainList}>
        {rows.map((r) => (
          <li key={r.view}>
            <button type="button" className={styles.path} onClick={() => onOpen(r.view)}>
              <span className={styles.pathText}>
                <span className={styles.pathTitle}>
                  {t.find.views[r.view]}
                  <span className={styles.pathCount}>{t.common.words(r.count)}</span>
                </span>
                <span className={styles.pathNote}>{r.note}</span>
              </span>
              <span className={styles.chev}>
                <Icon name="back" size={18} />
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** 集めた字だけで読める語。上から 読んでみる へ。字で絞り込める。 */
function Readable({
  words,
  onRead,
  onOpen,
}: {
  words: (WordData & { chars: string[] })[];
  onRead: () => void;
  onOpen: (w: Word) => void;
}) {
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
      <div className={`${app.panel} ${styles.readPanel}`}>
        <p className={app.note}>{t.find.readPanel}</p>
        <button type="button" className={`btn ${styles.readStart}`} onClick={onRead}>
          {t.find.views.read}
          <Icon name="arrow" size={18} />
        </button>
      </div>
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
  const { script } = usePrefs();
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
            label={glyphOf(k.char, script)}
            count={t.find.unlockCount(k.count)}
            hanja
          />
        ))}
      </div>
      {focus ? (
        <Link to={`/hanja/${encodeURIComponent(focus)}`} className={app.quietAction}>
          <span className="hanja">{glyphOf(focus, script)}</span>
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

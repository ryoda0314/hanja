import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { discoverWords, findWordsByHanja, nearWords, unlockedBy, unlockers, wordKey } from "../data/combine";
import { getCharData } from "../data/dataset";
import type { WordData } from "../data/types";
import { t } from "../copy";
import { useChars, useWords } from "../util/live";
import { Icon } from "../components/Icon";
import { WordRow } from "../components/WordRow";
import { WordSheet } from "../components/WordSheet";
import app from "../app.module.css";
import styles from "./Find.module.css";
import { TryRead } from "./TryRead";

type View = "read" | "readable" | "near" | "build";
const VIEWS: View[] = ["read", "readable", "near", "build"];
type Word = Pick<WordData, "hangul" | "hanja" | "gloss">;

const PAGE = 40;

/**
 * 見つける：集めた字だけでできた語を読んでみる、読める語の一覧、あと1字で読める語、字を並べて組み立てる。
 * 読みたい語は開いて、自分で打ってあつめる。
 */
export default function Find() {
  const [params, setParams] = useSearchParams();
  const view: View = VIEWS.find((v) => v === params.get("view")) ?? "read";
  const words = useWords();
  const unsorted = useChars();
  // 組み立てる の札は、よく出会う字から。
  const chars = useMemo(() => unsorted && [...unsorted].sort((a, b) => b.count - a.count), [unsorted]);
  const [sheet, setSheet] = useState<Word | null>(null);

  const ownedKeys = useMemo(() => new Set((words ?? []).map(wordKey)), [words]);
  const collected = useMemo(() => new Set((chars ?? []).map((c) => c.char)), [chars]);
  const readable = useMemo(() => discoverWords(collected, ownedKeys, true), [collected, ownedKeys]);
  const near = useMemo(() => nearWords(collected, ownedKeys), [collected, ownedKeys]);

  function show(next: View) {
    setParams(next === "read" ? {} : { view: next }, { replace: true });
  }

  return (
    <>
      <header className={app.subbar}>
        <h1 className={app.subtitleStrong}>{t.find.title}</h1>
      </header>
      <div className={app.bodyTight}>
        {chars === undefined || words === undefined ? null : chars.length === 0 ? (
          <div className={app.stack}>
            <p className={app.lead}>{t.find.empty}</p>
            <Link to="/" className={app.quietAction}>
              <Icon name="collect" size={18} />
              {t.nav.collect}
            </Link>
          </div>
        ) : (
          <>
            <nav className={app.views} aria-label={t.find.viewsLabel}>
              {VIEWS.map((v) => (
                <button key={v} type="button" className={app.view} aria-pressed={view === v} onClick={() => show(v)}>
                  {t.find.views[v]}
                </button>
              ))}
            </nav>
            {view === "read" ? <TryRead pool={readable} onNear={() => show("near")} /> : null}
            {view === "readable" ? <Readable words={readable} onOpen={setSheet} /> : null}
            {view === "near" ? (
              <Near near={near} gain={(w) => unlockedBy(w, collected, ownedKeys).length} onOpen={setSheet} />
            ) : null}
            {view === "build" ? <Build chars={(chars ?? []).map((c) => c.char)} ownedKeys={ownedKeys} onOpen={setSheet} /> : null}
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

/** 集めた字を押して並べ、その並びの語が辞書にあるかを見る。 */
function Build({ chars, ownedKeys, onOpen }: { chars: string[]; ownedKeys: Set<string>; onOpen: (w: Word) => void }) {
  const [sequence, setSequence] = useState<string[]>([]);
  const [filter, setFilter] = useState("");
  const q = filter.trim();
  const tray = q
    ? chars.filter((c) => {
        const d = getCharData(c);
        return c === q || d?.jp === q || d?.readings.some((r) => r.eum === q || r.hun === q) || d?.on?.includes(q);
      })
    : chars;
  const found = findWordsByHanja(sequence);

  return (
    <section className={app.stack}>
      <p className={app.lead}>{t.find.buildLead}</p>
      <div className={styles.board}>
        <div className={styles.sequence} aria-live="polite">
          {sequence.length ? (
            <span className={`hanja ${styles.sequenceText}`}>{sequence.join("")}</span>
          ) : (
            <span className={styles.sequenceEmpty}>{t.find.buildEmpty}</span>
          )}
        </div>
        <div className={styles.boardActions}>
          <button type="button" className={styles.small} disabled={!sequence.length} onClick={() => setSequence((s) => s.slice(0, -1))}>
            {t.find.undo}
          </button>
          <button type="button" className={styles.small} disabled={!sequence.length} onClick={() => setSequence([])}>
            {t.find.clear}
          </button>
        </div>
      </div>

      {sequence.length > 0 ? (
        found.length ? (
          <div className={app.stackSm}>
            <p className={styles.found}>{t.find.buildFound}</p>
            <ul className={app.plainList}>
              {found.map((w) => (
                <WordRow
                  key={wordKey(w)}
                  word={w}
                  meta={ownedKeys.has(wordKey(w)) ? t.sheet.owned : undefined}
                  onOpen={() => onOpen(w)}
                />
              ))}
            </ul>
          </div>
        ) : (
          <p className={app.note}>{t.find.buildNone}</p>
        )
      ) : null}

      {chars.length > 16 ? (
        <input
          type="search"
          className={app.search}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder={t.find.buildFilter}
          aria-label={t.find.buildFilter}
        />
      ) : null}
      <ul className={styles.tray}>
        {tray.map((c) => (
          <li key={c}>
            <button type="button" className={styles.trayChar} onClick={() => setSequence((s) => [...s, c].slice(0, 8))}>
              <span className="hanja">{c}</span>
              <span className={`${styles.trayRead} t-ko`}>{getCharData(c)?.readings[0]?.eum}</span>
            </button>
          </li>
        ))}
      </ul>
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

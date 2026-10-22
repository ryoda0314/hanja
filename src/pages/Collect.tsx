import { useMemo, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { discoverWords, unlockedBy, wordKey } from "../data/combine";
import { splitHanja } from "../data/dataset";
import { guessHanja, isHanjaInput, resolveByHanja, resolveLocalAll, resolveManual } from "../data/resolver";
import type { ResolvedWord, WordData } from "../data/types";
import { t } from "../copy";
import { addWord, db, type CollectedWord } from "../db";
import { useChars, useWords } from "../util/live";
import { Gain } from "../components/Gain";
import HanjaText from "../components/HanjaText";
import { Icon } from "../components/Icon";
import { PairLink } from "../components/Layout";
import { Logo } from "../components/Logo";
import { NearNext } from "../components/NearNext";
import { Roots, rootNotes } from "../components/Roots";
import { SpeakButton } from "../components/SpeakButton";
import { Sprout } from "../components/Sprout";
import { glossLang, WordRow } from "../components/WordRow";
import { WordSheet } from "../components/WordSheet";
import app from "../app.module.css";
import styles from "./Collect.module.css";

type Status =
  | { kind: "idle" }
  | { kind: "candidates"; byHanja: boolean; words: ResolvedWord[] }
  | { kind: "resolved"; word: ResolvedWord }
  | { kind: "notfound"; query: string }
  // unlocked：この語をあつめて新しく読めるようになった語（あつめる前の手持ちで数えておく）。
  | { kind: "collected"; word: ResolvedWord; before: number[]; unlocked: WordData[] };

const OPENED_LIMIT = 6;

/**
 * あつめる：覚えた漢字語を自分の指で打つと、漢字の根に分かれ、前に集めた語とつながる。
 * あつめた直後に、その字で新しく読めるようになった語が見える。ホームと追加を一つにした画面。
 */
export default function Collect() {
  const words = useWords();
  const chars = useChars();
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [sheet, setSheet] = useState<Pick<WordData, "hangul" | "hanja" | "gloss"> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const ownedKeys = useMemo(() => new Set((words ?? []).map(wordKey)), [words]);
  const collected = useMemo(() => new Set((chars ?? []).map((c) => c.char)), [chars]);
  // よく出会う字から（辞書に無い語の漢字を組み立てるときの候補の順）。
  const roots = useMemo(() => [...(chars ?? [])].sort((a, b) => b.count - a.count).map((c) => c.char), [chars]);
  const readable = useMemo(
    () => (collected.size ? discoverWords(collected, ownedKeys, true) : []),
    [collected, ownedKeys]
  );

  function resolve(e: FormEvent) {
    e.preventDefault();
    const q = input.trim().replace(/\s+/g, "");
    if (!q) return;
    const byHanja = isHanjaInput(q);
    const found = byHanja ? resolveByHanja(q) : resolveLocalAll(q);
    if (found.length === 1) setStatus({ kind: "resolved", word: found[0] });
    else if (found.length > 1) setStatus({ kind: "candidates", byHanja, words: found });
    else setStatus({ kind: "notfound", query: q });
  }

  async function collect(word: ResolvedWord) {
    const before = await Promise.all(word.chars.map((c) => db.chars.get(c).then((x) => x?.count ?? 0)));
    const unlocked = unlockedBy(word, collected, ownedKeys);
    if (!(await addWord(word))) {
      // もう持っている語（手で打った語が辞書の語と同じだったときなど）：そう言う画面へ。
      setStatus({ kind: "resolved", word });
      return;
    }
    setStatus({ kind: "collected", word, before, unlocked });
    setInput("");
  }

  function next() {
    setStatus({ kind: "idle" });
    setInput("");
    inputRef.current?.focus();
  }

  const findOwned = (w: Pick<WordData, "hangul" | "hanja">) =>
    words?.find((o) => wordKey(o) === wordKey(w)) ?? null;
  const hasWords = (words?.length ?? 0) > 0;

  return (
    <>
      <header className={`${app.topbar} ${app.mobileOnly}`}>
        <Logo size="sm" />
        <PairLink />
      </header>
      <div className={`${app.body} ${app.split}`}>
        <h1 className="sr-only">{t.collect.title}</h1>
        <div className={`${app.col} ${app.stick}`}>
          <div className={styles.intro}>
            <h2 className={styles.introTitle}>{t.collect.introTitle}</h2>
            {(words?.length ?? 0) < 3 ? <p className={app.lead}>{t.collect.lead}</p> : null}
          </div>

          <form className={styles.form} onSubmit={resolve}>
            <label htmlFor="collect-input" className="label">
              {t.collect.label}
            </label>
            <div className={styles.inputRow}>
              <input
                id="collect-input"
                ref={inputRef}
                className={`${styles.input} t-ko`}
                lang="ko"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={t.collect.placeholder}
                autoComplete="off"
                autoCapitalize="off"
                spellCheck={false}
                enterKeyHint="search"
              />
              <button type="submit" className="btn" disabled={!input.trim()}>
                {t.collect.submit}
              </button>
            </div>
            <p className={app.note}>{t.collect.hint}</p>
          </form>
        </div>

        <div className={app.col}>
          {status.kind === "candidates" ? (
            <section className={styles.block} aria-live="polite">
              <p className={styles.ask}>
                {status.byHanja ? t.collect.candidatesByHanja(status.words.length) : t.collect.candidates(status.words.length)}
              </p>
              <ul className={app.plainList}>
                {status.words.map((w) => (
                  <WordRow
                    key={wordKey(w)}
                    word={w}
                    meta={findOwned(w) ? t.collect.already(findOwned(w)!.addedAt) : undefined}
                    onOpen={() => setStatus({ kind: "resolved", word: w })}
                  />
                ))}
              </ul>
            </section>
          ) : null}

          {status.kind === "resolved" ? (
            <Found
              word={status.word}
              owned={findOwned(status.word)}
              gain={unlockedBy(status.word, collected, ownedKeys).length}
              fresh={new Set(status.word.chars.filter((c) => !collected.has(c))).size}
              onCollect={() => collect(status.word)}
              onNext={next}
            />
          ) : null}

          {status.kind === "notfound" ? <Manual query={status.query} roots={roots} onCollect={collect} /> : null}

          {status.kind === "collected" ? (
            <Collected
              word={status.word}
              before={status.before}
              words={words ?? []}
              opened={status.unlocked}
              collected={collected}
              owned={ownedKeys}
              onOpen={setSheet}
              onNext={next}
            />
          ) : null}

          {words === undefined ? null : hasWords ? (
            <>
              {readable.length > 0 ? (
                <Link to="/find" className={styles.readable}>
                  <span className={styles.readableText}>
                    <span className={styles.readableTitle}>{t.collect.readable(readable.length)}</span>
                    <span className={app.note}>{t.collect.readableNote}</span>
                  </span>
                  <span className={styles.readableAction}>
                    {t.collect.readableAction}
                    <Icon name="arrow" size={18} />
                  </span>
                </Link>
              ) : null}
              <section>
                <div className={app.listHead}>
                  <h2>{t.collect.recent}</h2>
                  <Link to="/words" className={app.headLink}>
                    {t.collect.toWords}
                  </Link>
                </div>
                <ul className={app.plainList}>
                  {words.slice(0, 5).map((w) => (
                    <WordRow key={w.id} word={w} meta={t.common.ago(w.addedAt)} onOpen={() => setSheet(w)} />
                  ))}
                </ul>
              </section>
            </>
          ) : status.kind === "idle" ? (
            <section className={styles.welcome}>
              <div className={styles.ground} aria-hidden="true">
                <Sprout className={styles.sprout} />
              </div>
              <ol className={styles.steps} aria-label={t.collect.stepsLabel}>
                {t.collect.steps.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ol>
            </section>
          ) : null}
        </div>
      </div>

      {sheet ? <WordSheet key={wordKey(sheet)} word={sheet} onClose={() => setSheet(null)} /> : null}
    </>
  );
}

/** 語の名前（ハングルと漢字）、読み上げ、意味。 */
function Names({ word }: { word: Pick<WordData, "hangul" | "hanja" | "gloss"> }) {
  return (
    <>
      <div className={styles.head}>
        <div className={styles.names}>
          <h2 className={`${styles.big} t-ko`} lang="ko">
            {word.hangul}
          </h2>
          <HanjaText ko={word.hanja} className={styles.bigHanja} />
        </div>
        <SpeakButton text={word.hangul} size="lg" />
      </div>
      {word.gloss ? (
        <p className={styles.gloss} lang={glossLang(word.gloss)}>
          {word.gloss}
        </p>
      ) : null}
    </>
  );
}

/** 辞書で見つかった語：根に分けて見せ、あつめる。 */
function Found({
  word,
  owned,
  gain,
  fresh,
  onCollect,
  onNext,
}: {
  word: ResolvedWord;
  owned: CollectedWord | null;
  /** あつめると新しく読めるようになる語の数。 */
  gain: number;
  /** まだ集めていない字の数。 */
  fresh: number;
  onCollect: () => void;
  onNext: () => void;
}) {
  return (
    <section className={styles.block} aria-live="polite">
      <Names word={word} />
      <Roots hangul={word.hangul} hanja={word.hanja} />
      {owned ? (
        <>
          <p className={styles.already}>{t.collect.already(owned.addedAt)}</p>
          <button type="button" className="btn-quiet" onClick={onNext}>
            {t.collect.next}
          </button>
        </>
      ) : (
        <>
          {gain > 0 ? (
            <Gain count={gain} when="before" />
          ) : (
            <p className={app.note}>{fresh === 0 ? t.gain.known : t.gain.firstRoots(fresh)}</p>
          )}
          <button type="button" className="btn" onClick={onCollect}>
            {t.collect.collect}
          </button>
        </>
      )}
    </section>
  );
}

/**
 * あつめた直後：字ごとに、はじめてか、また出会ったか。新しく読めるようになった語の数（いちばん大きく）と、その語。
 * 前の語とのつながり。読める語が増えなかったときは、次に出会うと読める語。
 */
function Collected({
  word,
  before,
  words,
  opened,
  collected,
  owned,
  onOpen,
  onNext,
}: {
  word: ResolvedWord;
  before: number[];
  words: CollectedWord[];
  opened: WordData[];
  collected: Set<string>;
  owned: Set<string>;
  onOpen: (w: Pick<WordData, "hangul" | "hanja" | "gloss">) => void;
  onNext: () => void;
}) {
  const self = wordKey(word);
  const links = word.chars
    .map((c, i) => ({ char: c, again: before[i] > 0, words: words.filter((w) => w.chars.includes(c) && wordKey(w) !== self) }))
    .filter((l, i, all) => l.again && l.words.length > 0 && all.findIndex((x) => x.char === l.char) === i);

  return (
    <section className={styles.block} aria-live="polite">
      <p className={styles.done}>
        <Icon name="check" size={18} />
        {t.collect.collectedTitle(word.hangul)}
      </p>
      <Names word={word} />
      <Roots hangul={word.hangul} hanja={word.hanja} notes={rootNotes(before)} grow />
      {opened.length > 0 ? (
        <section className={styles.opened}>
          <Gain count={opened.length} when="after" />
          <ul className={`${app.plainList} ${styles.openedList}`}>
            {opened.slice(0, OPENED_LIMIT).map((w) => (
              <WordRow key={wordKey(w)} word={w} onOpen={() => onOpen(w)} />
            ))}
          </ul>
          {opened.length > OPENED_LIMIT ? (
            <Link to="/find?view=readable" className={app.quietAction}>
              {t.collect.openedMore(opened.length - OPENED_LIMIT)}
              <Icon name="arrow" size={16} />
            </Link>
          ) : null}
        </section>
      ) : (
        <NearNext hanja={word.hanja} collected={collected} owned={owned} onOpen={onOpen} />
      )}
      {links.length > 0 ? (
        <ul className={styles.links}>
          {links.map((l) => (
            <li key={l.char}>
              <span className={`hanja ${styles.linkChar}`}>{l.char}</span>
              <span>
                {l.words.slice(0, 3).map((w, i) => (
                  <span key={w.id}>
                    {i > 0 ? "・" : ""}
                    <button type="button" className={`${styles.linkWord} t-ko`} lang="ko" onClick={() => onOpen(w)}>
                      {w.hangul}
                    </button>
                  </span>
                ))}
                <span className={styles.linkTail}>{t.collect.rootLinked}</span>
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      <button type="button" className="btn-quiet" onClick={onNext}>
        {t.collect.next}
      </button>
    </section>
  );
}

/** 辞書に無い語：ハングル・漢字・意味を自分で打って登録する。漢字は集めた字から組み立てた候補も出す。 */
function Manual({
  query,
  roots,
  onCollect,
}: {
  query: string;
  roots: string[];
  onCollect: (w: ResolvedWord) => void;
}) {
  const byHanja = isHanjaInput(query);
  const [hangul, setHangul] = useState(byHanja ? "" : query);
  const [hanja, setHanja] = useState(byHanja ? query : "");
  const [gloss, setGloss] = useState("");
  const word = hangul.trim() && hanja.trim() ? resolveManual(hangul, hanja, gloss) : null;
  const mismatch = word ? Array.from(word.hangul).length !== splitHanja(word.hanja).length : false;
  const guesses = guessHanja(hangul, roots);

  return (
    <section className={`${styles.block} ${styles.manual}`} aria-live="polite">
      <p className={styles.ask}>{t.collect.notFound(query)}</p>
      <div className={styles.fields}>
        <label className={styles.field}>
          <span className="label">{t.collect.manualHangul}</span>
          <input className={`${styles.fieldInput} t-ko`} lang="ko" value={hangul} onChange={(e) => setHangul(e.target.value)} autoComplete="off" />
        </label>
        <label className={styles.field}>
          <span className="label">{t.collect.manualHanja}</span>
          <input
            className={`${styles.fieldInput} hanja`}
            value={hanja}
            onChange={(e) => setHanja(e.target.value)}
            placeholder={t.collect.manualHanjaPh}
            autoComplete="off"
          />
        </label>
        {guesses.length ? (
          <div className={styles.guess}>
            <span className={app.note}>{t.collect.manualGuess}</span>
            {guesses.map((g) => (
              <button
                key={g}
                type="button"
                className={g === hanja.trim() ? `${styles.guessChip} ${styles.guessOn}` : styles.guessChip}
                aria-pressed={g === hanja.trim()}
                onClick={() => setHanja(g)}
              >
                <span className="hanja">{g}</span>
              </button>
            ))}
          </div>
        ) : null}
        <label className={styles.field}>
          <span className="label">{t.collect.manualGloss}</span>
          <input className={styles.fieldInput} value={gloss} onChange={(e) => setGloss(e.target.value)} placeholder={t.collect.manualGlossPh} />
        </label>
      </div>
      {word && word.chars.length > 0 ? <Roots hangul={word.hangul} hanja={word.hanja} /> : null}
      {mismatch ? <p className={app.note}>{t.collect.manualMismatch}</p> : null}
      <button type="button" className="btn" disabled={!word || word.chars.length === 0} onClick={() => word && onCollect(word)}>
        {t.collect.collect}
      </button>
    </section>
  );
}

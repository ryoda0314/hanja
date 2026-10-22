import { useEffect, useState, type FormEvent } from "react";
import { wordKey, type DiscoverResult } from "../data/combine";
import { getCharData, jpForm, splitHanja } from "../data/dataset";
import { compareSyllables, isSameReading, pickToRead, readingNotes } from "../data/reading";
import { glossText } from "../data/gloss";
import { enrich } from "../data/resolver";
import { wordStage, type Stage } from "../data/stage";
import type { WordData } from "../data/types";
import { t } from "../copy";
import { addWord, db, recordRead, removeWord } from "../db";
import { RATES, usePrefs } from "../prefs";
import { speak, useKoreanVoice } from "../util/speech";
import HanjaText from "../components/HanjaText";
import { Icon } from "../components/Icon";
import { Roots, rootNotes } from "../components/Roots";
import { SpeakButton } from "../components/SpeakButton";
import { StageGauge } from "../components/Stage";
import { glossLang } from "../components/WordRow";
import app from "../app.module.css";
import styles from "./TryRead.module.css";

/**
 * 読んでみる：集めた字だけでできた、まだ習っていない語を、漢字だけ見せる。字の音をつなげてハングルで打ち、
 * 合っていればそのまま集まる（打つ一手間が「写す」でなく「組み立てる」になる）。
 * 点数も連続記録もない。字を押せばその字の音、「答えを見る」でいつでも答え（ことのあめ の「言ってみる」と同じ段）。
 */
export function TryRead({ pool, onNear }: { pool: DiscoverResult[]; onNear: () => void }) {
  // このひとときに出した語（同じ語が続かないように）。開き直すとまた出る：忘れても、また出会う。
  const [seen, setSeen] = useState<Set<string>>(() => new Set());
  const [current, setCurrent] = useState<DiscoverResult | null>(() => pickToRead(pool, () => false));

  // 読める語がまだ無かったところへ増えたら、最初の語を出す。
  useEffect(() => {
    if (!current) setCurrent(pickToRead(pool, (w) => seen.has(wordKey(w))));
  }, [current, pool, seen]);

  function next() {
    if (!current) return;
    const nextSeen = new Set(seen).add(wordKey(current));
    setSeen(nextSeen);
    setCurrent(pickToRead(pool, (w) => nextSeen.has(wordKey(w))));
  }

  if (!current) {
    if (pool.length === 0) {
      return (
        <section className={app.stack}>
          <p className={app.lead}>{t.read.empty}</p>
          <button type="button" className={app.quietAction} onClick={onNear}>
            {t.read.toNear}
            <Icon name="arrow" size={16} />
          </button>
        </section>
      );
    }
    return (
      <section className={app.stack}>
        <p className={app.lead}>{t.read.allSeen}</p>
        <button type="button" className="btn-quiet" onClick={() => setSeen(new Set())}>
          {t.read.restart}
        </button>
      </section>
    );
  }

  return <ReadCard key={wordKey(current)} word={current} mode="new" focus={seen.size > 0} onNext={next} />;
}

type Phase = "ask" | "answer" | "read";

/**
 * 漢字だけ見せて、字の音をつなげてハングルで読むカード。
 * new：まだ集めていない語。読めたら（打てたら）集まり、答えを見ずに読めたら「読めた」から始まる。
 * review：集めた語のふりかえり。答えを見ずに読めたら覚え具合が進み、答えを見たらあすまた出てくる。
 */
export function ReadCard({
  word,
  mode,
  focus,
  onNext,
}: {
  word: Pick<WordData, "hangul" | "hanja" | "gloss">;
  mode: "new" | "review";
  focus: boolean;
  onNext: () => void;
}) {
  const { script, rate } = usePrefs();
  const voice = useKoreanVoice();
  const chars = splitHanja(word.hanja);
  const [phase, setPhase] = useState<Phase>("ask");
  const [typed, setTyped] = useState("");
  const [hinted, setHinted] = useState<Set<number>>(() => new Set());
  // 違った読み（答えに印を付けるため）。答えを見ただけなら null。
  const [missed, setMissed] = useState<string | null>(null);
  const [retypeWrong, setRetypeWrong] = useState(false);
  const [before, setBefore] = useState<number[] | null>(null);
  // 答えを見ずに読めたか（読めました と言えるのはこのときだけ）。
  const [firstTry, setFirstTry] = useState(false);
  const [undone, setUndone] = useState(false);
  // 答えを見ずに読めたあとの覚え具合（読めた・身についた）。
  const [stageAfter, setStageAfter] = useState<Stage | null>(null);
  const notes = readingNotes(word.hangul, word.hanja);
  const jp = jpForm(word.hanja);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!typed.trim()) return;
    if (isSameReading(typed, word.hangul)) {
      const ok = phase === "ask";
      if (mode === "new") {
        const counts = await Promise.all(chars.map((c) => db.chars.get(c).then((x) => x?.count ?? 0)));
        await addWord(enrich(word, "seed"));
        setBefore(counts);
      }
      if (ok) {
        await recordRead(word, true);
        const saved = await db.words.get({ hangul: word.hangul, hanja: word.hanja.normalize("NFC") });
        if (saved) setStageAfter(wordStage(saved));
      }
      setFirstTry(ok);
      setPhase("read");
      if (voice) void speak(word.hangul, voice, RATES[rate]);
    } else if (phase === "ask") {
      if (mode === "review") void recordRead(word, false);
      setMissed(typed);
      setTyped("");
      setPhase("answer");
    } else {
      setRetypeWrong(true);
    }
  }

  function reveal() {
    if (mode === "review") void recordRead(word, false);
    setMissed(null);
    setPhase("answer");
  }

  async function undo() {
    const owned = await db.words.get({ hangul: word.hangul, hanja: word.hanja });
    if (owned) await removeWord(owned.id);
    setUndone(true);
  }

  const glyphOf = (c: string) => (script === "ja" ? (getCharData(c)?.jp ?? c) : c);
  // 違った音節の印は、答えを見ているあいだだけ。
  const marks = phase === "answer" && missed ? compareSyllables(missed, word.hangul) : null;

  return (
    <section className={styles.wrap} aria-live="polite">
      {phase === "ask" ? (
        <>
          <p className={app.lead}>{mode === "review" ? t.review.lead : t.read.lead}</p>
          <div className={styles.card}>
            <ol className={styles.glyphs}>
              {chars.map((c, i) => {
                const eum = getCharData(c)?.readings[0]?.eum ?? "";
                const open = hinted.has(i);
                return (
                  <li key={i}>
                    <button
                      type="button"
                      className={styles.glyph}
                      onClick={() => setHinted((h) => new Set(h).add(i))}
                      aria-label={open ? `${c} ${eum}` : c}
                    >
                      <span className={`hanja ${styles.glyphChar}`}>{glyphOf(c)}</span>
                      <span className={`t-ko ${open ? styles.sound : `${styles.sound} ${styles.soundHidden}`}`} lang="ko">
                        {open ? eum : "・"}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
            {script === "both" && jp !== word.hanja ? (
              <p className={styles.jp}>
                {t.common.jpForm} <span className="hanja">{jp}</span>
              </p>
            ) : null}
            <p className={app.note}>{t.read.tapHint}</p>
          </div>
        </>
      ) : (
        <>
          {phase === "read" ? (
            <p className={styles.success}>
              <Icon name="check" size={18} />
              {mode === "review"
                ? firstTry
                  ? t.review.read
                  : t.review.missed
                : firstTry
                  ? t.read.read
                  : t.collect.collectedTitle(word.hangul)}
            </p>
          ) : (
            <p className="label">{missed ? t.read.missed : t.read.shown}</p>
          )}
          {phase === "read" && stageAfter ? (
            <p className={styles.stageAfter}>
              <StageGauge stage={stageAfter} />
            </p>
          ) : null}
          <div className={styles.answer}>
            <div className={styles.names}>
              <span className={`${styles.big} t-ko`} lang="ko">
                {Array.from(word.hangul).map((s, i) => (
                  <span key={i} className={marks && !marks[i] ? styles.diff : undefined}>
                    {s}
                  </span>
                ))}
              </span>
              <HanjaText ko={word.hanja} className={styles.bigHanja} />
            </div>
            <SpeakButton text={word.hangul} size="lg" />
          </div>
          {phase === "answer" && missed ? (
            <p className={app.note}>
              {t.read.typed} <span className="t-ko">{missed}</span>
            </p>
          ) : null}
          {word.gloss ? (
            <p className={styles.gloss} lang={glossLang(word.gloss)}>
              {glossText(word.gloss)}
            </p>
          ) : null}
          <Roots hangul={word.hangul} hanja={word.hanja} notes={before ? rootNotes(before) : undefined} grow={phase === "read"} />
          {notes.length > 0 ? (
            <ul className={styles.notes}>
              {notes.map((n) => (
                <li key={n.char}>{t.read.variant(n.char, n.usual, n.here)}</li>
              ))}
            </ul>
          ) : null}
        </>
      )}

      {phase === "read" ? (
        <>
          {mode === "new" ? (
            <p className={app.note}>
              {undone ? t.read.undone : t.read.collected}
              {undone ? null : (
                <button type="button" className={styles.quiet} onClick={undo}>
                  {t.read.undo}
                </button>
              )}
            </p>
          ) : null}
          <button type="button" className="btn" onClick={onNext} autoFocus>
            {t.read.next}
          </button>
        </>
      ) : (
        <>
          <form className={styles.form} onSubmit={submit}>
            <label htmlFor="read-input" className="label">
              {phase === "ask" ? t.read.label : mode === "review" ? t.review.retype : t.read.retype}
            </label>
            <div className={styles.row}>
              <input
                id="read-input"
                className={`${styles.input} t-ko`}
                lang="ko"
                value={typed}
                onChange={(e) => {
                  setTyped(e.target.value);
                  setRetypeWrong(false);
                }}
                autoComplete="off"
                autoCapitalize="off"
                spellCheck={false}
                enterKeyHint="done"
                autoFocus={focus}
              />
              <button type="submit" className="btn" disabled={!typed.trim()}>
                {phase === "ask" ? t.read.submit : mode === "review" ? t.review.retypeSubmit : t.read.retypeSubmit}
              </button>
            </div>
            {retypeWrong ? (
              <p className={app.error} role="alert">
                {t.sheet.typeWrong(word.hangul)}
              </p>
            ) : null}
          </form>
          <div className={styles.actions}>
            {phase === "ask" ? (
              <>
                <button
                  type="button"
                  className={styles.small}
                  disabled={hinted.size === chars.length}
                  onClick={() => setHinted(new Set(chars.map((_, i) => i)))}
                >
                  {t.read.hintAll}
                </button>
                <button type="button" className={styles.small} onClick={reveal}>
                  {t.read.reveal}
                </button>
              </>
            ) : null}
            <button type="button" className={styles.small} onClick={onNext}>
              {phase === "ask" ? (mode === "review" ? t.review.skip : t.read.skip) : t.read.next}
            </button>
          </div>
        </>
      )}
    </section>
  );
}

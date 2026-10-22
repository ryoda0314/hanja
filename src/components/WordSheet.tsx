import { useLiveQuery } from "dexie-react-hooks";
import { useMemo, useState, type FormEvent } from "react";
import { unlockedBy, wordKey } from "../data/combine";
import { jpForm, splitHanja } from "../data/dataset";
import { isSameReading, readingNotes } from "../data/reading";
import { enrich } from "../data/resolver";
import { wordOf } from "../data/sentences";
import type { WordData } from "../data/types";
import { t } from "../copy";
import { addWord, db, removeWord, type CollectedWord } from "../db";
import { useChars, useSentences, useWords } from "../util/live";
import appStyles from "../app.module.css";
import { Gain } from "./Gain";
import HanjaText from "./HanjaText";
import { Roots, rootNotes } from "./Roots";
import { SentenceRows } from "./SentenceView";
import { Sheet } from "./Sheet";
import { SpeakButton } from "./SpeakButton";
import { glossLang, MaskedHanja, WordRow } from "./WordRow";
import styles from "./WordSheet.module.css";

type Word = Pick<WordData, "hangul" | "hanja" | "gloss">;

/**
 * 一つの語を開いたところ：ハングル、漢字、意味、漢字の根。集めた語なら、同じ字でつながった語と外す操作。
 * まだ集めていない語は、図鑑のつかまえる前のように漢字を ？ で伏せる。ハングルを自分の指で打ってあつめると、
 * 答え合わせとして漢字が開き、根が下から伸びる（ボタン一つでは集めない。打つ一手間に意味がある）。
 */
export function WordSheet({ word, onClose }: { word: Word; onClose: () => void }) {
  const [current, setCurrent] = useState<Word>(word);
  const hanja = current.hanja.normalize("NFC");
  const owned = useLiveQuery(
    () => db.words.get({ hangul: current.hangul, hanja }).then((w) => w ?? null),
    [current.hangul, hanja]
  );

  return (
    <Sheet
      label={owned === undefined ? "" : owned ? t.sheet.owned : t.sheet.unowned}
      labelledBy="word-sheet-title"
      onClose={onClose}
    >
      {owned === undefined ? null : (
        <Body key={wordKey(current)} word={current} owned={owned} onOpen={setCurrent} onClose={onClose} />
      )}
    </Sheet>
  );
}

function Body({
  word,
  owned,
  onOpen,
  onClose,
}: {
  word: Word;
  owned: CollectedWord | null;
  onOpen: (w: Word) => void;
  onClose: () => void;
}) {
  const hanja = word.hanja.normalize("NFC");
  const [typed, setTyped] = useState("");
  const [wrong, setWrong] = useState(false);
  const [before, setBefore] = useState<number[] | null>(null);
  // あつめて新しく読めるようになった語（あつめる前の手持ちで数えておく）。
  const [unlocked, setUnlocked] = useState<WordData[] | null>(null);
  const [confirming, setConfirming] = useState(false);
  // まだ集めていない語の漢字は伏せる。
  const masked = !owned;

  const words = useWords();
  const chars = useChars();
  const collected = useMemo(() => new Set((chars ?? []).map((c) => c.char)), [chars]);
  const ownedKeys = useMemo(() => new Set((words ?? []).map(wordKey)), [words]);
  const gain = useMemo(
    () => (owned || !chars || !words ? [] : unlockedBy({ hangul: word.hangul, hanja }, collected, ownedKeys)),
    [owned, chars, words, word.hangul, hanja, collected, ownedKeys]
  );
  const fresh = new Set(splitHanja(hanja).filter((c) => !collected.has(c))).size;
  const notes = readingNotes(word.hangul, hanja);
  // 意味の訳に漢字そのものが書いてあれば（学生 など）、集めるまで伏せる。
  const glossSpoils = [...splitHanja(hanja), ...splitHanja(jpForm(hanja))].some((c) => word.gloss.includes(c));
  const sentences = useSentences();
  const sentenceIds = useMemo(
    () => (sentences?.byWord.get(`${word.hangul}|${hanja}`) ?? []).slice(0, 3),
    [sentences, word.hangul, hanja]
  );
  // この語が出てくる文（ことのあめ の例文）。集めていない語の漢字は文の中でも ？。印の別の語を押すと、その語に替わる。
  const examples =
    sentences && sentenceIds.length > 0 ? (
      <section className={styles.section}>
        <h3 className="label">{t.sheet.inSentences}</h3>
        <SentenceRows
          data={sentences}
          ids={sentenceIds}
          collected={collected}
          owned={ownedKeys}
          target={{ hangul: word.hangul, hanja }}
          onWord={(m) => onOpen(wordOf(m))}
        />
      </section>
    ) : null;

  const linked = useLiveQuery(async () => {
    const lists = await Promise.all(
      [...new Set(splitHanja(hanja))].map((c) => db.words.where("chars").equals(c).toArray())
    );
    const byId = new Map<number, CollectedWord>();
    for (const w of lists.flat()) if (!(w.hangul === word.hangul && w.hanja === hanja)) byId.set(w.id, w);
    return [...byId.values()].sort((a, b) => b.addedAt - a.addedAt);
  }, [word.hangul, hanja]);

  async function collect(e: FormEvent) {
    e.preventDefault();
    if (!typed.trim()) return;
    if (!isSameReading(typed, word.hangul)) {
      setWrong(true);
      return;
    }
    const counts = await Promise.all(splitHanja(hanja).map((c) => db.chars.get(c).then((x) => x?.count ?? 0)));
    const opened = gain;
    await addWord(enrich({ ...word, hanja }, "seed"));
    setBefore(counts);
    setUnlocked(opened);
  }

  async function remove() {
    if (!owned) return;
    await removeWord(owned.id);
    onClose();
  }

  return (
    <>
      <div className={styles.top}>
        <div className={styles.names}>
          <h2 id="word-sheet-title" className={`${styles.big} t-ko`} lang="ko">
            {word.hangul}
          </h2>
          {masked ? (
            <MaskedHanja hanja={hanja} className={styles.bigHanja} />
          ) : (
            <HanjaText ko={hanja} className={before ? `${styles.bigHanja} ${styles.reveal}` : styles.bigHanja} />
          )}
        </div>
        <SpeakButton text={word.hangul} size="lg" />
      </div>
      {word.gloss && !(masked && glossSpoils) ? (
        <p className={styles.gloss} lang={glossLang(word.gloss)}>
          {word.gloss}
        </p>
      ) : null}

      <section className={styles.section}>
        <Roots
          hangul={word.hangul}
          hanja={hanja}
          masked={masked}
          notes={before ? rootNotes(before) : undefined}
          grow={before !== null}
        />
        {masked ? null : <p className={appStyles.note}>{t.sheet.rootsNote}</p>}
        {!masked && notes.length > 0 ? (
          <ul className={styles.notes}>
            {notes.map((n) => (
              <li key={n.char}>{t.read.variant(n.char, n.usual, n.here)}</li>
            ))}
          </ul>
        ) : null}
      </section>

      {owned ? (
        <>
          <p className={styles.since}>
            {before ? t.collect.collectedTitle(word.hangul) : t.sheet.since(owned.addedAt)}
          </p>
          {unlocked && unlocked.length > 0 ? (
            <section className={styles.section}>
              <Gain count={unlocked.length} when="after" />
              <ul className={appStyles.plainList}>
                {unlocked.slice(0, 4).map((w) => (
                  <WordRow key={wordKey(w)} word={w} onOpen={() => onOpen(w)} />
                ))}
              </ul>
            </section>
          ) : null}
          <section className={styles.section}>
            <h3 className="label">{t.sheet.linked}</h3>
            {linked === undefined ? null : linked.length === 0 ? (
              <p className={appStyles.empty}>{t.sheet.linkedNone}</p>
            ) : (
              <ul className={appStyles.plainList}>
                {linked.slice(0, 12).map((w) => (
                  <WordRow key={w.id} word={w} onOpen={() => onOpen(w)} />
                ))}
              </ul>
            )}
          </section>
          {examples}
          <div className={styles.dangerRow}>
            {confirming ? (
              <div className={styles.confirm}>
                <p className={appStyles.note}>{t.sheet.deleteNote}</p>
                <button type="button" className={styles.danger} onClick={remove} autoFocus>
                  {t.sheet.confirmDelete}
                </button>
                <button type="button" className={styles.quietDanger} onClick={() => setConfirming(false)}>
                  {t.common.cancel}
                </button>
              </div>
            ) : (
              <button type="button" className={styles.quietDanger} onClick={() => setConfirming(true)}>
                {t.sheet.delete}
              </button>
            )}
          </div>
        </>
      ) : (
        <>
          {gain.length > 0 ? (
            <Gain count={gain.length} when="before" />
          ) : chars ? (
            <p className={appStyles.note}>{fresh === 0 ? t.gain.known : t.gain.firstRoots(fresh)}</p>
          ) : null}
          <form className={styles.typeBox} onSubmit={collect}>
            <label htmlFor="type-word" className="label">
              {t.sheet.typeLabel}
            </label>
            <div className={styles.typeRow}>
              <input
                id="type-word"
                className={`${styles.typeInput} t-ko`}
                lang="ko"
                value={typed}
                onChange={(e) => {
                  setTyped(e.target.value);
                  setWrong(false);
                }}
                autoComplete="off"
                autoCapitalize="off"
                spellCheck={false}
                enterKeyHint="done"
              />
              <button type="submit" className="btn" disabled={!typed.trim()}>
                {t.collect.collect}
              </button>
            </div>
            <p className={wrong ? appStyles.error : appStyles.note} role={wrong ? "alert" : undefined}>
              {wrong ? t.sheet.typeWrong(word.hangul) : t.sheet.typeHint}
            </p>
          </form>
          {examples}
        </>
      )}
    </>
  );
}

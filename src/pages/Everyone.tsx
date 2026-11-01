import { useEffect, useRef, useState } from "react";
import { glossText, maskedGlossText } from "../data/gloss";
import { markStatus, type MarkStatus } from "../data/sentences";
import type { WordData } from "../data/types";
import { t } from "../copy";
import HanjaText from "../components/HanjaText";
import { glossLang, MaskedHanja } from "../components/WordRow";
import { readFalls, shareAllowed, type Fall } from "../util/falls";
import app from "../app.module.css";
import styles from "./Everyone.module.css";

/** 新しく降った分を読みに行く間（ミリ秒）。 */
const POLL = 8000;
/** 一つずつ降らせる間。待っている語が多いときは速く。 */
const DROP = 1400;
/** 開いたときに降らせる、この1時間の分。 */
const FIRST = 24;
/** 積もったまま見せる数。 */
const KEEP = 30;

const keyOf = (w: Pick<WordData, "hangul" | "hanja">) => `${w.hangul}|${w.hanja}`;

/**
 * みんなの雨（util/falls）：この1時間に、みんなが集めた語が一つずつ降ってきて、上に積もる。開いたときはこの1時間の分から、
 * そのあとは新しく集められた語が届きしだい降る。押すとその語が開く。集めていない語は、ほかと同じく漢字を ？？ で伏せる。
 */
export function Everyone({
  collected,
  owned,
  onOpen,
}: {
  collected: Set<string>;
  owned: Set<string>;
  onOpen: (w: WordData) => void;
}) {
  // undefined：読んでいる、null：読めない
  const [total, setTotal] = useState<number | null | undefined>(undefined);
  const [shown, setShown] = useState<Fall[]>([]);
  const waiting = useRef<Fall[]>([]);
  const last = useRef(0);

  useEffect(() => {
    let active = true;
    async function read(first: boolean) {
      const result = await readFalls(last.current);
      if (!active) return;
      if (!result) {
        if (first) setTotal(null);
        return;
      }
      setTotal(result.total);
      if (!result.falls.length) return;
      last.current = Math.max(last.current, ...result.falls.map((f) => f.id));
      // 新しい順で届くので、古い順にして待たせる（いちばん新しい語が最後に降って、いちばん上に来る）。
      waiting.current.push(...(first ? result.falls.slice(0, FIRST) : result.falls).reverse());
    }
    void read(true);
    const timer = window.setInterval(() => void read(false), POLL);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    let timer = 0;
    const drop = () => {
      const next = waiting.current.shift();
      if (next) setShown((list) => [next, ...list.filter((f) => keyOf(f.word) !== keyOf(next.word))].slice(0, KEEP));
      timer = window.setTimeout(drop, waiting.current.length > 8 ? DROP / 3 : DROP);
    };
    timer = window.setTimeout(drop, 300);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <section className={styles.wrap}>
      <p className={app.lead}>{t.everyone.lead}</p>
      {total === undefined ? (
        <p className={app.note}>{t.everyone.loading}</p>
      ) : total === null ? (
        <p className={app.error}>{t.everyone.failed}</p>
      ) : (
        <>
          <p className={styles.count}>
            {t.everyone.totalBefore}
            <b>{total}</b>語
          </p>
          {total === 0 ? <p className={app.note}>{t.everyone.quiet}</p> : null}
          {shown.length ? (
            <ol className={styles.list} aria-live="polite">
              {shown.map((f) => (
                <Drop key={f.id} fall={f} status={markStatus(f.word, collected, owned)} onOpen={() => onOpen(f.word)} />
              ))}
            </ol>
          ) : null}
        </>
      )}
      <p className={app.note}>{shareAllowed() ? t.everyone.yours : t.everyone.yoursOff}</p>
    </section>
  );
}

/** 降ってきた語の一行：雨粒の印、ハングル、漢字（集めていなければ ？？）、意味、いつ。 */
function Drop({ fall, status, onOpen }: { fall: Fall; status: MarkStatus; onOpen: () => void }) {
  const w = fall.word;
  const masked = status !== "owned";
  const gloss = masked ? maskedGlossText(w.gloss, w.hanja) : glossText(w.gloss);
  return (
    <li className={styles.item}>
      <button type="button" className={styles.row} onClick={onOpen}>
        <span className={`${styles.drop} ${styles[status]}`} aria-hidden="true" />
        <span className={styles.main}>
          <span className={styles.line}>
            <span className={`${styles.hangul} t-ko`} lang="ko">
              {w.hangul}
            </span>
            {masked ? <MaskedHanja hanja={w.hanja} className={styles.hanja} /> : <HanjaText ko={w.hanja} className={styles.hanja} />}
          </span>
          {gloss ? (
            <span className={styles.gloss} lang={glossLang(w.gloss)}>
              {gloss}
            </span>
          ) : null}
        </span>
        <span className={styles.when}>{t.everyone.ago(fall.at)}</span>
      </button>
    </li>
  );
}

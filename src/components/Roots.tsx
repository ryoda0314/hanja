import type { CSSProperties, ReactNode } from "react";
import { Link } from "react-router-dom";
import { getCharData, splitHanja } from "../data/dataset";
import { t } from "../copy";
import { usePrefs } from "../prefs";
import styles from "./hanja.module.css";

/**
 * あつめたときの字ごとの添え書き。before = あつめる前に、その字が入った語をいくつ持っていたか。
 * はじめての字はアクセントの色、また出会った字は紫（ことのあめ の「前にも降ったかたち」と同じ）。
 */
export function rootNotes(before: number[]): ReactNode[] {
  return before.map((n, i) =>
    n === 0 ? (
      <span key={i} className={`${styles.note} ${styles.noteNew}`}>
        {t.collect.rootNew}
      </span>
    ) : (
      <span key={i} className={`${styles.note} ${styles.noteAgain}`}>
        {t.collect.rootAgain}
        <br />
        {t.collect.rootAgainCount(n + 1)}
      </span>
    )
  );
}

/**
 * 語を漢字の根に分けて並べる：その語での音節、字、韓国語の音（訓があれば訓も）、日本語の読み。
 * 学 학 と ガク を縦にそろえると、韓国語と日本語の音の対応が自分で見えてくる。字を押すとその字のページへ。
 */
export function Roots({
  hangul,
  hanja,
  notes,
  grow = false,
  masked = false,
}: {
  hangul: string;
  hanja: string;
  /** 漢字を伏せる（まだ集めていない語）。その語での音節だけ見せ、字・訓・日本語の読みは ？ に。 */
  masked?: boolean;
  /** 字ごとの添え書き（はじめての字・また出会った字）。 */
  notes?: (ReactNode | null)[];
  /** 根が伸びるように一つずつ現れる（あつめた直後）。 */
  grow?: boolean;
}) {
  const { script } = usePrefs();
  const chars = splitHanja(hanja);
  const syllables = Array.from(hangul);
  const aligned = syllables.length === chars.length;

  return (
    <ol className={styles.roots} style={{ gridTemplateColumns: `repeat(${Math.min(chars.length, 4)}, minmax(0, 1fr))` }}>
      {chars.map((c, i) => {
        const d = getCharData(c);
        const r = d?.readings[0];
        const jp = d?.jp && d.jp !== c ? d.jp : null;
        const ja = [d?.on?.[0], d?.kun?.[0]].filter(Boolean).join("・");
        if (masked) {
          return (
            <li key={i}>
              <div className={styles.root}>
                {aligned ? (
                  <span className={`${styles.syllable} t-ko`} lang="ko">
                    {syllables[i]}
                  </span>
                ) : null}
                <span className={`hanja ${styles.glyph} ${styles.glyphMasked}`} aria-hidden="true">
                  ？
                </span>
              </div>
            </li>
          );
        }
        return (
          <li key={i} className={grow ? styles.grow : undefined} style={{ "--i": i } as CSSProperties}>
            <Link to={`/hanja/${encodeURIComponent(c)}`} className={styles.root}>
              {aligned ? (
                <span className={`${styles.syllable} t-ko`} lang="ko">
                  {syllables[i]}
                </span>
              ) : null}
              <span className={`hanja ${styles.glyph}`}>{script === "ja" && jp ? jp : c}</span>
              {script === "both" && jp ? <span className={`hanja ${styles.jpMark}`}>{jp}</span> : null}
              {r ? (
                <span className={`${styles.reading} t-ko`} lang="ko">
                  {r.hun ? <span className={styles.hun}>{r.hun} </span> : null}
                  <span className={styles.eumPart}>{r.eum}</span>
                </span>
              ) : null}
              {ja ? <span className={styles.ja}>{ja}</span> : null}
              {notes?.[i] ?? null}
            </Link>
          </li>
        );
      })}
    </ol>
  );
}

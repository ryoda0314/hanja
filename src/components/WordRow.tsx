import type { ReactNode } from "react";
import { splitHanja } from "../data/dataset";
import type { WordData } from "../data/types";
import { t } from "../copy";
import styles from "../app.module.css";
import HanjaText from "./HanjaText";
import { Icon } from "./Icon";

/** 意味が日本語か（手作業の訳）。ほかは辞書の英語。 */
export function glossLang(gloss: string): "ja" | "en" {
  return /[぀-ヿ一-鿿]/.test(gloss) ? "ja" : "en";
}

/** 伏せた漢字の ？（一字に一つ）。 */
export function hanjaMask(hanja: string): string {
  return "？".repeat(Math.max(1, splitHanja(hanja).length));
}

/**
 * まだ集めていない語の漢字：図鑑の、つかまえる前のように ？ で伏せる。
 * ハングルを自分の指で打ってあつめると、答え合わせとして漢字が開く。
 */
export function MaskedHanja({ hanja, className = "" }: { hanja: string; className?: string }) {
  return (
    <span className={className}>
      <span aria-hidden="true" className={styles.masked}>
        {hanjaMask(hanja)}
      </span>
      <span className="sr-only">{t.sheet.maskedLabel}</span>
    </span>
  );
}

/** 語の一行：ハングル、漢字（日本の字）、意味。押すとその語が開く。 */
export function WordRow({
  word,
  meta,
  missing,
  onOpen,
}: {
  word: Pick<WordData, "hangul" | "hanja" | "gloss">;
  meta?: ReactNode;
  /** あと1字で読める語の、まだ集めていない字。 */
  missing?: string;
  onOpen: () => void;
}) {
  return (
    <li>
      <button type="button" className={styles.wordRow} onClick={onOpen}>
        <span className={styles.wordText}>
          <span className={styles.wordLine}>
            <span className={`${styles.wordHangul} t-ko`} lang="ko">
              {word.hangul}
            </span>
            <HanjaText ko={word.hanja} missing={missing} className={styles.wordHanja} />
          </span>
          {word.gloss ? (
            <span className={styles.wordGloss} lang={glossLang(word.gloss)}>
              {word.gloss}
            </span>
          ) : null}
          {meta ? <span className={styles.wordMeta}>{meta}</span> : null}
        </span>
        <span className={styles.chev}>
          <Icon name="back" size={18} />
        </span>
      </button>
    </li>
  );
}

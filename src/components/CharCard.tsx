import { Link } from "react-router-dom";
import { getCharData } from "../data/dataset";
import { t } from "../copy";
import { usePrefs } from "../prefs";
import styles from "./hanja.module.css";

/** 根の深さ：その字が入った集めた語の数を、雨粒の目盛りで（1・2・3〜4・5語以上）。 */
export function Gauge({ count }: { count: number }) {
  const level = count >= 5 ? 4 : count >= 3 ? 3 : count;
  return (
    <span className={styles.gauge}>
      <span className={styles.drops} aria-hidden="true">
        {[1, 2, 3, 4].map((k) => (
          <i key={k} data-on={k <= level || undefined} />
        ))}
      </span>
      {t.hanja.depth(count)}
    </span>
  );
}

/** 字のカード：明朝の字、韓国語の音と日本語の音、根の深さ。集めていない字は薄く。 */
export function CharCard({ char, count }: { char: string; count?: number }) {
  const { script } = usePrefs();
  const d = getCharData(char);
  const jp = d?.jp && d.jp !== char ? d.jp : null;
  const owned = count != null && count > 0;
  return (
    <Link to={`/hanja/${encodeURIComponent(char)}`} className={owned ? styles.card : `${styles.card} ${styles.cardOff}`}>
      {script === "both" && jp ? <span className={`hanja ${styles.cardJp}`}>{jp}</span> : null}
      <span className={`hanja ${styles.cardGlyph}`}>{script === "ja" && jp ? jp : char}</span>
      <span className={styles.cardRead}>
        <span className="t-ko" lang="ko">
          {d?.readings[0]?.eum ?? ""}
        </span>
        {d?.on?.[0] ? <span className={styles.cardOn}>{d.on[0]}</span> : null}
      </span>
      {owned ? <Gauge count={count} /> : <span className={styles.cardNot}>{t.hanja.notYet}</span>}
    </Link>
  );
}

/** 基礎漢字の一覧の小さな升：集めた字は濃く、まだの字は薄く。 */
export function CharCell({ char, owned }: { char: string; owned: boolean }) {
  const { script } = usePrefs();
  const d = getCharData(char);
  const glyph = script === "ja" && d?.jp ? d.jp : char;
  return (
    <Link
      to={`/hanja/${encodeURIComponent(char)}`}
      className={owned ? `${styles.cell} ${styles.cellOn}` : styles.cell}
      aria-label={`${char} ${d?.readings[0]?.eum ?? ""}`}
    >
      <span className={`hanja ${styles.cellGlyph}`}>{glyph}</span>
      <span className={`${styles.cellRead} t-ko`}>{d?.readings[0]?.eum ?? ""}</span>
    </Link>
  );
}

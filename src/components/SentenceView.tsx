import { jpForm } from "../data/dataset";
import { audioUrl, markStatus, segments, type Sentence, type SentenceData, type SentenceMark } from "../data/sentences";
import { usePrefs } from "../prefs";
import { usePref } from "../util/local";
import { SpeakButton } from "./SpeakButton";
import styles from "./SentenceView.module.css";

/**
 * 例文の韓国語。漢字語には印を付けて押せるようにする：集めた語は紫の点線（また出会った）、集めた字で読める語は
 * アクセントの線、まだの語は細い線。showHanja なら語の上に漢字を小さく添える。target の語は地の色で示す。
 */
export function SentenceView({
  sentence,
  collected,
  owned,
  showHanja,
  target,
  onWord,
}: {
  sentence: Pick<Sentence, "ko" | "marks">;
  collected: Set<string>;
  owned: Set<string>;
  showHanja: boolean;
  /** 強めて見せる語（hangul|hanja）。 */
  target?: string;
  onWord: (m: SentenceMark) => void;
}) {
  const { script } = usePrefs();
  return (
    <span className={`t-ko ${styles.ko}`} lang="ko">
      {segments(sentence).map((p, i) => {
        if (!("mark" in p)) return <span key={i}>{p.text}</span>;
        const m = p.mark;
        const status = markStatus(m, collected, owned);
        const shown = script === "ja" ? jpForm(m.hanja) : m.hanja;
        const className = [styles.mark, styles[status], target === `${m.hangul}|${m.hanja}` ? styles.target : ""]
          .filter(Boolean)
          .join(" ");
        return (
          <button key={i} type="button" className={className} onClick={() => onWord(m)} aria-label={`${m.hangul} ${shown}`}>
            {showHanja ? (
              <ruby>
                {p.text}
                <rt className="hanja">{shown}</rt>
              </ruby>
            ) : (
              p.text
            )}
          </button>
        );
      })}
    </span>
  );
}

/** 日本語訳。target の語の日本の字が訳に出てくれば、そこを地の色で示す（発表 ↔ 발표 の対応が見える）。 */
export function GlossText({ ja, hanja }: { ja: string; hanja?: string }) {
  const form = hanja ? jpForm(hanja) : "";
  const at = form ? ja.indexOf(form) : -1;
  if (at < 0) return <>{ja}</>;
  return (
    <>
      {ja.slice(0, at)}
      <span className={styles.glossMark}>{form}</span>
      {ja.slice(at + form.length)}
    </>
  );
}

/** 印の見方（文で出会う の上に小さく）。 */
export function MarkLegend({ labels }: { labels: { owned: string; readable: string; new: string } }) {
  return (
    <span className={styles.legend}>
      {(["owned", "readable", "new"] as const).map((s) => (
        <span key={s} className={styles.legendItem}>
          <span className={`${styles.mark} ${styles[s]} ${styles.sample}`} aria-hidden="true">
            가나
          </span>
          {labels[s]}
        </span>
      ))}
    </span>
  );
}

/**
 * 例文を何文か、訳と読み上げつきで並べる（語のシート・字のページ）。印の語を押すとその語が開く。
 * target の語は地の色で、その日本の字が訳に出てくれば訳の中でも示す。
 */
export function SentenceRows({
  data,
  ids,
  collected,
  owned,
  target,
  onWord,
}: {
  data: SentenceData;
  ids: number[];
  collected: Set<string>;
  owned: Set<string>;
  target?: { hangul: string; hanja: string };
  onWord: (m: SentenceMark) => void;
}) {
  const [showHanja] = usePref("meetHanja", true);
  return (
    <ul className={styles.rows}>
      {ids.map((id) => {
        const s = data.list[id];
        return (
          <li key={id} className={styles.row}>
            <div className={styles.rowMain}>
              <SentenceView
                sentence={s}
                collected={collected}
                owned={owned}
                showHanja={showHanja}
                target={target ? `${target.hangul}|${target.hanja}` : undefined}
                onWord={onWord}
              />
              <span className={styles.rowGloss}>
                <GlossText ja={s.ja} hanja={target?.hanja} />
              </span>
            </div>
            <SpeakButton text={s.ko} src={data.audioBase ? () => audioUrl(data.audioBase, s.ko) : undefined} />
          </li>
        );
      })}
    </ul>
  );
}

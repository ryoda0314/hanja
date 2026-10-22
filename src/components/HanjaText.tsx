import { jpForm } from "../data/dataset";
import { t } from "../copy";
import { usePrefs } from "../prefs";
import styles from "./hanja.module.css";

/**
 * 漢字語の表記を、表示設定（韓国の字・日本の字・両方）に合わせて描く。
 * 両方のときは、字形が違う語だけ日本の字を小さく添える（會社 会社）。
 * missing の字（あと1字で読める語の、まだ集めていない字）は点線で示す。
 */
export default function HanjaText({
  ko,
  className = "",
  missing,
}: {
  ko: string;
  className?: string;
  missing?: string;
}) {
  const { script } = usePrefs();
  const jp = jpForm(ko);
  const differs = jp !== ko;
  const main = script === "ja" && differs ? jp : ko;
  const marked = missing ? new Set([missing, jpForm(missing)]) : null;

  return (
    <span className={`hanja ${className}`}>
      {marked
        ? Array.from(main).map((c, i) =>
            marked.has(c) ? (
              <span key={i} className={styles.missing}>
                {c}
              </span>
            ) : (
              c
            )
          )
        : main}
      {script === "both" && differs ? (
        <span className={styles.jp} title={t.common.jpForm}>
          {jp}
        </span>
      ) : null}
    </span>
  );
}

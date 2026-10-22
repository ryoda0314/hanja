import { useEffect, useMemo, useState } from "react";
import { audioUrl, markStatus, pickRain, wordOf, type MarkStatus, type Sentence, type SentenceData } from "../data/sentences";
import type { WordData } from "../data/types";
import { t } from "../copy";
import { MarkLegend, SentenceView } from "../components/SentenceView";
import { SpeakButton } from "../components/SpeakButton";
import HanjaText from "../components/HanjaText";
import { MaskedHanja } from "../components/WordRow";
import { addSeen, readSeen, usePref } from "../util/local";
import app from "../app.module.css";
import styles from "./Meet.module.css";

type Word = Pick<WordData, "hangul" | "hanja" | "gloss">;

const SEEN = "seenSentences";

/**
 * 文で出会う：姉妹アプリ ことのあめ の例文が、ひと雨4文ずつ降ってくる。集めた字の入った文ほど降りやすい。
 * 文の中の漢字語は、集めた語（また出会った）・集めた字で読める語・まだの語で印が変わり、押すとその語が開く。
 * 自分から語を持ってこなくても、自分の根が文の中で見つかる。
 */
export function Meet({
  data,
  collected,
  owned,
  onOpen,
}: {
  data: SentenceData;
  collected: Set<string>;
  owned: Set<string>;
  onOpen: (w: Word) => void;
}) {
  const [showHanja, setShowHanja] = usePref("meetHanja", true);
  const [hideGloss, setHideGloss] = usePref("meetHideGloss", false);
  const [round, setRound] = useState(0);
  const [rain, setRain] = useState<Sentence[]>(() => pickRain(data.list, collected, owned, readSeen(SEEN)));

  // 降った文は覚えておき、次の雨では別の文を。
  useEffect(() => addSeen(SEEN, rain.map((s) => s.id)), [rain]);

  function next() {
    setRain(pickRain(data.list, collected, owned, readSeen(SEEN)));
    setRound((r) => r + 1);
    window.scrollTo({ top: 0 });
  }

  // この雨で出会った語を、集めた語・読めそうな語・はじめての語に分ける（同じ語は一度）。
  const met = useMemo(() => {
    const groups: Record<MarkStatus, { key: string; hangul: string; hanja: string }[]> = { owned: [], readable: [], new: [] };
    const seen = new Set<string>();
    for (const s of rain) {
      for (const m of s.marks) {
        const key = `${m.hangul}|${m.hanja}`;
        if (seen.has(key)) continue;
        seen.add(key);
        groups[markStatus(m, collected, owned)].push({ key, hangul: m.hangul, hanja: m.hanja });
      }
    }
    return groups;
  }, [rain, collected, owned]);

  return (
    <section className={styles.wrap}>
      <p className={app.lead}>{collected.size ? t.meet.lead : t.meet.leadFirst}</p>
      <div className={styles.toolbar}>
        <MarkLegend labels={t.meet.legend} />
        <div className={styles.toggles}>
          <label className={styles.toggle}>
            <input type="checkbox" checked={showHanja} onChange={(e) => setShowHanja(e.target.checked)} />
            {t.meet.showHanja}
          </label>
          <label className={styles.toggle}>
            <input type="checkbox" checked={hideGloss} onChange={(e) => setHideGloss(e.target.checked)} />
            {t.meet.hideGloss}
          </label>
        </div>
      </div>

      <ol key={round} className={styles.list} aria-live="polite">
        {rain.map((s, i) => (
          <li key={s.id} className={styles.item} style={{ animationDelay: `${i * 0.35}s` }}>
            <span className={styles.drop} style={{ animationDelay: `${i * 0.35 + 0.25}s` }} aria-hidden="true" />
            <div className={styles.itemMain}>
              <SentenceView
                sentence={s}
                collected={collected}
                owned={owned}
                showHanja={showHanja}
                onWord={(m) => onOpen(wordOf(m))}
              />
              {hideGloss ? null : <span className={styles.gloss}>{s.ja}</span>}
            </div>
            <SpeakButton text={s.ko} src={data.audioBase ? () => audioUrl(data.audioBase, s.ko) : undefined} />
          </li>
        ))}
      </ol>

      <section className={styles.met}>
        <h2 className="label">{t.meet.met}</h2>
        {(["owned", "readable", "new"] as const).map((status) =>
          met[status].length ? (
            <div key={status} className={styles.group}>
              <span className={`${styles.groupName} ${styles[status]}`}>
                {t.meet.groups[status]} {met[status].length}
              </span>
              <div className={styles.chips}>
                {met[status].map((w) => (
                  <button key={w.key} type="button" className={`${styles.chip} ${styles[status]}`} onClick={() => onOpen(wordOf(w))}>
                    <span className="t-ko" lang="ko">
                      {w.hangul}
                    </span>
                    {status === "owned" ? (
                      <HanjaText ko={w.hanja} className={styles.chipHanja} />
                    ) : (
                      <MaskedHanja hanja={w.hanja} className={styles.chipHanja} />
                    )}
                  </button>
                ))}
              </div>
            </div>
          ) : null
        )}
      </section>

      <button type="button" className="btn" onClick={next}>
        {t.meet.next}
      </button>
      <p className={app.note}>{t.meet.source}</p>
    </section>
  );
}

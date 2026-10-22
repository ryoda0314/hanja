import { useMemo, useRef, useState, type ChangeEvent } from "react";
import { discoverWords, wordKey } from "../data/combine";
import { getCharData } from "../data/dataset";
import { t } from "../copy";
import { exportBackup, parseBackup, restoreWords } from "../db";
import { ACCENTS, SCRIPTS, usePrefs, type AccentPref, type RatePref } from "../prefs";
import HanjaText from "../components/HanjaText";
import { Icon } from "../components/Icon";
import { SpeakButton } from "../components/SpeakButton";
import { useChars, useWords } from "../util/live";
import { useKoreanVoice } from "../util/speech";
import app from "../app.module.css";
import styles from "./Me.module.css";

/** スウォッチの色（アクセントそのもの）。 */
const SWATCH: Record<AccentPref, string> = {
  wakaba: "#0f7a50",
  rain: "#0a64f0",
  ink: "#172033",
  hydrangea: "#6a4fe0",
  dusk: "#b9462a",
};

const SISTER_URL = "https://polylinga.app";

const CREDITS = [
  { name: "kengdic", by: "Joe Speigle / Nathan Glenn", license: "CC BY-SA 3.0", url: "https://github.com/garfieldnate/kengdic" },
  { name: "Unihan Database", by: "Unicode, Inc.", license: "Unicode License v3", url: "https://www.unicode.org/charts/unihan.html" },
  { name: "kyujitai", by: "hakatashi", license: "MIT", url: "https://github.com/hakatashi/kyujitai.js" },
  { name: "ことのあめ の例文", by: "姉妹アプリ", license: "文で出会う の文と日本語訳", url: SISTER_URL },
];

/** 自分：これまでの数（ほかの人とは比べない）、表示の設定、記録の書き出し・読み込み、姉妹アプリ、出典。 */
export default function Me() {
  const words = useWords();
  const chars = useChars();
  const { script, setScript, accent, setAccent, rate, setRate } = usePrefs();
  const voice = useKoreanVoice();
  const [dataNote, setDataNote] = useState<{ ok: boolean; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const readable = useMemo(() => {
    const collected = new Set((chars ?? []).map((c) => c.char));
    return collected.size ? discoverWords(collected, new Set((words ?? []).map(wordKey)), true).length : 0;
  }, [words, chars]);
  const edu = (chars ?? []).filter((c) => getCharData(c.char)?.edu).length;

  async function download() {
    const text = await exportBackup();
    const d = new Date();
    const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
    const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `kotonone-${stamp}.json`;
    document.body.append(a);
    a.click();
    a.remove();
    // すぐに手放すと保存が始まる前に消える端末がある。
    window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }

  async function upload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const list = parseBackup(await file.text());
    if (!list) {
      setDataNote({ ok: false, text: t.me.importFailed });
      return;
    }
    const { added, skipped } = await restoreWords(list);
    setDataNote({ ok: true, text: t.me.imported(added, skipped) });
  }

  return (
    <>
      <header className={app.subbar}>
        <h1 className={app.subtitleStrong}>{t.me.title}</h1>
      </header>
      <div className={`${app.bodyTight} ${styles.page}`}>
        <section className={app.stackSm}>
          <h2 className="label">{t.me.sofar}</h2>
          <dl className={app.stats}>
            <Stat label={t.me.stats.words} value={words?.length} unit="語" />
            <Stat label={t.me.stats.chars} value={chars?.length} unit="字" />
            <Stat label={t.me.stats.readable} value={words && chars ? readable : undefined} unit="語" />
            <Stat label={t.me.stats.edu} value={chars ? edu : undefined} unit="/ 1800" />
          </dl>
          <p className={app.note}>{t.me.sofarNote}</p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>{t.me.display}</h2>
          <div className={styles.field}>
            <span className="label" id="script-label">
              {t.me.script}
            </span>
            <div className={styles.segmented} role="radiogroup" aria-labelledby="script-label">
              {SCRIPTS.map((s) => (
                <label key={s} className={styles.segment}>
                  <input type="radio" name="script" checked={script === s} onChange={() => setScript(s)} />
                  {t.me.scripts[s]}
                </label>
              ))}
            </div>
            <p className={styles.preview}>
              <HanjaText ko="學生" />
              <HanjaText ko="會社" />
              <HanjaText ko="韓國語" />
            </p>
            <p className={app.note}>{t.me.scriptNote}</p>
          </div>

          <div className={styles.field}>
            <span className="label" id="accent-label">
              {t.me.accent}
            </span>
            <div className={styles.swatches} role="radiogroup" aria-labelledby="accent-label">
              {ACCENTS.map((a) => (
                <label key={a} className={styles.swatch}>
                  <input type="radio" name="accent" checked={accent === a} onChange={() => setAccent(a)} />
                  <span className={styles.dot} style={{ background: SWATCH[a] }} />
                  {t.me.accentNames[a]}
                </label>
              ))}
            </div>
          </div>

          {voice ? (
            <div className={styles.field}>
              <span className="label" id="rate-label">
                {t.me.rate}
              </span>
              <div className={styles.rateRow}>
                <div className={styles.segmented} role="radiogroup" aria-labelledby="rate-label">
                  {(["slow", "normal", "fast"] as RatePref[]).map((r) => (
                    <label key={r} className={styles.segment}>
                      <input type="radio" name="rate" checked={rate === r} onChange={() => setRate(r)} />
                      {t.me.rates[r]}
                    </label>
                  ))}
                </div>
                <SpeakButton text="학생" />
              </div>
              <p className={app.note}>{t.me.rateNote}</p>
            </div>
          ) : null}
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>{t.me.data}</h2>
          <p className={app.note}>{t.me.dataNote}</p>
          <div className={styles.dataRow}>
            <button type="button" className="btn-quiet" onClick={download} disabled={!words?.length}>
              <Icon name="download" size={18} />
              {t.me.export}
            </button>
            <button type="button" className="btn-quiet" onClick={() => fileRef.current?.click()}>
              <Icon name="upload" size={18} />
              {t.me.import}
            </button>
            <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={upload} />
          </div>
          {dataNote ? (
            <p className={dataNote.ok ? styles.saved : app.error} role="status">
              {dataNote.text}
            </p>
          ) : null}
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>{t.me.sister}</h2>
          <a href={SISTER_URL} className={styles.sister} target="_blank" rel="noopener">
            <img src={`${import.meta.env.BASE_URL}sister/kotonoame.png`} alt="" width={48} height={48} className={styles.sisterIcon} />
            <span className={styles.sisterText}>
              <span className={`wordmark-kana ${styles.sisterName}`}>{t.me.sisterName}</span>
              <span className={styles.sisterLead}>{t.me.sisterLead}</span>
            </span>
            <Icon name="arrow" size={18} />
          </a>
          <p className={app.note}>{t.me.sisterNote}</p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>{t.me.credits}</h2>
          <p className={app.note}>{t.me.creditsLead}</p>
          <ul className={styles.credits}>
            {CREDITS.map((c) => (
              <li key={c.name}>
                <a href={c.url} target="_blank" rel="noopener">
                  {c.name}
                </a>
                <span>
                  {c.by}・{c.license}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}

function Stat({ label, value, unit }: { label: string; value: number | undefined; unit: string }) {
  return (
    <div className={app.stat}>
      <dt>{label}</dt>
      <dd>
        {value ?? "…"}
        <small>{unit}</small>
      </dd>
    </div>
  );
}

import { useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { discoverWords, nearWords, unlockedBy, wordKey } from "../data/combine";
import { charToWords, getCharData } from "../data/dataset";
import type { WordData } from "../data/types";
import { t } from "../copy";
import { useChars, useSentences, useWords } from "../util/live";
import { sentenceScore, wordOf } from "../data/sentences";
import { usePrefs } from "../prefs";
import { Icon } from "../components/Icon";
import { SentenceRows } from "../components/SentenceView";
import { SpeakButton } from "../components/SpeakButton";
import { glossLang, WordRow } from "../components/WordRow";
import { WordSheet } from "../components/WordSheet";
import app from "../app.module.css";
import hs from "../components/hanja.module.css";
import styles from "./HanjaDetail.module.css";

type Word = Pick<WordData, "hangul" | "hanja" | "gloss">;

const PAGE = 20;

function decode(raw: string) {
  try {
    return decodeURIComponent(raw).normalize("NFC");
  } catch {
    return raw.normalize("NFC");
  }
}

/**
 * 一つの字：田字格に大きく、韓国語の音と日本語の読みを並べる。この字が入った集めた語、
 * この字で読める語、あと1字で読める語（この字を集めていなければ「この字があれば読める語」）。
 */
export default function HanjaDetail() {
  const params = useParams();
  const char = decode(params.char ?? "");
  const data = getCharData(char);
  const navigate = useNavigate();
  const location = useLocation();
  const { script } = usePrefs();
  const [sheet, setSheet] = useState<Word | null>(null);

  const words = useWords();
  const chars = useChars();
  const stat = chars && (chars.find((c) => c.char === char) ?? null);
  const mine = words?.filter((w) => w.chars.includes(char));

  const ownedKeys = useMemo(() => new Set((words ?? []).map(wordKey)), [words]);
  const collected = useMemo(() => new Set((chars ?? []).map((c) => c.char)), [chars]);
  const readable = useMemo(
    () => discoverWords(collected, ownedKeys, true).filter((w) => w.chars.includes(char)),
    [collected, ownedKeys, char]
  );
  const near = useMemo(
    () => nearWords(collected, ownedKeys).filter((n) => Array.from(n.word.hanja).includes(char)),
    [collected, ownedKeys, char]
  );

  // あと1字の語：足りない字と、あつめると増える読める語の数。
  function nearMeta(w: WordData, missing: string) {
    const more = unlockedBy(w, collected, ownedKeys).length;
    return more > 0 ? `${t.find.missingNote(missing)}・${t.gain.row(more)}` : t.find.missingNote(missing);
  }

  function back() {
    // ほかの画面から来たなら戻る。直接開いたなら漢字の一覧へ。
    if (location.key !== "default") navigate(-1);
    else navigate("/hanja");
  }

  const r = data?.readings[0];
  const jp = data?.jp && data.jp !== char ? data.jp : null;
  const glyph = script === "ja" && jp ? jp : char;
  const meaningJa = data?.meaning ? glossLang(data.meaning) === "ja" : false;
  const total = charToWords.get(char)?.length ?? 0;
  const others = Math.max(0, total - (mine?.length ?? 0) - readable.length - near.length);

  return (
    <>
      <header className={app.subbar}>
        <button type="button" className={app.iconLink} onClick={back} aria-label={t.common.back}>
          <Icon name="back" size={22} />
        </button>
        <h1 className={`${app.subtitleStrong} ${app.withBack}`}>
          <span className="hanja">{glyph}</span>
          {r ? (
            <span className={`t-ko ${styles.titleEum}`} lang="ko">
              {r.eum}
            </span>
          ) : null}
        </h1>
      </header>

      {!data ? (
        <div className={app.bodyTight}>
          <p className={app.lead}>{t.char.unknown(char)}</p>
        </div>
      ) : (
        <div className={`${app.bodyTight} ${app.split}`}>
          <div className={`${app.col} ${app.stick}`}>
            <section className={hs.hero}>
              <div className={hs.grid}>
                <span className={`hanja ${hs.gridGlyph}`}>{glyph}</span>
              </div>
              <dl className={hs.facts}>
                <div>
                  <dt>{t.char.korean}</dt>
                  <dd className={styles.eumRow}>
                    <span className={`t-ko ${hs.eum}`} lang="ko">
                      {r?.hun ? `${r.hun} ${r.eum}` : r?.eum}
                      {data.readings.length > 1 ? (
                        <span className={hs.eumMore}>
                          {data.readings
                            .slice(1)
                            .map((x) => x.eum)
                            .join("・")}
                        </span>
                      ) : null}
                    </span>
                    {r ? <SpeakButton text={r.eum} /> : null}
                  </dd>
                </div>
                {data.on?.length || data.kun?.length ? (
                  <div>
                    <dt>{t.char.japanese}</dt>
                    <dd className={styles.ja}>
                      {data.on?.length ? (
                        <span>
                          <small>{t.char.on}</small>
                          {data.on.join("・")}
                        </span>
                      ) : null}
                      {data.kun?.length ? (
                        <span>
                          <small>{t.char.kun}</small>
                          {data.kun.join("・")}
                        </span>
                      ) : null}
                    </dd>
                  </div>
                ) : null}
                {jp ? (
                  <div>
                    <dt>{script === "ja" ? t.char.koForm : t.char.jpForm}</dt>
                    <dd className={hs.factJp}>{script === "ja" ? char : jp}</dd>
                  </div>
                ) : null}
              </dl>
            </section>
            {data.meaning ? (
              <div className={styles.meaning}>
                <span className="label">{meaningJa ? t.char.meaning : t.char.meaningEn}</span>
                <p lang={meaningJa ? "ja" : "en"}>{data.meaning}</p>
              </div>
            ) : null}
            <div className={hs.tags}>
              {data.strokes ? <span className={hs.tag}>{t.char.strokes(data.strokes)}</span> : null}
              {data.edu ? <span className={`${hs.tag} ${hs.tagEdu}`}>{t.char.edu}</span> : null}
            </div>
            {stat === undefined ? null : stat ? (
              <p className={styles.owned}>{t.char.owned(stat.count, stat.firstAddedAt)}</p>
            ) : (
              <p className={app.note}>{t.char.notOwned}</p>
            )}
          </div>

          <div className={app.col}>
            {mine && mine.length > 0 ? (
              <List title={t.char.mine} count={mine.length}>
                {mine.map((w) => (
                  <WordRow key={w.id} word={w} meta={t.common.ago(w.addedAt)} onOpen={() => setSheet(w)} />
                ))}
              </List>
            ) : null}
            <CharSentences char={char} collected={collected} owned={ownedKeys} onOpen={setSheet} />
            {stat ? (
              <Paged title={t.char.readable} empty={t.char.readableNone} items={readable} render={(w) => (
                <WordRow key={wordKey(w)} word={w} onOpen={() => setSheet(w)} />
              )} />
            ) : null}
            <Paged title={t.char.near} empty={t.char.nearNone} items={near} render={(n) => (
              <WordRow
                key={wordKey(n.word)}
                word={n.word}
                missing={n.missing}
                meta={nearMeta(n.word, n.missing)}
                onOpen={() => setSheet(n.word)}
              />
            )} />
            {others > 0 ? <p className={app.note}>{t.char.others(others)}</p> : null}
          </div>
        </div>
      )}
      {sheet ? <WordSheet key={wordKey(sheet)} word={sheet} onClose={() => setSheet(null)} /> : null}
    </>
  );
}

function List({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <section>
      <div className={app.listHead}>
        <h2>{title}</h2>
        <span className={app.count}>{t.common.words(count)}</span>
      </div>
      <ul className={app.plainList}>{children}</ul>
    </section>
  );
}

function Paged<T>({
  title,
  empty,
  items,
  render,
}: {
  title: string;
  empty: string;
  items: T[];
  render: (item: T) => React.ReactNode;
}) {
  const [limit, setLimit] = useState(PAGE);
  return (
    <section className={styles.paged}>
      <div className={app.listHead}>
        <h2>{title}</h2>
        <span className={app.count}>{t.common.words(items.length)}</span>
      </div>
      {items.length === 0 ? (
        <p className={app.empty}>{empty}</p>
      ) : (
        <ul className={app.plainList}>{items.slice(0, limit).map(render)}</ul>
      )}
      {items.length > limit ? (
        <button type="button" className={app.more} onClick={() => setLimit((n) => n + PAGE)}>
          {t.common.more}（{items.length - limit}）
        </button>
      ) : null}
    </section>
  );
}

/** この字が出てくる文（ことのあめ の例文）。印の語を押すとその語が開く。 */
function CharSentences({
  char,
  collected,
  owned,
  onOpen,
}: {
  char: string;
  collected: Set<string>;
  owned: Set<string>;
  onOpen: (w: Word) => void;
}) {
  const data = useSentences();
  const [limit, setLimit] = useState(4);
  // 集めた語の入った文から（また出会う）。
  const ids = useMemo(() => {
    if (!data) return [];
    const list = data.byChar.get(char) ?? [];
    return [...list].sort((a, b) => sentenceScore(data.list[b], collected, owned) - sentenceScore(data.list[a], collected, owned));
  }, [data, char, collected, owned]);
  if (!data || ids.length === 0) return null;
  return (
    <section className={styles.paged}>
      <div className={app.listHead}>
        <h2>{t.char.inSentences}</h2>
        <span className={app.count}>{ids.length}</span>
      </div>
      <SentenceRows data={data} ids={ids.slice(0, limit)} collected={collected} owned={owned} onWord={(m) => onOpen(wordOf(m))} />
      {ids.length > limit ? (
        <button type="button" className={app.more} onClick={() => setLimit((n) => n + 8)}>
          {t.common.more}（{ids.length - limit}）
        </button>
      ) : null}
    </section>
  );
}

import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { wordKey } from "../data/combine";
import { charMap, eduChars, glyphOf } from "../data/dataset";
import type { HanjaCharData, WordData } from "../data/types";
import { t } from "../copy";
import type { CollectedChar } from "../db";
import { usePrefs } from "../prefs";
import { useChars, useWords } from "../util/live";
import { CharCard, CharCell } from "../components/CharCard";
import { Icon } from "../components/Icon";
import { Sprout } from "../components/Sprout";
import { WordSheet } from "../components/WordSheet";
import { compareKo, leadConsonant, leadOrder } from "../util/korean";
import app from "../app.module.css";
import hs from "../components/hanja.module.css";
import { Build } from "./Build";
import styles from "./Hanja.module.css";

type View = "mine" | "edu" | "build";
const VIEWS: View[] = ["mine", "edu", "build"];
type Sort = "count" | "recent" | "strokes";

const WEEK = 7 * 86_400_000;
const SEARCH_LIMIT = 60;

/** ひらがなをカタカナに（がく → ガク：日本語の音読みで探すため）。 */
function toKatakana(s: string) {
  return s.replace(/[ぁ-ゖ]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60));
}

/** 字を、字そのもの・日本の字・韓国語の音や訓・日本語の読みで探す。基礎漢字を先に、画数の少ない順。 */
function searchChars(q: string): HanjaCharData[] {
  const kata = toKatakana(q);
  const out: HanjaCharData[] = [];
  for (const c of charMap.values()) {
    if (
      c.char === q ||
      c.jp === q ||
      c.readings.some((r) => r.eum === q || r.hun === q) ||
      c.on?.includes(kata) ||
      c.kun?.includes(q)
    )
      out.push(c);
  }
  return out
    .sort((a, b) => Number(Boolean(b.edu)) - Number(Boolean(a.edu)) || (a.strokes || 99) - (b.strokes || 99))
    .slice(0, SEARCH_LIMIT);
}

/** 漢字：集めた字のカード（根の深さつき）、基礎漢字1800字の一覧、集めた字を並べて組み立てる。字・音・読みで探せる。 */
export default function Hanja() {
  const [params, setParams] = useSearchParams();
  const view: View = VIEWS.find((v) => v === params.get("view")) ?? "mine";
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("count");
  const chars = useChars();
  const words = useWords();
  const ownedKeys = useMemo(() => new Set((words ?? []).map(wordKey)), [words]);
  const [sheet, setSheet] = useState<Pick<WordData, "hangul" | "hanja" | "gloss"> | null>(null);
  const countByChar = useMemo(() => new Map((chars ?? []).map((c) => [c.char, c.count])), [chars]);
  const q = query.trim();
  const results = useMemo(() => (q ? searchChars(q) : []), [q]);

  return (
    <>
      <header className={app.subbar}>
        <h1 className={app.subtitleStrong}>{t.hanja.title}</h1>
        {chars?.length ? <span className={app.subCount}>{t.common.chars(chars.length)}</span> : null}
      </header>
      <div className={app.bodyTight}>
        <div className={app.tools}>
          <input
            type="search"
            className={app.search}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.hanja.search}
            aria-label={t.hanja.search}
          />
          {q ? null : (
            <nav className={app.views} aria-label={t.hanja.viewsLabel}>
              {VIEWS.map((v) => (
                <button
                  key={v}
                  type="button"
                  className={app.view}
                  aria-pressed={view === v}
                  onClick={() => setParams(v === "mine" ? {} : { view: v }, { replace: true })}
                >
                  {t.hanja.views[v]}
                </button>
              ))}
            </nav>
          )}
        </div>

        {q ? (
          results.length === 0 ? (
            <p className={app.empty}>{t.hanja.noMatch}</p>
          ) : (
            <ul className={hs.cards}>
              {results.map((c) => (
                <li key={c.char}>
                  <CharCard char={c.char} count={countByChar.get(c.char)} />
                </li>
              ))}
            </ul>
          )
        ) : chars === undefined ? null : view === "build" ? (
          <Build
            chars={[...chars].sort((a, b) => b.count - a.count).map((c) => c.char)}
            ownedKeys={ownedKeys}
            onOpen={setSheet}
          />
        ) : view === "edu" ? (
          <Edu countByChar={countByChar} />
        ) : chars.length === 0 ? (
          <div className={styles.empty}>
            <Sprout className={styles.sprout} />
            <p>{t.hanja.empty}</p>
            <Link to="/" className={app.quietAction}>
              <Icon name="collect" size={18} />
              {t.nav.collect}
            </Link>
          </div>
        ) : (
          <Mine chars={chars} sort={sort} onSort={setSort} />
        )}
      </div>
      {sheet ? <WordSheet key={wordKey(sheet)} word={sheet} onClose={() => setSheet(null)} /> : null}
    </>
  );
}

/** 集めた字：最近また出会った字、並べ替え、カード。 */
function Mine({ chars, sort, onSort }: { chars: CollectedChar[]; sort: Sort; onSort: (s: Sort) => void }) {
  const { script } = usePrefs();
  const now = Date.now();
  const again = chars
    .filter((c) => c.count >= 2 && c.lastAddedAt > c.firstAddedAt && now - c.lastAddedAt < WEEK)
    .sort((a, b) => b.lastAddedAt - a.lastAddedAt)
    .slice(0, 10);
  const sorted = [...chars].sort((a, b) => {
    if (sort === "recent") return b.firstAddedAt - a.firstAddedAt;
    if (sort === "strokes")
      return (charMap.get(a.char)?.strokes || 99) - (charMap.get(b.char)?.strokes || 99) || b.count - a.count;
    return b.count - a.count || b.lastAddedAt - a.lastAddedAt;
  });

  return (
    <>
      {again.length > 0 ? (
        <section className={app.stackSm}>
          <h2 className="label">{t.hanja.again}</h2>
          <ul className={hs.again}>
            {again.map((c) => (
              <li key={c.char}>
                <Link to={`/hanja/${encodeURIComponent(c.char)}`} className={hs.againCard}>
                  <span className={`hanja ${hs.againGlyph}`}>{glyphOf(c.char, script)}</span>
                  <span className={hs.againWhen}>
                    {t.common.ago(c.lastAddedAt)}・{t.hanja.depth(c.count)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <section className={app.stackSm}>
        <div className={app.filters} role="group" aria-label={t.hanja.sortLabel}>
          {(["count", "recent", "strokes"] as const).map((s) => (
            <button
              key={s}
              type="button"
              className={s === sort ? `${app.filter} ${app.filterOn}` : app.filter}
              aria-pressed={s === sort}
              onClick={() => onSort(s)}
            >
              {t.hanja.sorts[s]}
            </button>
          ))}
        </div>
        <ul className={hs.cards}>
          {sorted.map((c) => (
            <li key={c.char}>
              <CharCard char={c.char} count={c.count} />
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

/** 基礎漢字1800字を、韓国語の音の初声（ㄱ ㄴ ㄷ …）ごとに。集めた字は濃く。 */
function Edu({ countByChar }: { countByChar: Map<string, number> }) {
  const groups = useMemo(() => {
    const map = new Map<string, HanjaCharData[]>();
    for (const c of eduChars()) {
      const k = leadConsonant(c.readings[0]?.eum ?? "");
      (map.get(k) ?? map.set(k, []).get(k)!).push(c);
    }
    return [...map.entries()]
      .sort((a, b) => leadOrder(a[0]) - leadOrder(b[0]))
      .map(([key, list]) => ({
        key,
        list: list.sort(
          (a, b) => compareKo(a.readings[0]?.eum ?? "", b.readings[0]?.eum ?? "") || (a.strokes || 99) - (b.strokes || 99)
        ),
      }));
  }, []);
  const total = groups.reduce((n, g) => n + g.list.length, 0);
  const have = groups.reduce((n, g) => n + g.list.filter((c) => countByChar.has(c.char)).length, 0);

  return (
    <section className={app.stackSm}>
      <p className={app.lead}>{t.hanja.eduLead}</p>
      <div className={styles.progress}>
        <span className={styles.progressText}>{t.hanja.eduCount(have)}</span>
        <span className={styles.bar} aria-hidden="true">
          <span style={{ width: `${(have / Math.max(total, 1)) * 100}%` }} />
        </span>
      </div>
      {groups.map((g) => (
        <section key={g.key}>
          <h2 className={app.groupHead}>
            <span className={`t-ko ${styles.lead}`}>{g.key}</span>
            <small>{t.hanja.groupCount(g.list.filter((c) => countByChar.has(c.char)).length, g.list.length)}</small>
          </h2>
          <ul className={`${hs.cells} ${styles.cells}`}>
            {g.list.map((c) => (
              <li key={c.char}>
                <CharCell char={c.char} owned={countByChar.has(c.char)} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </section>
  );
}

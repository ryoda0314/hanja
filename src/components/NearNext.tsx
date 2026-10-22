import { useMemo } from "react";
import { nearWords, wordKey } from "../data/combine";
import { splitHanja } from "../data/dataset";
import type { WordData } from "../data/types";
import { t } from "../copy";
import app from "../app.module.css";
import { WordRow } from "./WordRow";

/**
 * 読める語がまだ増えなかったときの次の一手：この語の字が入っていて、あと1字で読める語。
 * 多くの語に効く字（その字に出会うと読める語がまとめて増える字）の語から並べる。
 */
export function NearNext({
  hanja,
  collected,
  owned,
  onOpen,
  limit = 3,
}: {
  hanja: string;
  collected: Set<string>;
  owned: Set<string>;
  onOpen: (w: Pick<WordData, "hangul" | "hanja" | "gloss">) => void;
  limit?: number;
}) {
  const rows = useMemo(() => {
    const mine = new Set(splitHanja(hanja));
    const near = nearWords(collected, owned).filter((n) => splitHanja(n.word.hanja).some((c) => mine.has(c)));
    const weight = new Map<string, number>();
    for (const n of near) weight.set(n.missing, (weight.get(n.missing) ?? 0) + 1);
    // nearWords は読みやすい順。並べ替えは安定なので、同じ重みの中ではその順のまま。
    return [...near].sort((a, b) => (weight.get(b.missing) ?? 0) - (weight.get(a.missing) ?? 0)).slice(0, limit);
  }, [hanja, collected, owned, limit]);

  if (rows.length === 0) return null;
  return (
    <section>
      <h3 className="label">{t.gain.next}</h3>
      <ul className={app.plainList}>
        {rows.map((n) => (
          <WordRow
            key={wordKey(n.word)}
            word={n.word}
            missing={n.missing}
            meta={t.find.missingNote(n.missing)}
            onOpen={() => onOpen(n.word)}
          />
        ))}
      </ul>
    </section>
  );
}

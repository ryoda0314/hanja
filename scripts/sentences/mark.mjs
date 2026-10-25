// 例文の漢字語に印を付ける（build-sentences.mjs と、ことのね のために書いた文の確かめ check.mjs で使う）。
//
// 印の付け方:
//   1. 語節（ハングルの続き）の頭から、辞書にある2音節以上の語のうち最も長いものを探す（助詞・語尾は後ろに付く）。
//      残りの頭にも2音節以上の語があれば続けて探す（여자친구 → 여자・친구）。
//   2. 固有語の取り違え（고양이 の 고양、여기、일어나다 の 일어 …）は decisions.json の skip で先に外す。
//   3. 文に語の漢字表記が添えてあれば（ことのね のために書いた文の words）、それに従う。
//   4. 日本語訳に字が出てくる候補があれば、出てくる字の多い語を選ぶ（수업 → 授業、내일 → 來日 の 日）。
//   5. 訳に字が出てこない語（친구 親舊＝友達 など）は decisions.json の決定に従う。決まっていなければ印を付けない。

/**
 * @param {{ words: {hangul:string, hanja:string}[], chars: {char:string, jp?:string}[], decisions: any }} data
 */
export function createMarker({ words, chars, decisions }) {
  const decided = decisions.words ?? {};
  const skipExact = new Set(decisions.skip?.exact ?? []);
  const skipPrefix = decisions.skip?.prefix ?? [];
  // 例文では選ばない漢字表記。除いた結果、候補の無くなった読みは辞書に無いものとして、より短い語を探す（거절당 → 거절）。
  const excluded = new Set(decisions.exclude ?? []);
  const jpOf = new Map(chars.map((c) => [c.char, c.jp ?? c.char]));
  const byHangul = new Map();
  // 文に添えた漢字表記は、除いた表記でもよい（영상 の 零上 は、気温の文で書き手が選んだときだけ）。
  const listed = new Set();
  for (const w of words) {
    listed.add(`${w.hangul}|${w.hanja}`);
    if (Array.from(w.hangul).length < 2 || excluded.has(w.hanja)) continue;
    if (!byHangul.has(w.hangul)) byHangul.set(w.hangul, []);
    byHangul.get(w.hangul).push(w);
  }
  const maxLen = Math.max(...[...byHangul.keys()].map((k) => k.length));

  /** 語節の頭から、辞書にある最も長い語（2音節以上）。文に漢字表記を添えた語は、除いた表記しかない語でも探す（제시 の 提示）。 */
  function headWord(text, own) {
    for (let len = Math.min(maxLen, text.length); len >= 2; len--) {
      const head = text.slice(0, len);
      if (byHangul.has(head) || (own?.[head] && listed.has(`${head}|${own[head]}`))) return head;
    }
    return null;
  }

  /** 日本語訳に、候補の日本の字がいくつ出てくるか。 */
  function overlap(hanja, ja) {
    return Array.from(hanja).filter((c) => ja.includes(jpOf.get(c) ?? c)).length;
  }

  /**
   * 語の漢字表記を選ぶ。hanja：null は印を付けない、undefined はまだ決めていない。
   * by：own（文に添えた表記）・ja（日本語訳）・decision（decisions.json）・pending（まだ）。
   */
  function choose(hangul, s) {
    const cands = byHangul.get(hangul) ?? [];
    const own = s.words?.[hangul];
    if (own !== undefined) {
      if (own !== null && !listed.has(`${hangul}|${own}`)) throw new Error(`「${s.ko}」の ${hangul} の ${own} は辞書にありません`);
      return { hanja: own, by: "own" };
    }
    const scored = cands
      .map((w) => ({ w, hit: overlap(w.hanja, s.ja) }))
      .sort((a, b) => b.hit - a.hit || a.w.hanja.localeCompare(b.w.hanja));
    if (scored[0].hit > 0) return { hanja: scored[0].w.hanja, by: "ja" };
    if (hangul in decided) {
      const d = decided[hangul];
      if (d !== null && !cands.some((w) => w.hanja === d)) throw new Error(`decisions.json: ${hangul} の ${d} は辞書にありません`);
      return { hanja: d, by: "decision" };
    }
    return { hanja: undefined, by: "pending" };
  }

  /** 文の印 [start, end, 漢字] と、語ごとの選び方。 */
  function mark(s) {
    const marks = [];
    const found = [];
    for (const m of s.ko.matchAll(/[가-힣]+/g)) {
      const run = m[0];
      if (skipExact.has(run) || skipPrefix.some((p) => run.startsWith(p))) continue;
      let at = 0;
      while (at < run.length - 1) {
        const hangul = headWord(run.slice(at), s.words);
        if (!hangul) break;
        const { hanja, by } = choose(hangul, s);
        found.push({ hangul, hanja, by });
        if (hanja) marks.push([m.index + at, m.index + at + hangul.length, hanja]);
        at += hangul.length;
      }
    }
    return { marks, found };
  }

  return { mark, byHangul };
}

// ハングルの漢字語を「漢字 + 意味 + 構成漢字の読み」に解決する。
//   ① 種語彙（バンドルデータ）から照合
//   ② （将来）国立国語院 Open API でオンライン解決 ← Phase 2 で追加
//   ③ 漢字テーブルで各構成字の音訓を付与
// 現状は ①③ のみ。オンライン解決は resolveOnline() のスタブとして用意。

import { charMap, hangulToWords, hanjaToWords, jpToKo, splitHanja } from "./dataset";
import type { ResolvedWord, WordData } from "./types";

/** WordData に構成漢字とその読みを付与して ResolvedWord にする。 */
export function enrich(word: WordData, source: ResolvedWord["source"]): ResolvedWord {
  const chars = splitHanja(word.hanja);
  const charData = chars
    .map((ch) => charMap.get(ch))
    .filter((c): c is NonNullable<typeof c> => c != null);
  return { ...word, chars, charData, source };
}

/**
 * ハングル語をローカルの種語彙から解決する。見つからなければ null。
 * 同音異義語が複数ある場合は最初の1件を返す（UI 側で候補提示する拡張余地あり）。
 */
export function resolveLocal(hangul: string): ResolvedWord | null {
  const trimmed = hangul.trim();
  const matches = hangulToWords.get(trimmed);
  if (!matches || matches.length === 0) return null;
  return enrich(matches[0], "seed");
}

/** よく使う語ほど小さい（한국어기초사전 の 초급 → 중급 → 고급 → 等級なし → 載っていない語）。 */
export function commonRank(w: Pick<WordData, "lv">): number {
  return w.lv ?? 5;
}

/** よく使う語を先に（同じ読み・同じ字の候補を並べるとき）。 */
const byCommon = (a: WordData, b: WordData) => commonRank(a) - commonRank(b);

/** ローカルの全候補を返す（同音異義語対応。よく使う語が先）。 */
export function resolveLocalAll(hangul: string): ResolvedWord[] {
  const matches = hangulToWords.get(hangul.trim()) ?? [];
  return [...matches].sort(byCommon).map((w) => enrich(w, "seed"));
}

// 語のあとに付く形（하다・합니다・하세요 …、助詞）。長いものから試す。
const ENDINGS = [
  "하셨습니다", "하겠습니다", "했습니다", "하십시오", "하셨어요", "하세요", "합니다", "했어요", "해요", "하다", "하고", "하는", "한다", "했다", "해서", "해", "한", "할",
  "스럽다", "스러운", "롭다", "로운", "적으로", "적인", "입니다", "이에요", "예요", "이다", "에서", "에게", "으로", "히", "은", "는", "이", "가", "을", "를", "에", "의", "도", "로", "과", "와", "님", "들",
];

/**
 * 辞書にそのままでは無いハングルの、語の部分（안녕하세요 → 안녕、감사합니다 → 감사、공부했어요 → 공부）。
 * 語尾や助詞を外すと辞書の漢字語になるときだけ、その語と候補を返す。
 */
export function resolveStem(input: string): { stem: string; words: ResolvedWord[] } | null {
  const q = input.trim().replace(/\s+/g, "");
  if (!/^[가-힣]+$/.test(q) || hangulToWords.has(q)) return null;
  for (const end of ENDINGS) {
    if (!q.endsWith(end) || q.length - end.length < 1) continue;
    const stem = q.slice(0, q.length - end.length);
    const words = resolveLocalAll(stem);
    if (words.length) return { stem, words };
  }
  return null;
}

/** 漢字だけでできた入力か（학생 ではなく 學生・学生 と打ったか）。 */
export function isHanjaInput(input: string): boolean {
  const chars = Array.from(input.trim());
  return chars.length > 0 && chars.every((c) => /\p{Script=Han}/u.test(c));
}

/**
 * 漢字で打った語を引く。日本の字（学生）で打っても、韓国の字（學生）の語が見つかる。
 * 字ごとに日本の字→韓国の字の候補を広げ、辞書にある表記だけを返す。
 */
export function resolveByHanja(input: string): ResolvedWord[] {
  if (!isHanjaInput(input)) return [];
  let forms = [""];
  for (const c of Array.from(input.trim().normalize("NFC"))) {
    const options = [c, ...(jpToKo.get(c) ?? [])];
    forms = forms.flatMap((f) => options.map((o) => f + o)).slice(0, 64);
  }
  return [...new Set(forms)]
    .flatMap((f) => hanjaToWords.get(f) ?? [])
    .sort(byCommon)
    .map((w) => enrich(w, "seed"));
}

/**
 * 辞書に無い語（한국인 など）の漢字を、集めた字から組み立てて提案する。音節ごとにその音で読む字を探し、
 * 組み合わせを最大 limit 個返す（集めた字の並び順＝よく出会う字が先）。どこかの音節で見つからなければ空。
 */
export function guessHanja(hangul: string, collected: readonly string[], limit = 4): string[] {
  const syllables = Array.from(hangul.trim().replace(/\s+/g, ""));
  if (syllables.length === 0 || !syllables.every((s) => /^[가-힣]$/.test(s))) return [];
  const bySound = new Map<string, string[]>();
  for (const c of collected) {
    for (const r of charMap.get(c)?.readings ?? []) {
      const list = bySound.get(r.eum) ?? [];
      if (!list.includes(c)) list.push(c);
      bySound.set(r.eum, list);
    }
  }
  let forms = [""];
  for (const s of syllables) {
    const options = bySound.get(s);
    if (!options) return [];
    forms = forms.flatMap((f) => options.map((o) => f + o)).slice(0, 64);
  }
  return forms.slice(0, limit);
}

/**
 * オンライン辞書（国立国語院 Open API）による解決のスタブ。
 * Phase 2 で実装予定。現状は常に null を返す。
 */
export async function resolveOnline(_hangul: string): Promise<ResolvedWord | null> {
  return null;
}

/**
 * ユーザーが手入力した漢字表記から ResolvedWord を作る（辞書に無い語の手動登録用）。
 */
export function resolveManual(hangul: string, hanja: string, gloss: string): ResolvedWord {
  return enrich(
    { hangul: hangul.trim(), hanja: hanja.trim().normalize("NFC"), gloss: gloss.trim() },
    "manual"
  );
}

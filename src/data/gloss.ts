// 語の意味の書き方。한국어기초사전 の日本語の対訳は「よみ【表記】」の形で持つ（例: じどう【児童】、がくせい【学生】）。
// ふだんは表記を出す。漢字を伏せている間（まだ集めていない語）は、その語の字が入った対訳だけ よみ で出し、意味は伝えて字は見せない。
// 英語の意味（한국어기초사전 に無い語）や手で書いた意味は、そのまま。

import { jpForm, splitHanja } from "./dataset";

const ITEM = /([^、【】]+)【([^【】]+)】/g;

/** ふだんの意味：よみ【表記】を表記に。 */
export function glossText(gloss: string): string {
  return gloss.replace(ITEM, "$2");
}

/**
 * 漢字を伏せている間の意味：語の字（韓国の字・日本の字）が入った対訳は よみ で出す。
 * それでも字が見えてしまう意味（英語の意味の中の漢字など）は null（出さない）。
 */
export function maskedGlossText(gloss: string, hanja: string): string | null {
  const chars = new Set([...splitHanja(hanja), ...splitHanja(jpForm(hanja))]);
  const spoils = (s: string) => splitHanja(s).some((c) => chars.has(c));
  const text = gloss.replace(ITEM, (_, reading: string, written: string) => (spoils(written) ? reading : written));
  return spoils(text) ? null : text;
}

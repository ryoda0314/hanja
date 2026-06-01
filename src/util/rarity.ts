// コレクションカードのレア度。漢字の画数で決まる（複雑な字ほど高レア）。
// カード地は全レア共通の落ち着いたグラファイト。レア感は「星の金属色」と
// 「ごく薄い縁色」だけで上品に差をつける（けばけばしい全面グラデは使わない）。

export type RarityId = "common" | "uncommon" | "rare" | "epic" | "legendary";

export interface Rarity {
  id: RarityId;
  /** ★の数（1〜5） */
  stars: number;
  /** レア度名（日本語） */
  label: string;
  /** カードの縁（共通の地色に薄い色味を足すだけ） */
  borderClass: string;
  /** ★の金属色アクセント */
  accentClass: string;
  /** 最上位だけ薄い光沢 */
  holo: boolean;
}

const RARITIES: Record<RarityId, Rarity> = {
  common: { id: "common", stars: 1, label: "コモン", borderClass: "border-white/10", accentClass: "text-slate-400", holo: false },
  uncommon: { id: "uncommon", stars: 2, label: "アンコモン", borderClass: "border-emerald-300/20", accentClass: "text-emerald-300/90", holo: false },
  rare: { id: "rare", stars: 3, label: "レア", borderClass: "border-sky-300/25", accentClass: "text-sky-300/90", holo: false },
  epic: { id: "epic", stars: 4, label: "エピック", borderClass: "border-violet-300/30", accentClass: "text-violet-300/90", holo: false },
  legendary: { id: "legendary", stars: 5, label: "レジェンダリー", borderClass: "border-amber-300/40", accentClass: "text-amber-300", holo: true },
};

/** 画数からレア度を決める。 */
export function rarityByStrokes(strokes: number): Rarity {
  if (!strokes || strokes <= 0) return RARITIES.common;
  if (strokes <= 6) return RARITIES.common;
  if (strokes <= 10) return RARITIES.uncommon;
  if (strokes <= 13) return RARITIES.rare;
  if (strokes <= 17) return RARITIES.epic;
  return RARITIES.legendary;
}

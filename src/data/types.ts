// アプリ全体で使うドメイン型。
// バンドルされた読み取り専用データ（hanja-chars.json / seed-words.json）と
// Dexie に保存するユーザーデータの両方で共有する。

/** 漢字1文字の読み（훈음）。hun = 訓（意味の韓国語）, eum = 音（ハングル音読み）。 */
export interface Reading {
  /** 訓: 漢字の意味を表す韓国語の語（例: 學 → "배울"）。自動生成データには無いことがある。 */
  hun?: string;
  /** 音: 漢字のハングル音読み（例: 學 → "학"） */
  eum: string;
}

/** 漢字1文字の辞書エントリ（バンドルデータの静的部分）。 */
export interface HanjaCharData {
  /** 漢字1文字（韓国＝正字・旧字体ベース）。例: "學" */
  char: string;
  /** 日本の新字体（字形が異なる場合のみ）。例: 學→"学"。同形なら未設定。 */
  jp?: string;
  /** 読み（훈음）。複数音を持つ字もあるため配列。 */
  readings: Reading[];
  /** 日本語での簡単な意味。例: "学ぶ" */
  meaning: string;
  /** 画数（おおよそ）。 */
  strokes: number;
}

/** 漢字語（한자어）1語の辞書エントリ（バンドルデータの静的部分）。 */
export interface WordData {
  /** ハングル表記。例: "학생" */
  hangul: string;
  /** 韓国の漢字表記（旧字体ベース）。例: "學生" */
  hanja: string;
  /** 日本の漢字表記（新字体。字形が異なる場合のみ）。例: 會社→"会社"。同形なら未設定。 */
  hanjaJp?: string;
  /** 意味（日本語優先、無ければ英語）。例: "学生" */
  gloss: string;
}

/** 解決済みの漢字語（語 + 構成漢字の読み付き）。resolver の出力。 */
export interface ResolvedWord extends WordData {
  /** 構成漢字（hanja を1文字ずつ分解。CJK 以外は除外）。 */
  chars: string[];
  /** chars に対応する読み情報（辞書にあるもののみ）。 */
  charData: HanjaCharData[];
  /** 解決元: seed=種データ, api=オンライン辞書, manual=手動入力。 */
  source: "seed" | "api" | "manual";
}

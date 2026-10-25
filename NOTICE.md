# データの出典とライセンス

本アプリ（ことのね）のバンドル辞書データ（`public/data/words.json`, `public/data/hanja-chars.json`）は、
以下の公開データから `scripts/build-data.mjs` で生成しています。語の意味は、1 の日本語の対訳 → 6 の手作業の日本語訳 →
2 の日本語の同じ漢字の語 → 3 の英語、の順に使います。各ライセンスの帰属表示義務を
満たすため、ここに出典を明記します。

## 1. 한국어기초사전（韓国語基礎辞典：語の日本語の対訳）

- 出典: 国立国語院 한국어기초사전, https://krdict.korean.go.kr
  （取得元: 2019年8月の全体の書き出し XML の写し https://github.com/spellcheck-ko/korean-dict-nikl-krdict ）
- ライセンス: **CC BY-SA 2.0 KR**（저작자표시-동일조건변경허락 2.0 대한민국）
- 原語（漢字）の付いた見出しの、日本語の対訳（「よみ【表記】」、はじめの3つの意味から4つまで）を、
  ハングル・漢字が同じ語の意味として使います（派生物。CC BY-SA の継承条件に留意すること）。
  kengdic に英語の意味が無い語も、ここに日本語の対訳があれば収録します。

## 2. JMdict（日本語の同じ漢字の語）

- 出典: JMdict — Electronic Dictionary Research and Development Group（EDRDG）, https://www.edrdg.org/
  （取得元: jmdict-simplified の JSON https://github.com/scriptin/jmdict-simplified ）
- ライセンス: **CC BY-SA 4.0**（EDRDG の辞書ファイルのライセンス規定に従う）
- 1 に無い語で、日本語にも同じ漢字（新字体）の語があれば、その語（よみ【表記】）を意味として使います。
  同じ漢字の語がいくつかあれば、kengdic の英語の意味といちばん重なる語。1字の語は英語の意味が重なるときだけ。
  This publication has included material from the JMdict (EDICT, etc.) dictionary files in accordance with
  the licence provisions of the Electronic Dictionaries Research Group.

## 3. kengdic（漢字語リスト：ハングル・漢字・語義）

- 出典: Kengdic — Joe Speigle / Nathan Glenn, https://github.com/garfieldnate/kengdic
- ライセンス: デュアル — **MPL 2.0** または **LGPL 2.0+**、辞書本体は **CC-BY-SA 3.0**
- 本アプリは kengdic からハングル・漢字・英語語義を抽出し、純粋な漢字語（1音節=1漢字）のみを
  フィルタして再配布しています（派生物）。CC-BY-SA 3.0 の継承条件に留意すること。

## 4. Unicode Unihan Database（漢字の意味・画数・読み）

- 出典: Unicode Character Database — Unihan, https://www.unicode.org/charts/unihan.html
- ライセンス: Unicode License v3（寛容、帰属表示で再配布可）
- `kDefinition`（英語の意味）、`kTotalStrokes`（画数）、`kHangul`（韓国の標準の読みと、基礎漢字1800字＝교육용 기초 한자 の印 E）、
  `kJapanese`（日本語の音読み・訓読み）を利用。

## 5. kyujitai（旧字体↔新字体 対応）

- 出典: kyujitai (npm package) — hakatashi, https://github.com/hakatashi/kyujitai.js
- ライセンス: **MIT**
- `kyuji` テーブル（[新字体, 旧字体, IVS]）から「韓国漢字＝旧字体 → 日本漢字＝新字体」マップを構築し、
  各語・各漢字に日本の新字体表記（`hanjaJp` / `jp`）を付与（349字が変換対象）。

## 6. 手作業キュレーション（音訓・日本語訳）

- `src/data/curated-chars.json` / `src/data/curated-words.json` は本プロジェクト独自に作成。
- 生成時に上記データへ**優先マージ**され、主要漢字の훈음（例: 學「배울 학」）と日本語訳を付与する。

## 7. ことのあめ の例文（文で出会う）

- 出典: 姉妹アプリ ことのあめ（同じ作者）の例文ライブラリ（韓国語の文と日本語訳）。
- `public/data/sentences.json` は、その文に `scripts/build-sentences.mjs` と `scripts/sentences/decisions.json` で漢字語の印を付けたもの。
  漢字語の判定には上の辞書データ（kengdic・Unihan・kyujitai）を使う。

## 8. FrequencyWords（語をよく使うか）

- 出典: FrequencyWords — Hermit Dave, https://github.com/hermitdave/FrequencyWords
  （OpenSubtitles 2018 の韓国語字幕から数えた語の頻度。`content/2018/ko/ko_full.txt`）
- ライセンス: **CC BY-SA 4.0**（内容）
- 語節の数から語尾・助詞を外して語ごとにまとめ、`words.json` の `fq`（100万語あたりの回数）にしています（派生物）。
  등급 の無い語のうち、字幕でほとんど使わない語は、読める語・あと1字で読める語として勧めません。

## 将来利用予定（Phase 2・オンライン解決）

| データ | 用途 | 出典 | 備考 |
|---|---|---|---|
| 国立国語院 한국어기초사전 / 표준국어대사전 / 우리말샘 Open API | 未収録語のオンライン解決 | https://www.data.go.kr / https://krdict.korean.go.kr | 無料APIキー要・利用条件と出典明記が必要 |

> ⚠️ 配布形態（特に CC-BY-SA の継承）について、公開・ストア申請前に最終確認すること。

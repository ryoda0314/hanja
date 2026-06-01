# データの出典とライセンス

本アプリのバンドル辞書データ（`public/data/words.json`, `public/data/hanja-chars.json`）は、
以下の公開データから `scripts/build-data.mjs` で生成しています。各ライセンスの帰属表示義務を
満たすため、ここに出典を明記します。

## 1. kengdic（漢字語リスト：ハングル・漢字・語義）

- 出典: Kengdic — Joe Speigle / Nathan Glenn, https://github.com/garfieldnate/kengdic
- ライセンス: デュアル — **MPL 2.0** または **LGPL 2.0+**、辞書本体は **CC-BY-SA 3.0**
- 本アプリは kengdic からハングル・漢字・英語語義を抽出し、純粋な漢字語（1音節=1漢字）のみを
  フィルタして再配布しています（派生物）。CC-BY-SA 3.0 の継承条件に留意すること。

## 2. Unicode Unihan Database（漢字の意味・画数）

- 出典: Unicode Character Database — Unihan, https://www.unicode.org/charts/unihan.html
- ライセンス: Unicode License v3（寛容、帰属表示で再配布可）
- `kDefinition`（英語の意味）と `kTotalStrokes`（画数）を利用。

## 3. kyujitai（旧字体↔新字体 対応）

- 出典: kyujitai (npm package) — hakatashi, https://github.com/hakatashi/kyujitai.js
- ライセンス: **MIT**
- `kyuji` テーブル（[新字体, 旧字体, IVS]）から「韓国漢字＝旧字体 → 日本漢字＝新字体」マップを構築し、
  各語・各漢字に日本の新字体表記（`hanjaJp` / `jp`）を付与（349字が変換対象）。

## 4. 手作業キュレーション（音訓・日本語訳）

- `src/data/curated-chars.json` / `src/data/curated-words.json` は本プロジェクト独自に作成。
- 生成時に上記データへ**優先マージ**され、主要漢字の훈음（例: 學「배울 학」）と日本語訳を付与する。

## 将来利用予定（Phase 2・オンライン解決）

| データ | 用途 | 出典 | 備考 |
|---|---|---|---|
| 国立国語院 한국어기초사전 / 표준국어대사전 / 우리말샘 Open API | 未収録語のオンライン解決・日本語訳 | https://www.data.go.kr / https://krdict.korean.go.kr | 無料APIキー要・利用条件と出典明記が必要 |

> ⚠️ 配布形態（特に CC-BY-SA の継承）について、公開・ストア申請前に最終確認すること。

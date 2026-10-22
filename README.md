# ことのね（旧 한자 도감）

覚えた韓国語を、漢字の根でつなぐ。韓国語の漢字語を自分の指で打つと、漢字の根に分かれ（學 학 ガク）、前に集めた語と
つながり、集めた字だけで読める語が見つかる学習アプリ。姉妹アプリ [ことのあめ](https://polylinga.app) と同じ紙と墨の画面。
思想は [CONCEPT.md](CONCEPT.md)。

Web（PWA）→ iOS の順で展開する計画です（React + Capacitor）。

## 画面

| タブ | 中身 |
|---|---|
| あつめる `/` | 覚えた語を打つ（ハングル、または 學生・学生 のような漢字）。根に分けて見せ、「あつめると読める語が◯語増えます」。あつめると「+◯語」を数え上げで大きく、新しく読めるようになった語、「はじめての字／また出会った字」、前の語とのつながり。増えないうちは「次に出会うと読める語」。辞書に無い語は手で登録（漢字は集めた字の音から組み立てた候補も出す） |
| 見つける `/find` | 文で出会う（ことのあめ の例文が4文ずつ降ってくる。文の中の漢字語は、集めた語＝紫の点線・集めた字で読める語・まだの語で印が変わり、上に漢字を添えられる。押すとその語が開く）／読んでみる（漢字だけ見せて、字の音をつなげてハングルで打つ。読めたら集まる）／読める語／あと1字で読める語（あつめると +◯語） |
| ことば `/words` | 集めた語。探す・字数・新しい順／가나다順 |
| 漢字 `/hanja` | 集めた字のカード（根の深さ）、基礎漢字1800字の一覧、集めた字を並べて組み立てる。字のページ `/hanja/:char` は田字格に大きく、韓国語の音・日本語の音訓・日本の字、この字が出てくる文 |
| 自分 `/me` | これまでの数、表示（字形・アクセント・読み上げの速さ）、書き出し・読み込み、姉妹アプリ、出典 |

語はどこからでもシートで開ける（この語が出てくる文つき）。まだ集めていない語は、漢字を ？？ で伏せて見せる（シートと、文の上に添える漢字）。
ハングルを自分の指で打ってあつめると、答え合わせとして漢字が開き、根が伸びる（ボタン一つでは集めない）。

## 技術スタック

- Vite + React 19 + TypeScript、CSS Modules（ことのあめ と同じトークンとクラス名。`src/index.css` と `src/app.module.css`）
- React Router（`createHashRouter` — Capacitor の file:// でも動作。戻ったときはスクロール位置を戻す）
- Dexie.js（IndexedDB）で端末内保存・オフライン完結
- vite-plugin-pwa（Service Worker・インストール対応）
- Vitest（ユニットテスト）
- 読み上げは端末の韓国語の声（Web Speech API）。声が無い端末ではボタンを出さない

## 開発

```bash
npm install
npm run dev        # 開発サーバ（http://localhost:5173, SW は無効）
npm run build      # 本番ビルド（型チェック + Vite build + PWA 生成）
npm run preview    # 本番ビルドを配信（PWA のインストール/オフライン確認はこちら）
npm run test       # ユニットテスト
npm run typecheck  # 型チェックのみ
```

## ディレクトリ構成

```
src/
  copy.ts              画面の文言（ことのあめ の i18n/ja.ts と同じ書き方）。名前を変えるときもここ
  index.css            色・書体のトークン、共通のボタン（.btn / .btn-quiet）
  app.module.css       殻・上のバー・罫線の一覧・絞り込み・見方の切り替え・左右分割（720 / 1024 / 1280 px）
  prefs.tsx            字形（韓国の字・日本の字・両方）、アクセント、読み上げの速さ（localStorage）
  db.ts                Dexie 定義（v2 で互換漢字を統合漢字にそろえる移行）、収集、書き出し・読み込み
  data/
    dataset.ts         curated を即時ロード + public/data/* を起動時 fetch。逆引き・日本の字 → 韓国の字
    resolver.ts        ハングル／漢字（新字体も）→ 漢字語。辞書に無い語の漢字を集めた字から組み立てる
    combine.ts         読める語・あと1字で読める語・あつめると読めるようになる語・次に出会うと効く字・組み立て
    reading.ts         読んでみる の答え合わせ（音節ごと、字のふだんの音とこの語での音の違い）と出す語の選び方
    sentences.ts       文で出会う の例文（使う画面で一度だけ読む）、印の語の見分け、ひと雨の選び方、音声の場所
  components/          BottomNav / Logo / Icon / Sheet / WordSheet / Roots（根に分けた並び）/ CharCard / …
  pages/               Collect / Find（Meet＝文で出会う、TryRead＝読んでみる）/ Words / Hanja（Build＝組み立てる）/ HanjaDetail / Me
public/data/           生成された辞書（words.json 約16,600語 / hanja-chars.json 約3,400字）と例文（sentences.json）
public/icons/          アプリアイコン（scripts/icon から書き出し）
scripts/
  build-data.mjs       kengdic + Unihan + kyujitai + curated → public/data/words.json・hanja-chars.json を生成
  build-sentences.mjs  ことのあめ の例文に漢字語の印を付けて public/data/sentences.json を生成
  export-sentences.mjs ことのあめ の査読済みの文を書き出す（公開の鍵で読むだけ）
  sentences/           decisions.json（印の決定）・review.json（まだ決めていない語）
  icon/                アイコンの元絵（icon.svg）と書き出し（render.mjs、ヘッドレス Chrome）
```

## 辞書データの生成

バンドル辞書は公開データから生成します（`public/data/*.json` は生成物としてコミット）。

```bash
# 1) 生成元を scripts/.cache に取得（この環境では codeload 経由）
mkdir -p scripts/.cache
curl -L -o /tmp/k.zip https://codeload.github.com/garfieldnate/kengdic/zip/refs/heads/master
unzip -j /tmp/k.zip '*/kengdic.tsv' -d scripts/.cache
curl -L -o /tmp/uh.zip https://www.unicode.org/Public/UCD/latest/ucd/Unihan.zip
unzip -j /tmp/uh.zip Unihan_Readings.txt Unihan_IRGSources.txt -d scripts/.cache
curl -L -o scripts/.cache/kyujitai.json https://unpkg.com/kyujitai@1.3.0/data/kyujitai.json

# 2) 生成
npm run build:data
```

- kengdic の互換漢字（年 U+F98E =연 のような読み別の重複コード）は NFC で統合漢字にそろえる。字の読みは
  韓国の標準の読み（Unihan kHangul）を先に、頭音法則の形（年 → 연）を後ろに。
- 基礎漢字1800字（교육용 기초 한자）の印は kHangul の E。辞書が異体字で収録している字（強 → 强 など）は、読みと意味が同じ字に印を移す。
- 日本語の音読み・訓読みは Unihan kJapanese（よく使う読みから3つまで）。

出典・ライセンスは [NOTICE.md](./NOTICE.md) を参照（kengdic: MPL2.0/LGPL/CC-BY-SA、Unihan: Unicode License）。

## 例文の生成（文で出会う）

例文は姉妹アプリ ことのあめ の例文ライブラリ（韓国語＋日本語訳）から作ります。

```bash
# 査読済みの文（音声あり）：ことのあめ の公開の値（NEXT_PUBLIC_SUPABASE_URL / ANON_KEY）で読むだけ
node --env-file=<ことのあめ>/.env.local scripts/export-sentences.mjs
node scripts/build-sentences.mjs

# または、ことのあめ のリポジトリの作業ファイルから（AI の下書き。捨てた下書きは除く・査読前の文を含む）
node scripts/build-sentences.mjs --kotonoame <ことのあめ のリポジトリ>
```

- 語節の頭から辞書の語（2音節以上）を最長一致で探し、日本語訳に同じ字が出てくれば採用する（수업 → 授業）。
- 訳で裏の取れない語（친구 親舊＝友達 など）は `scripts/sentences/decisions.json` の決定に従う。固有語の取り違え
  （고양이 の 고양、일어나다 の 일어 …）は `skip`、まれな同音語や辞書の誤りは `exclude` で先に外す。
- まだ決めていない語は `scripts/sentences/review.json` に出る（多い順、例文つき）。決めて `decisions.json` に足し、作り直す。
- 今の `public/data/sentences.json` は作業ファイル（下書き）から作ったもの。査読済みの文に替えるときは上の書き出しから。

## アイコン

`scripts/icon/icon.svg` を直して `node scripts/icon/render.mjs` で `public/icons/` の PNG（192・512・maskable）を書き出す。

## 決まりごと

- 文言は `src/copy.ts` に、学ぶ人の側から平易に。
- 色は `src/index.css` のトークンから。アクセントは `var(--accent)` / `var(--tint)` で、`data-accent`（わかば・あめ・すみ・あじさい・ゆうやけ）に従う。
  また出会った字は `var(--again)`（紫）。アプリの画面ではグラデーションと影を使わない（アイコンと挿絵だけ）。区切りは罫線。
- 端末のデータ（Dexie）の形を変えるときは、版を上げて移行を書く。DB 名 `hanjaatume` と localStorage のキーは前の版のまま（集めた語を守るため）。
- 電話が基本。720 px から左のタブの列、1024 px から左右分割、1280 px でタブに名前（ことのあめ と同じ段）。

## ロードマップ

- **Phase 1（現在）**: Web — あつめる / 見つける / ことば / 漢字 / 自分、端末内保存、約16,500語の辞書、書き出し・読み込み
- **Phase 2**: 国立国語院 Open API による未収録語のオンライン解決＋日本語訳
- **Phase 3**: Capacitor で iOS 化（`npx cap add ios`）、App Store 準備
- **Phase 4（任意）**: アカウント＆クラウド同期、ことのあめ との行き来

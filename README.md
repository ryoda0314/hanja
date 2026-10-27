# ことのね（旧 한자 도감）

覚えた韓国語を、漢字の根でつなぐ。韓国語の漢字語を自分の指で打つと、漢字の根に分かれ（學 학 ガク）、前に集めた語と
つながり、集めた字だけで読める語が見つかる学習アプリ。姉妹アプリ [ことのあめ](https://polylinga.vercel.app) と同じ紙と墨の画面。
思想は [CONCEPT.md](CONCEPT.md)。

Web（PWA）→ iOS の順で展開する計画です（React + Capacitor）。

## 画面

| タブ | 中身 |
|---|---|
| あつめる `/` | 覚えた語を打つ（ハングル、または 學生・学生 のような漢字）。根に分けて見せ、「あつめると読める語が◯語増えます」。あつめると「+◯語」を数え上げで大きく、新しく読めるようになった語、「はじめての字／また出会った字」、前の語とのつながり。増えないうちは「次に出会うと読める語」。辞書に無い語は手で登録（漢字は集めた字の音から組み立てた候補も出す）。ふりかえりどきの語があれば、そこへの入口 |
| 見つける `/find` | 開くと 文で出会う（例文が4文ずつ降ってくる。文の中の漢字語は、集めた語＝紫の点線・集めた字で読める語・まだの語で印が変わり、上に漢字を添えられる。押すとその語が開く）。雨の下の「ほかの見つけ方」から、読める語 `?view=readable`（上から 読んでみる `?view=read`：漢字だけ見せて、字の音をつなげてハングルで打つ。読めたら集まる）と、あと1字で読める語 `?view=near`（あつめると +◯語）。どちらも戻るボタンの付いた画面 |
| ことば `/words` | 集めた語と覚え具合（あつめた → また出会った → 読めた → 身についた の目盛り）。探す・覚え具合・字数で絞る・新しい順／가나다順。ふりかえりどきの語があれば上に出し、ふりかえる（`?view=review`。ひと回り10語、漢字を見てハングルで打つ。点数は出さない） |
| 漢字 `/hanja` | 集めた字のカード（根の深さ）、基礎漢字1800字の一覧、集めた字を並べて組み立てる。字のページ `/hanja/:char` は田字格に大きく、韓国語の音・日本語の音訓・日本の字、この字が出てくる文 |
| 自分 `/me` | これまでの数、表示（字形・アクセント・読み上げの速さ）、書き出し・読み込み、姉妹アプリ、出典 |

語はどこからでもシートで開ける（この語が出てくる文つき。集めた語には覚え具合の道のりと、次にふりかえる日）。まだ集めていない語は、漢字を ？？ で伏せて見せる（シートと、文の上に添える漢字）。
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
  prefs.tsx            字形（日本の字が既定・韓国の字・両方）、アクセント、読み上げの速さ（localStorage）
  db.ts                Dexie 定義（v2 で互換漢字を統合漢字にそろえる移行）、収集、覚え具合の出来事（文で出会った・読めた・答えを見た）、書き出し・読み込み
  data/
    dataset.ts         curated を即時ロード + public/data/* を起動時 fetch。逆引き・日本の字 → 韓国の字
    resolver.ts        ハングル／漢字（新字体も）→ 漢字語。辞書に無い語の漢字を集めた字から組み立てる
    combine.ts         読める語・あと1字で読める語・あつめると読めるようになる語・次に出会うと効く字・組み立て
    stage.ts           覚え具合の段階と次にふりかえる日（語に残した出来事から毎回求める）
    gloss.ts           語の意味の書き方（よみ【表記】。ふだんは表記、まだ集めていない語では語の字が入った対訳だけ よみ）
    reading.ts         読んでみる の答え合わせ（音節ごと、字のふだんの音とこの語での音の違いとそのわけ：頭音法則 など）と出す語の選び方
    sentences.ts       文で出会う の例文（使う画面で一度だけ読む）、印の語の見分け、ひと雨の選び方（ふりかえりどきの語の文を先に、
                       学ぶ人の段階より難しいまだの語の文は後に）、学ぶ人の段階、音声の場所
  components/          BottomNav / Logo / Icon / Sheet / WordSheet / Roots（根に分けた並び）/ Stage（覚え具合の目盛りと道のり）/ CharCard / …
  pages/               Collect / Find（Meet＝文で出会う、TryRead＝読んでみる）/ Words（Review＝ふりかえる）/ Hanja（Build＝組み立てる）/ HanjaDetail / Me
public/data/           生成された辞書（words.json 約21,500語・約9割に日本語の意味 / hanja-chars.json 約3,400字）と例文（sentences.json 約4,600文）
public/icons/          アプリアイコン（scripts/icon から書き出し）
scripts/
  build-data.mjs       kengdic + Unihan + kyujitai + curated → public/data/words.json・hanja-chars.json を生成
  build-sentences.mjs  ことのあめ の例文と ことのね のために書いた文に漢字語の印を付けて public/data/sentences.json を生成
  export-sentences.mjs ことのあめ の査読済みの文を書き出す（公開の鍵で読むだけ）
  sentences/           kotonone.json（ことのね のために書いた文）・mark.mjs（印の付け方）・check.mjs（書いた文の確かめ）・
                       decisions.json（印の決定）・review.json（まだ決めていない語）
  icon/                アイコンの元絵（icon-source.png）と書き出し（render.mjs、ヘッドレス Chrome）
  og/                  リンクを貼ったときのカードの絵（og.html → public/og.png、render.mjs）
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
# 語の日本語の意味：한국어기초사전（2019年の全体 XML の写し）と JMdict（jmdict-simplified）
mkdir -p scripts/.cache/krdict scripts/.cache/jmdict
for n in 5000 10000 15000 20000 25000 30000 35000 40000 45000 50000 51947; do
  curl -L -o scripts/.cache/krdict/$n.xml https://github.com/spellcheck-ko/korean-dict-nikl-krdict/raw/master/$n.xml
done
curl -L -o /tmp/jm.tgz "https://github.com/scriptin/jmdict-simplified/releases/download/3.6.2%2B20261019180022/jmdict-eng-3.6.2%2B20261019180022.json.tgz"
tar -xzf /tmp/jm.tgz -C scripts/.cache/jmdict
# 語をよく使うか：FrequencyWords の韓国語（字幕）
mkdir -p scripts/.cache/freq
curl -L -o scripts/.cache/freq/ko_full.txt https://cdn.jsdelivr.net/gh/hermitdave/FrequencyWords@master/content/2018/ko/ko_full.txt

# 2) 生成
npm run build:data
```

- kengdic の互換漢字（年 U+F98E =연 のような読み別の重複コード）は NFC で統合漢字にそろえる。字の読みは
  韓国の標準の読み（Unihan kHangul）を先に、頭音法則の形（年 → 연）を後ろに。標準の読みの並びが使う多さと逆の字は、
  語で使う数が倍以上の読みを先頭に（車 は 차・거、更 は 경・갱）。
- 読みの合わない語は除く（kengdic には 휴지 と 休職 のような別の語の組や字の取り違えが混じる）。音節ごとに、字の標準の
  読みか、頭音法則・사이시옷・ㄷ ㅈ の前で ㄹ が落ちた形か、한국어기초사전 のどれかの語でその字をその音で読んでいるかを見る。
- 한국어기초사전 の見出しの漢字は、ふだんと違う音で読む字の ▽（六▽月 유월）を外し、kengdic と違う異体字（映畫 と 映畵、
  強 と 强）でも引けるようにしてから語に合わせる。kengdic に無い語は、日本語の対訳の表記が同じ語があればその語の書き方の
  違い（기간 の 其間 と 期間）として等級を移し、無ければ 초급〜고급 の語を足す（동물・초등학교・한국인 …）。
- 基礎漢字1800字（교육용 기초 한자）の印は kHangul の E。辞書が異体字で収録している字（強 → 强 など）は、読みと意味が同じ字に印を移す。
- 日本語の音読み・訓読みは Unihan kJapanese（よく使う読みから3つまで）。日本の字は kyujitai に、それに無い対応
  （豫 → 予、辯・辨 → 弁、畵 → 画、旣 → 既、囊 → 嚢 など）を足したもの。
- よく使うかは 한국어기초사전 の等級（초급・중급・고급）と、FrequencyWords（映画・ドラマの字幕 約630万語）の頻度 `fq` から。
  字幕の語節（회사에・공부했어）から語尾・助詞を外して語にまとめ、綴りの同じ語は等級の重みで分け合う。等級が無く、
  100万語に1回も使わない語は、読める語・あと1字で読める語・あつめると読める語に出さない（`src/data/resolver.ts` の isRare）。
- 語の意味は 한국어기초사전 の日本語の対訳 → 手作業の日本語訳 → JMdict の日本語の同じ漢字の語 → kengdic の英語 の順。
  日本語は「よみ【表記】、…」の形で持ち（例: じどう【児童】、がくせい【学生】）、ふだんは表記を、まだ集めていない語では
  語の字が入った対訳だけ よみ を出す（`src/data/gloss.ts`）。集めてある語の意味は、起動して辞書を読んだあとにいまの辞書にそろえる。

出典・ライセンスは [NOTICE.md](./NOTICE.md) を参照（kengdic: MPL2.0/LGPL/CC-BY-SA、Unihan: Unicode License、FrequencyWords: CC BY-SA 4.0）。

## 例文の生成（文で出会う）

例文は姉妹アプリ ことのあめ の例文ライブラリ（韓国語＋日本語訳）と、ことのね のために書いた文
（`scripts/sentences/kotonone.json`。ことのあめ の文に出てこない基礎の語のため）から作ります。

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
- ことのね のために書いた文は、狙った語の漢字表記を文に添える（`{ko, ja, words: {"건강": "健康"}}`）。足す前に
  `node scripts/sentences/check.mjs <文の json> --show` で、狙った語がその語として拾えるか（長い語の一部になっていないか）、
  漢字表記の決まらない語がないか、ことのあめ と同じ くだけた話しことばか を確かめる。
- 今の `public/data/sentences.json` は作業ファイル（下書き）から作ったもの。査読済みの文に替えるときは上の書き出しから。

## 使われ方の数（管理者）

何人が使っているかだけを、姉妹アプリ ことのあめ の Supabase に数える（`src/util/usage.ts`）。送るのは、端末ごとの番号
（その端末で作った乱数）と、1時間ごとの 開いた・あつめた・読めた の回数と、ホーム画面から開いたかだけ。集めた語は送らない。
自分 の「使われ方の数を送る」で止められる。送り先は `.env` の `VITE_SUPABASE_URL`・`VITE_SUPABASE_ANON_KEY`
（ことのあめ と同じ、公開してよい値。空なら送らない）。数えるのは公開先（`.env` の `VITE_SITE_URL`）で開いたときだけで、
`npm run dev`・preview や Vercel の試しの公開は数えない（公開先を変えたら `VITE_SITE_URL` も変える）。

- 表と関数とまとめは `supabase/usage.sql`（名前は `kn_` で始める。ことのあめ は `pl_`、旧アプリの表には触れない）。
  当てるのは ことのあめ のリポジトリで（何度当ててもよい）：`node --env-file=.env.local scripts/migrate.mjs ../作成したもの/hanjaatume/supabase/usage.sql`
  2026-10-26 からは日ごと（`kn_days`）にだけ数えていたので、1時間ごとの数は今の版を当てた時刻から先の分だけ。
- 見る：`node --env-file=../../polylinga/.env.local scripts/usage.mjs [日数]`（日ごと）、`… usage.mjs --hours [日付]`（1時間ごと）。
  読むのは Supabase の中でまとめた数（`kn_summary`・`kn_stats`・`kn_hourly`）だけ。Supabase の画面でも同じ名前で見られる。
- 人数は端末の数で、人の数より多めに出る。iPhone は X の中のブラウザ・Safari・ホーム画面のアプリで記録が別なので、
  X から来てホーム画面に追加した人は3台に数えることがある。同じわけで「はじめて」には、別の入口から戻ってきた人も混じる。

## アイコン

元の絵は `scripts/icon/icon-source.png`（ChatGPT で描いたもの、1254×1254・全面に紙の色）。差し替えたら
`node scripts/icon/render.mjs` で `public/icons/` の PNG を書き出す：角を丸めた 192・512、Android が丸く切り抜いても
欠けないよう絵を縮めた maskable-512、iOS のホーム画面用の apple-touch-icon（180、角は iOS が丸める）。
アイコンを替えたら、リンクのカード（下）と紹介映像（`promo/` で `npm run assets` のあと書き出し直し）も作り直す。

## リンクのカード（X・LINE など）

`scripts/og/og.html` を直して `node scripts/og/render.mjs` で `public/og.png`（1200×630）を書き出す。
カードの絵は絶対 URL でないと出ないので、公開先を `.env` の `VITE_SITE_URL`（末尾は /）に書いてからビルドする。

## 紹介映像

`promo/` は別のプロジェクト（Remotion 4、1920×1080・約70秒・字幕と合成の音楽）。アプリの画面を描き直して、一つの語の道のり
（학생 → 대학 → 대학생、文の雨、ふりかえり）を見せる。姉妹アプリ ことのは の映像と同じ作り。作り方は [promo/README.md](promo/README.md)。

## 決まりごと

- 文言は `src/copy.ts` に、学ぶ人の側から平易に。
- 色は `src/index.css` のトークンから。アクセントは `var(--accent)` / `var(--tint)` で、`data-accent`（わかば・あめ・すみ・あじさい・ゆうやけ）に従う。
  また出会った字は `var(--again)`（紫）。アプリの画面ではグラデーションと影を使わない（アイコンと挿絵だけ）。区切りは罫線。
- 端末のデータ（Dexie）の形を変えるときは、版を上げて移行を書く。DB 名 `hanjaatume` と localStorage のキーは前の版のまま（集めた語を守るため）。
- 電話が基本。720 px から左のタブの列、1024 px から左右分割、1280 px でタブに名前（ことのあめ と同じ段）。

## ロードマップ

- **Phase 1（現在）**: Web — あつめる / 見つける / ことば（覚え具合・ふりかえる）/ 漢字 / 自分、端末内保存、約21,200語の辞書（意味は日本語）、書き出し・読み込み
- **Phase 2**: 国立国語院 Open API による未収録語のオンライン解決
- **Phase 3**: Capacitor で iOS 化（`npx cap add ios`）、App Store 準備
- **Phase 4（任意）**: アカウント＆クラウド同期、ことのあめ との行き来

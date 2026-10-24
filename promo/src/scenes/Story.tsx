// C–H. 漢字の読みで覚えると、どうなるかを、アプリの画面で。左に映像の言葉。
//   あつめる：야구 を打つと 野・球 に分かれ、読める語が +1（야생）。체육 で +4（대체・생육・생체・구체）。
//   読んでみる：球体 を見て、自分で 구체 と打つ。読めました。習っていない語なのに。
//   漢字：読み方の表が、覚えた語から育つ（ガク は 학、イク は 육）。
//   見つける：別の日に、ことのあめ の例文の中で、あつめた語にまた出会う（覚え具合が「また出会った」へ）。
//   ことば：覚え具合は四つの段階。ふりかえりどきに 大学 を 대학 と読めて、読めた → 身についた。次は 20日後。
// 学ぶ人の手持ちは、학생・대학・회사・사회・회원 を集めたところから。数はアプリの辞書のとおり。覚え具合と、次の
// ふりかえりまでの日は stage.ts のとおり（あつめた 1日・また出会った 2日・読めた 6日・身についた 20日後から）。
import type { CSSProperties, ReactNode } from "react";
import { fall, mixColor, prog, rise, SOFT, typedAt, type Typing } from "../anim";
import { Scroll } from "../Scroll";
import { T, TYPE1, TYPE2, TYPE3, TYPE4, TYPE5 } from "../timeline";
import { C, FONT } from "../theme";
import { Btn, CharCard, Field, GainAfter, GainBefore, Gauge, Grow, Icon, jpForm, Legend, Logo, Names, Pair, RainItem, Roots, rgba, SubBar, Toggle, WordRow, label, note, type Seg } from "../ui";
import { Captions, type Cap } from "./Caption";

const ko = (text: string, color?: string) => ({ text, font: "ko" as const, color });
const hj = (text: string) => ({ text, font: "hanja" as const });
/** 覚え具合の段階の名前：声がその段階を言うときに色が付く。 */
const stage = (text: string, at: number) => ({ text, color: C.accent, at });

/** 映像の言葉。 */
const CAPS: Cap[] = [
  { from: T.collect.cap1, door: "collect", main: [["覚えた語を打つと、"], ["漢字の読みに分かれる。"]], sub: [[ko("야"), " は ", hj("野"), "、", ko("구"), " は ", hj("球"), "。"]] },
  { from: T.collect.cap2, door: "collect", main: [["一字の読みが、"], ["前に覚えた語とつながる。"]], sub: [["あつめるたびに、読める語がまとめて増える。"]] },
  { from: T.read.cap3, door: "find", main: [["野球が ", ko("야구"), "、"], ["体育が ", ko("체육"), " なら、"], ["球体は？"]] },
  { from: T.read.cap4, door: "find", main: [["球体は、", ko("구체"), "。"]], sub: [["習っていない語なのに、自分で読めた。"]] },
  {
    from: T.hanja.cap5,
    door: "hanja",
    main: [["読み方の表が、"], ["覚えた語から育つ。"]],
    sub: [["日本語の音読みと並べると、対応が見えてくる。"], [{ text: "ガク", color: C.accent }, " は ", ko("학", C.accent), "、", { text: "イク", color: C.accent }, " は ", ko("육", C.accent), "。"]],
    subAt: T.hanja.pairs,
  },
  {
    from: T.meet.cap6,
    door: "find",
    main: [["ことのあめ の例文が、"], ["雨のように降ってくる。"]],
    sub: [["集めた語には ", { text: "漢字", color: C.again }, "、まだの語は ", { text: "？？", color: C.accent }, "。"]],
    subAt: T.meet.marks,
  },
  {
    from: T.meet.spot,
    door: "find",
    main: [[ko("대회"), " は、"], ["集めた字で読めそう。"]],
    sub: [[ko("대"), " は ", hj("大"), "（", ko("대학"), "）、", ko("회"), " は ", hj("会"), "（", ko("회사"), "）"]],
  },
  {
    from: T.meet.sheet,
    door: "find",
    main: [["打ってあつめると、"], ["漢字が開く。"]],
    sub: [["答え合わせのように、", { text: "大会", font: "hanja", color: C.accent }, " が現れる。"]],
    subAt: T.meet.reveal,
  },
  {
    from: T.meet.cap10,
    door: "find",
    main: [["別の日に、"], ["文の中でまた出会う。"]],
    sub: [["出会った語は「", { text: "また出会った", color: C.again, at: T.meet.met }, "」へ進む。"]],
  },
  {
    from: T.words.cap7,
    door: "words",
    main: [["覚え具合は、"], ["四つの段階で育つ。"]],
    sub: [[stage("あつめた", T.words.s1), " → ", stage("また出会った", T.words.s2), " → ", stage("読めた", T.words.s3), " → ", stage("身についた", T.words.s4)]],
  },
  { from: T.words.cap8, door: "words", main: [["忘れかけたころに、"], ["ふりかえり。"]], sub: [["ふりかえりどきの語を、漢字から読む。"], ["読めたら、一段階すすむ。"]] },
  { from: T.words.cap9, door: "words", main: [["読めるたびに、"], ["次のふりかえりは遠くなる。"]], sub: [["1日後 → 2日後 → 6日後 → 20日後 → …"]] },
];

const PANEL = { left: 880, top: 40, width: 900, height: 1000 };
const K = 1.5;
const PW = PANEL.width / K;
const PH = PANEL.height / K;

export function Story({ frame }: { frame: number }) {
  return (
    <>
      <Captions frame={frame} caps={CAPS} until={T.end.start} />
      <Panel frame={frame} />
    </>
  );
}

function Panel({ frame }: { frame: number }) {
  const cuts = [T.read.start, T.hanja.start, T.meet.start, T.words.start];
  const w = (i: number) => (i === 0 ? 1 : prog(frame, cuts[i - 1], 12, SOFT)) * (i === cuts.length ? 1 : 1 - prog(frame, cuts[i], 12, SOFT));
  const screens = [CollectScreen, ReadScreen, HanjaScreen, FindScreen, WordsScreen];
  return (
    <div style={{ position: "absolute", ...PANEL, borderRadius: 28, border: `1.5px solid ${C.line2}`, overflow: "hidden", background: C.paper, ...fall(frame, T.collect.start, 24, 18) }}>
      <div style={{ position: "absolute", left: 0, top: 0, width: PW, height: PH, transform: `scale(${K})`, transformOrigin: "0 0" }}>
        {screens.map((Screen, i) =>
          w(i) > 0 ? (
            <div key={i} style={{ position: "absolute", inset: 0, opacity: w(i), background: C.paper }}>
              <Screen frame={frame} />
            </div>
          ) : null,
        )}
      </div>
    </div>
  );
}

/** 打つ欄の中身。`from` から打ちはじめ、`until` で空になる（あつめると欄は空く）。 */
function typed(frame: number, t: Typing, from: number, until: number) {
  return frame >= from && frame < until ? typedAt(t, frame - from) : "";
}
const typingNow = (frame: number, t: Typing, from: number) => frame >= from && frame < from + t.duration;
const caretOn = (frame: number, focus: number, typing: boolean) => frame >= focus && (typing || Math.floor((frame - focus) / 16) % 2 === 0);

function Done({ word }: { word: string }) {
  return (
    <p style={{ margin: 0, display: "inline-flex", alignItems: "center", gap: 6, fontSize: 14, fontWeight: 600, color: C.accent }}>
      <Icon name="check" size={18} />「<span style={{ fontFamily: FONT.ko }}>{word}</span>」をあつめました。
    </p>
  );
}

// ---- あつめる --------------------------------------------------------------------------------------------------------

/** 체육 をあつめて新しく読めるようになった語（アプリの並び：よく使う語から）。 */
const OPENED = [
  { hangul: "대체", hanja: "大體", gloss: "一体" },
  { hangul: "생육", hanja: "生育", gloss: "生育" },
  { hangul: "생체", hanja: "生體", gloss: "生体" },
  { hangul: "구체", hanja: "球體", gloss: "球体" },
];

function CollectScreen({ frame }: { frame: number }) {
  const c = T.collect;
  const text = typed(frame, TYPE1, c.type1, c.done1) || typed(frame, TYPE2, c.type2, c.done2);
  const typing = typingNow(frame, TYPE1, c.type1) || typingNow(frame, TYPE2, c.type2);
  const look = frame < c.look2 - 10 ? frame - c.look1 : frame - c.look2;
  const grow = (at: number, n: number) => Array.from({ length: n }, (_, i) => prog(frame, at + i * 3, 18));
  return (
    <>
      <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: 64, padding: "12px 20px 0", display: "flex", alignItems: "center", justifyContent: "space-between", background: C.paper, zIndex: 2 }}>
        <Logo />
        <Pair />
      </div>
      <Scroll
        style={{ left: 0, right: 0, top: 64, bottom: 0 }}
        focus={[
          { anchor: "form", w: prog(frame, c.found1 - 6, 16, SOFT), margin: 8 },
          { anchor: "result", w: prog(frame, c.done2 + 20, 24, SOFT), margin: 8 },
        ]}
      >
        <div style={{ padding: "22px 20px 40px", display: "flex", flexDirection: "column", gap: 28 }}>
          <h2 style={{ margin: 0, fontFamily: FONT.mincho, fontSize: 24, fontWeight: 700, letterSpacing: "0.04em", lineHeight: 1.5 }}>覚えた語を、打ってあつめる</h2>
          <div data-anchor="form" style={{ display: "flex", flexDirection: "column", gap: 8, padding: 16, background: C.surface, borderRadius: 12 }}>
            <span style={label}>覚えた漢字語</span>
            <div style={{ display: "flex", gap: 8 }}>
              <Field text={text} placeholder="예: 학생" caret={caretOn(frame, c.focus, typing)} />
              <Btn disabled={!text} press={look} style={{ padding: "0 20px" }}>
                しらべる
              </Btn>
            </div>
            <p style={note}>ハングルで打ちます。漢字（日本の字の 学生 でも）でも探せます。</p>
          </div>
          <div data-anchor="result">
            {frame >= c.found1 && frame < c.done1 ? (
              <section style={{ display: "flex", flexDirection: "column", gap: 16, ...rise(frame, c.found1, 8, 10) }}>
                <Names hangul="야구" hanja="野球" gloss="野球、ベースボール" />
                <Roots hangul="야구" hanja="野球" />
                <GainBefore count={1} />
                <Btn press={frame - c.press1}>あつめる</Btn>
              </section>
            ) : null}
            {frame >= c.done1 && frame < c.found2 ? (
              <section style={{ display: "flex", flexDirection: "column", gap: 16, ...rise(frame, c.done1, 8, 10) }}>
                <Done word="야구" />
                <Names hangul="야구" hanja="野球" gloss="野球、ベースボール" />
                <Roots hangul="야구" hanja="野球" grow={grow(c.done1 + 2, 2)} notes={[{ kind: "new" }, { kind: "new" }]} />
                <div style={{ display: "flex", flexDirection: "column", gap: 8, ...rise(frame, c.done1 + 10, 8, 12) }}>
                  <GainAfter shown={1} />
                  <WordRow hangul="야생" hanja="野生" gloss="野生" />
                </div>
              </section>
            ) : null}
            {frame >= c.found2 && frame < c.done2 ? (
              <section style={{ display: "flex", flexDirection: "column", gap: 16, ...rise(frame, c.found2, 8, 10) }}>
                <Names hangul="체육" hanja="體育" gloss="体育" />
                <Roots hangul="체육" hanja="體育" />
                <GainBefore count={4} />
                <Btn press={frame - c.press2}>あつめる</Btn>
              </section>
            ) : null}
            {frame >= c.done2 ? (
              <section style={{ display: "flex", flexDirection: "column", gap: 16, ...rise(frame, c.done2, 8, 10) }}>
                <Done word="체육" />
                <Names hangul="체육" hanja="體育" gloss="体育" />
                <Roots hangul="체육" hanja="體育" grow={grow(c.done2 + 2, 2)} notes={[{ kind: "new" }, { kind: "new" }]} />
                <div style={{ display: "flex", flexDirection: "column", gap: 8, ...rise(frame, c.done2 + 10, 8, 12) }}>
                  <GainAfter shown={Math.round(4 * prog(frame, c.done2 + 12, 14))} />
                  {OPENED.map((w, i) => (
                    <div key={w.hangul} style={rise(frame, c.done2 + 18 + i * 3, 14, 12)}>
                      <WordRow hangul={w.hangul} hanja={w.hanja} gloss={w.gloss} />
                    </div>
                  ))}
                </div>
              </section>
            ) : null}
          </div>
        </div>
      </Scroll>
    </>
  );
}

// ---- 読んでみる -----------------------------------------------------------------------------------------------------

export function ReadScreen({ frame }: { frame: number }) {
  const r = T.read;
  const text = typed(frame, TYPE3, r.type, r.success);
  const done = frame >= r.success;
  const shown = prog(frame, r.success, 10);
  return (
    <>
      <SubBar back title="読んでみる" />
      <div style={{ position: "absolute", left: 0, right: 0, top: 61, padding: "20px 20px", display: "flex", flexDirection: "column", gap: 16 }}>
        {!done ? (
          <>
            <p style={{ margin: 0, fontSize: 15, lineHeight: 1.75, color: C.muted }}>集めた字だけでできた、まだ習っていない語です。字の音をつなげて、ハングルで読んでみてください。</p>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "20px 12px 16px", border: `1px solid ${C.line2}`, borderRadius: 16, ...fall(frame, r.start + 4, 10, 14) }}>
              <div style={{ display: "flex", gap: 4 }}>
                {[..."球體"].map((g) => (
                  <span key={g} style={{ minWidth: 76, display: "flex", flexDirection: "column", alignItems: "center", gap: 2, padding: "6px 4px 8px" }}>
                    <span style={{ fontFamily: FONT.hanja, fontWeight: 500, fontSize: 64, lineHeight: 1.2 }}>{jpForm(g)}</span>
                    <span style={{ minHeight: 28, fontSize: 19, fontWeight: 600, color: C.line2 }}>・</span>
                  </span>
                ))}
              </div>
              <p style={note}>字を押すと、その字の音が出ます。</p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: 16, background: C.surface, borderRadius: 12 }}>
              <span style={label}>ハングルで読んでみる</span>
              <div style={{ display: "flex", gap: 8 }}>
                <Field text={text} caret={caretOn(frame, r.type - 10, typingNow(frame, TYPE3, r.type))} />
                <Btn disabled={!text} press={frame - r.submit} style={{ padding: "0 20px" }}>
                  読んだ
                </Btn>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {["字の音を見る", "答えを見る", "ほかの語"].map((x) => (
                <span key={x} style={{ minHeight: 40, padding: "0 16px", display: "inline-flex", alignItems: "center", border: `1px solid ${C.line2}`, borderRadius: 999, fontSize: 14, color: C.ink2 }}>
                  {x}
                </span>
              ))}
            </div>
          </>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16, opacity: shown, transform: `translateY(${(1 - shown) * 8}px)` }}>
            <p style={{ margin: 0, display: "inline-flex", alignItems: "center", gap: 6, fontSize: 15, fontWeight: 600, color: C.accent }}>
              <Icon name="check" size={18} />
              読めました。習っていない語なのに。
            </p>
            <p style={{ margin: "-8px 0 0", paddingLeft: 24 }}>
              <Gauge level={2} />
            </p>
            <Names hangul="구체" hanja="球體" gloss="球体" />
            <Roots
              hangul="구체"
              hanja="球體"
              grow={[0, 1].map((i) => prog(frame, r.success + 6 + i * 3, 18))}
              notes={[
                { kind: "again", n: 2 },
                { kind: "again", n: 2 },
              ]}
            />
            <p style={note}>
              あつめた語に入れました。<span style={{ marginLeft: 10, textDecoration: "underline" }}>外す</span>
            </p>
            <Btn>次の語へ</Btn>
          </div>
        )}
      </div>
    </>
  );
}

// ---- 漢字：集めた字 -------------------------------------------------------------------------------------------------

/** 集めた字と、その字が入った集めた語の数（よく出会う順）。학생・대학・회사・사회・회원・야구・체육・구체 から。 */
const CARDS: [string, number][] = [
  ["會", 3],
  ["學", 2],
  ["社", 2],
  ["球", 2],
  ["體", 2],
  ["生", 1],
  ["大", 1],
  ["員", 1],
  ["野", 1],
  ["育", 1],
];

function HanjaScreen({ frame }: { frame: number }) {
  const h = T.hanja;
  const lit = prog(frame, h.pairs, 12);
  return (
    <>
      <SubBar title="漢字" count="10字" />
      {/* 下の余白は、並べ替えの札が上に隠れきるまで送れるだけ取る（途中で切れて見えないように）。 */}
      <Scroll style={{ left: 0, right: 0, top: 61, bottom: 0 }} focus={[{ anchor: "cards", w: prog(frame, h.pairs - 18, 20, SOFT), margin: 12 }]}>
        <div style={{ padding: "20px 20px 80px", display: "flex", flexDirection: "column", gap: 16 }}>
          <span style={{ minHeight: 44, padding: "0 12px", border: `1px solid ${C.line2}`, borderRadius: 12, display: "flex", alignItems: "center", fontSize: 16, color: C.faint }}>
            漢字・音・読みで探す（学 / 학 / ガク）
          </span>
          <div style={{ display: "grid", gridAutoFlow: "column", gridAutoColumns: "minmax(0, 1fr)", border: `1px solid ${C.line2}`, borderRadius: 12, overflow: "hidden" }}>
            {["集めた字", "基礎漢字1800", "組み立てる"].map((v, i) => (
              <span
                key={v}
                style={{
                  minHeight: 44,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 14,
                  borderLeft: i ? `1px solid ${C.line2}` : undefined,
                  background: i === 0 ? C.ink : C.paper,
                  color: i === 0 ? C.paper : C.ink2,
                  fontWeight: i === 0 ? 600 : 400,
                }}
              >
                {v}
              </span>
            ))}
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {["よく出会う順", "新しい順", "画数順"].map((s, i) => (
              <span
                key={s}
                style={{
                  minHeight: 36,
                  padding: "0 12px",
                  display: "inline-flex",
                  alignItems: "center",
                  border: `1px solid ${i === 0 ? C.ink : C.line2}`,
                  borderRadius: 999,
                  background: i === 0 ? C.ink : C.paper,
                  color: i === 0 ? C.paper : C.ink2,
                  fontWeight: i === 0 ? 600 : 400,
                  fontSize: 13,
                }}
              >
                {s}
              </span>
            ))}
          </div>
          <div data-anchor="cards" style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>
            {CARDS.map(([ch, n], i) => (
              <CharCard key={ch} char={ch} count={n} hl={ch === "學" || ch === "育" ? lit : 0} style={fall(frame, h.start + 6 + i * 2, 10, 12)} />
            ))}
          </div>
        </div>
      </Scroll>
    </>
  );
}

// ---- 見つける：文の中で学ぶ ---------------------------------------------------------------------------------------

const RAIN: { segs: Seg[]; ja: string }[] = [
  { segs: ["나 ", { text: "야구", kind: "owned", rt: "野球" }, "부 아니고 ", { text: "축구", kind: "new", rt: "？？" }, "부야."], ja: "野球部じゃなくてサッカー部だよ" },
  { segs: [{ text: "회사", kind: "owned", rt: "会社" }, " 몇 군데 ", { text: "지원", kind: "new", rt: "？？" }, "했어?"], ja: "何社エントリーした？" },
  { segs: ["헬스장 ", { text: "회원", kind: "owned", rt: "会員" }, "권 한 번도 안 썼어."], ja: "ジムの会員証、一度も使ったことない" },
  { segs: ["내일 ", { text: "체육", kind: "owned", rt: "体育" }, " ", { text: "대회", kind: "readable", rt: "？？" }, "래."], ja: "明日、体育大会だって" },
];

type MetGroup = { kind: "owned" | "readable" | "new"; name: string; words: { ko: string; hanja: string }[] };

/**
 * この雨で出会った語（Meet の met）：集めた語は「また出会った」（別の日なら覚え具合が進む）、集めた字で読める語、まだの語。
 * `got`：대회 をあつめたあと（読めそう から 集めた語 の側へ移る）。
 */
function metGroups(got: boolean): MetGroup[] {
  const owned = [{ ko: "야구", hanja: "野球" }, { ko: "회사", hanja: "會社" }, { ko: "회원", hanja: "會員" }, { ko: "체육", hanja: "體育" }];
  const daehoe = { ko: "대회", hanja: "大會" };
  const groups: MetGroup[] = [
    { kind: "owned", name: "また出会った", words: got ? [...owned, daehoe] : owned },
    { kind: "readable", name: "読めそう", words: got ? [] : [daehoe] },
    { kind: "new", name: "はじめて", words: [{ ko: "축구", hanja: "蹴球" }, { ko: "지원", hanja: "志願" }] },
  ];
  return groups.filter((g) => g.words.length > 0);
}

function FindScreen({ frame }: { frame: number }) {
  const m = T.meet;
  const starts = [m.line1, m.line2, m.line3, m.line4];
  const got = frame >= m.close;
  // 대회：灯して、押す。あつめたあとは、文の上にも 大会（集めた語の紫の点線）。
  const spot = prog(frame, m.spot, 8) * (1 - prog(frame, m.sheet, 8));
  const rain = RAIN.map((line) => ({
    ...line,
    segs: line.segs.map((s): Seg => (typeof s === "string" || s.text !== "대회" ? s : got ? { text: "대회", kind: "owned", rt: "大会" } : { ...s, spot, press: frame - m.tap })),
  }));
  const open = prog(frame, m.sheet, 10) * (1 - prog(frame, m.close, 9, SOFT));
  const MET = metGroups(got);
  return (
    <>
      <SubBar title="見つける" />
      <Scroll style={{ left: 0, right: 0, top: 61, bottom: 0 }} focus={[{ anchor: "met", w: prog(frame, m.met, 24, SOFT), margin: 16 }]}>
        <div style={{ padding: "20px 20px 32px", display: "flex", flexDirection: "column", gap: 18 }}>
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.75, color: C.muted }}>
            集めた字の入った文が、雨のように降ってきます。上に ？？ の付いた語を押してハングルを打つと、その漢字が分かってあつまります。
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <Legend />
            <div style={{ display: "flex", gap: 16 }}>
              <Toggle on>漢字を添える</Toggle>
              <Toggle on={false}>訳を隠す</Toggle>
            </div>
          </div>
          <div style={{ borderTop: `1px solid ${C.line}` }}>
            {rain.map((line, i) => (
              <Grow key={i} p={prog(frame, starts[i], 12)}>
                <RainItem segs={line.segs} ja={line.ja} drop={prog(frame, starts[i] + 7, 13)} style={fall(frame, starts[i], 44, 22)} />
              </Grow>
            ))}
          </div>
          <section data-anchor="met" style={{ display: "flex", flexDirection: "column", gap: 10, paddingTop: 4 }}>
            <h2 style={label}>この雨で出会った語</h2>
            {MET.map((g) => (
              <div key={g.kind} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.02em", color: g.kind === "owned" ? C.again : g.kind === "readable" ? C.accent : C.muted }}>
                  {g.name} {g.words.length}
                </span>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {g.words.map((w, i) => {
                    // 集めた語：また出会った の印が、一つずつ灯る。
                    const lit = g.kind === "owned" ? prog(frame, m.met + 14 + i * 4, 6) * (1 - prog(frame, m.met + 30 + i * 4, 18)) : 0;
                    return (
                      <span
                        key={w.ko}
                        style={{
                          minHeight: 40,
                          padding: "0 14px",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          borderRadius: 999,
                          border: `1px ${g.kind === "new" ? "dashed" : "solid"} ${g.kind === "owned" ? C.again : g.kind === "readable" ? C.accent : C.accent}`,
                          background: g.kind === "owned" ? C.againTint : g.kind === "readable" ? C.tint : C.paper,
                          boxShadow: lit > 0 ? `0 0 0 ${3 * lit}px ${rgba(C.again, 0.35)}` : undefined,
                        }}
                      >
                        <span style={{ fontFamily: FONT.ko, fontSize: 16 }}>{w.ko}</span>
                        {g.kind === "owned" ? (
                          <span style={{ fontFamily: FONT.hanja, fontSize: 14, color: C.ink2 }}>{jpForm(w.hanja)}</span>
                        ) : (
                          <span style={{ fontFamily: FONT.hanja, fontSize: 14, fontWeight: 600, color: C.accent, letterSpacing: "0.08em" }}>{"？".repeat([...w.hanja].length)}</span>
                        )}
                      </span>
                    );
                  })}
                </div>
              </div>
            ))}
          </section>
        </div>
      </Scroll>
      {open > 0 ? <DaehoeSheet frame={frame} open={open} /> : null}
    </>
  );
}

/**
 * 語のシート（WordSheet）：まだ集めていない 대회。漢字は ？？ で伏せ、意味も読み（たいかい）で。
 * ハングルで打ってあつめると、答え合わせのように伏せていた漢字（大会）が開き、根が下から伸びる（大 は 2語目、会 は 4語目）。
 */
function DaehoeSheet({ frame, open }: { frame: number; open: number }) {
  const m = T.meet;
  const done = frame >= m.reveal;
  const text = typed(frame, TYPE5, m.type, m.reveal);
  const shown = prog(frame, m.reveal, 18);
  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 10, background: rgba(C.ink, 0.32 * open) }}>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          // 打つ前と、開いたあとで高さを変えない（上の縁が跳ねないように）。
          minHeight: 522,
          transform: `translateY(${(1 - open) * 105}%)`,
          background: C.paper,
          borderRadius: "16px 16px 0 0",
          padding: "16px 20px 24px",
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={label}>{done ? "あつめた語" : "まだあつめていない語"}</span>
          <span style={{ width: 44, height: 44, marginRight: -10, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
            <Icon name="close" size={22} />
          </span>
        </div>
        <Names
          hangul="대회"
          hanja="大會"
          masked={!done}
          gloss={done ? "大会" : "たいかい"}
          hanjaStyle={done ? { opacity: shown, transform: `translateY(${(1 - shown) * 8}px) scale(${0.94 + 0.06 * shown})` } : undefined}
        />
        <Roots
          hangul="대회"
          hanja="大會"
          masked={!done}
          grow={done ? [0, 1].map((i) => prog(frame, m.reveal + 4 + i * 3, 18)) : undefined}
          notes={done ? [{ kind: "again", n: 2 }, { kind: "again", n: 4 }] : undefined}
        />
        {!done ? (
          <>
            <p style={note}>集めた字だけでできた語。もう読めていた語です。</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: 16, background: C.surface, borderRadius: 12 }}>
              <span style={label}>ハングルで打って、あつめる</span>
              <div style={{ display: "flex", gap: 8 }}>
                <Field text={text} caret={caretOn(frame, m.sheet + 8, typingNow(frame, TYPE5, m.type))} />
                <Btn disabled={!text} press={frame - m.collect} style={{ padding: "0 20px" }}>
                  あつめる
                </Btn>
              </div>
              <p style={note}>打ってあつめると、漢字が分かります。</p>
            </div>
          </>
        ) : (
          <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: C.accent, opacity: prog(frame, m.reveal + 10, 10) }}>「대회」をあつめました。</p>
        )}
      </div>
    </div>
  );
}

// ---- ことば：覚え具合と、ふりかえり ---------------------------------------------------------------------------------

/** 集めた語と覚え具合（0 あつめた・1 また出会った・2 読めた・3 身についた）。新しい順。 */
const MINE: { hangul: string; hanja: string; gloss: string; level: number; ago: string }[] = [
  { hangul: "구체", hanja: "球體", gloss: "球体", level: 2, ago: "3日前" },
  { hangul: "체육", hanja: "體育", gloss: "体育", level: 1, ago: "3日前" },
  { hangul: "야구", hanja: "野球", gloss: "野球、ベースボール", level: 1, ago: "3日前" },
  { hangul: "회원", hanja: "會員", gloss: "会員", level: 1, ago: "4日前" },
  { hangul: "회사", hanja: "會社", gloss: "会社", level: 1, ago: "4日前" },
  { hangul: "사회", hanja: "社會", gloss: "社会", level: 0, ago: "4日前" },
  { hangul: "대학", hanja: "大學", gloss: "大学、学部", level: 2, ago: "12日前" },
  { hangul: "학생", hanja: "學生", gloss: "児童、生徒、学生", level: 3, ago: "12日前" },
];
/** ひと回りでふりかえった語：読めたあとの覚え具合と、次のふりかえり（読めた 6日後、身についた 20日後：stage.ts）。 */
const REVIEWED = [
  { hangul: "대학", hanja: "大學", gloss: "大学、学部", level: 3, next: "20日後にふりかえり" },
  { hangul: "사회", hanja: "社會", gloss: "社会", level: 2, next: "6日後にふりかえり" },
  { hangul: "회사", hanja: "會社", gloss: "会社", level: 2, next: "6日後にふりかえり" },
];
const STAGE_NAMES = ["あつめた", "また出会った", "読めた", "身についた"];
const metaRow: CSSProperties = { display: "flex", alignItems: "flex-end", gap: 12, marginTop: 4 };

/** ことば（覚え具合の一覧）→ ふりかえる（大学 を読む）→ ひと回りの終わり。 */
function WordsScreen({ frame }: { frame: number }) {
  const w = T.words;
  const toCard = prog(frame, w.review, 10, SOFT);
  const toEnd = prog(frame, w.list, 10, SOFT);
  const layer = (opacity: number, child: ReactNode) => (opacity > 0 ? <div style={{ position: "absolute", inset: 0, opacity, background: C.paper }}>{child}</div> : null);
  return (
    <>
      {layer(1 - toCard, <WordsList frame={frame} />)}
      {layer(toCard * (1 - toEnd), <ReviewCard frame={frame} />)}
      {layer(toEnd, <RoundEnd frame={frame} />)}
    </>
  );
}

function WordsList({ frame }: { frame: number }) {
  const w = T.words;
  const at = [w.s1, w.s2, w.s3, w.s4, w.cap8];
  // 声がその段階を言うあいだ、その札が灯る。
  const lit = (i: number) => prog(frame, at[i], 4) * (1 - prog(frame, at[i + 1], 6));
  const counts = [1, 4, 2, 1];
  const due = prog(frame, w.cap8, 10) * (1 - prog(frame, w.review, 6));
  return (
    <>
      <SubBar title="ことば" count="8語" />
      <div style={{ position: "absolute", left: 0, right: 0, top: 61, padding: "20px 20px", display: "flex", flexDirection: "column", gap: 16 }}>
        <section style={{ display: "flex", flexDirection: "column", gap: 10, padding: 18, background: C.surface, borderRadius: 12, boxShadow: `0 0 0 ${2 * due}px ${C.accent}` }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>ふりかえりどきの語が 3語</h2>
          <p style={note}>漢字を見て、ハングルで読めるか確かめます。ひと回り10語まで。読めると覚え具合が進みます。</p>
          <Btn press={frame - w.press} style={{ alignSelf: "flex-start", marginTop: 6 }}>
            ふりかえる
            <Icon name="arrow" size={18} />
          </Btn>
        </section>
        <div style={{ display: "flex", gap: 6 }}>
          {["すべて", ...STAGE_NAMES].map((name, i) => {
            const on = i === 0;
            const l = i === 0 ? 0 : lit(i - 1);
            return (
              <span
                key={name}
                style={{
                  minHeight: 36,
                  padding: "0 12px",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  borderRadius: 999,
                  border: `1px solid ${on ? C.ink : mixColor(C.line2, C.accent, l)}`,
                  background: on ? C.ink : mixColor(C.paper, C.tint, l),
                  color: on ? C.paper : mixColor(C.ink2, C.accent, l),
                  fontWeight: on || l > 0.5 ? 600 : 400,
                  fontSize: 13,
                  transform: `scale(${1 + 0.08 * l})`,
                }}
              >
                {name}
                <span style={{ opacity: 0.7, fontVariantNumeric: "tabular-nums" }}>{i === 0 ? 8 : counts[i - 1]}</span>
              </span>
            );
          })}
        </div>
        <div>
          {MINE.map((m) => (
            <WordRow
              key={m.hangul}
              hangul={m.hangul}
              hanja={m.hanja}
              gloss={m.gloss}
              meta={
                <span style={metaRow}>
                  <Gauge level={m.level} />
                  <span>{m.ago}</span>
                </span>
              }
            />
          ))}
        </div>
      </div>
    </>
  );
}

function ReviewCard({ frame }: { frame: number }) {
  const w = T.words;
  const text = typed(frame, TYPE4, w.type, w.success);
  const done = frame >= w.success;
  const shown = prog(frame, w.success, 10);
  // 読めた → 身についた。段階が進むところで、目盛りを少し大きく。
  const step = prog(frame, w.step, 14);
  const pulse = prog(frame, w.step, 8) * (1 - prog(frame, w.step + 12, 14));
  return (
    <>
      <SubBar back title="ふりかえる" count="あと3語" />
      <div style={{ position: "absolute", left: 0, right: 0, top: 61, padding: "20px 20px", display: "flex", flexDirection: "column", gap: 16 }}>
        {!done ? (
          <>
            <p style={{ margin: 0, fontSize: 15, lineHeight: 1.75, color: C.muted }}>集めた語の漢字です。字の音をつなげて、ハングルで打ってみてください。</p>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "20px 12px 16px", border: `1px solid ${C.line2}`, borderRadius: 16 }}>
              <div style={{ display: "flex", gap: 4 }}>
                {[..."大學"].map((g) => (
                  <span key={g} style={{ minWidth: 76, display: "flex", flexDirection: "column", alignItems: "center", gap: 2, padding: "6px 4px 8px" }}>
                    <span style={{ fontFamily: FONT.hanja, fontWeight: 500, fontSize: 64, lineHeight: 1.2 }}>{jpForm(g)}</span>
                    <span style={{ minHeight: 28, fontSize: 19, fontWeight: 600, color: C.line2 }}>・</span>
                  </span>
                ))}
              </div>
              <p style={note}>字を押すと、その字の音が出ます。</p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: 16, background: C.surface, borderRadius: 12 }}>
              <span style={label}>ハングルで読んでみる</span>
              <div style={{ display: "flex", gap: 8 }}>
                <Field text={text} caret={caretOn(frame, w.review + 6, typingNow(frame, TYPE4, w.type))} />
                <Btn disabled={!text} press={frame - w.submit} style={{ padding: "0 20px" }}>
                  読んだ
                </Btn>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {["字の音を見る", "答えを見る", "あとで"].map((x) => (
                <span key={x} style={{ minHeight: 40, padding: "0 16px", display: "inline-flex", alignItems: "center", border: `1px solid ${C.line2}`, borderRadius: 999, fontSize: 14, color: C.ink2 }}>
                  {x}
                </span>
              ))}
            </div>
          </>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16, opacity: shown, transform: `translateY(${(1 - shown) * 8}px)` }}>
            <p style={{ margin: 0, display: "inline-flex", alignItems: "center", gap: 6, fontSize: 15, fontWeight: 600, color: C.accent }}>
              <Icon name="check" size={18} />
              読めました。
            </p>
            <p style={{ margin: "-8px 0 0", paddingLeft: 24 }}>
              <span style={{ display: "inline-block", transform: `scale(${1 + 0.35 * pulse})`, transformOrigin: "0 100%" }}>
                <Gauge level={2 + step} />
              </span>
            </p>
            <Names hangul="대학" hanja="大學" gloss="大学、学部" />
            <Roots hangul="대학" hanja="大學" grow={[0, 1].map((i) => prog(frame, w.success + 6 + i * 3, 18))} />
            <Btn>次の語へ</Btn>
          </div>
        )}
      </div>
    </>
  );
}

function RoundEnd({ frame }: { frame: number }) {
  const w = T.words;
  // 読めるたびに、次は遠くなる：次のふりかえりの日に色を敷く。
  const far = prog(frame, w.cap9 + 30, 14);
  return (
    <>
      <SubBar back title="ふりかえる" />
      <div style={{ position: "absolute", left: 0, right: 0, top: 61, padding: "20px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
        <p style={{ margin: 0, fontSize: 17, fontWeight: 600, lineHeight: 1.6 }}>ふりかえりどきの語は、ひととおり終わりました。</p>
        <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
          <Btn>ことばに戻る</Btn>
        </div>
        <section style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 20 }}>
          <h2 style={{ ...label, paddingBottom: 8, borderBottom: `1px solid ${C.line}` }}>このひと回りでふりかえった語</h2>
          {REVIEWED.map((r, i) => (
            <div key={r.hangul} style={rise(frame, w.list + 6 + i * 5, 10, 12)}>
              <WordRow
                hangul={r.hangul}
                hanja={r.hanja}
                gloss={r.gloss}
                meta={
                  <span style={metaRow}>
                    <Gauge level={r.level} />
                    <span style={{ color: mixColor(C.faint, C.accent, far), fontWeight: far > 0.5 ? 600 : 400 }}>{r.next}</span>
                  </span>
                }
              />
            </div>
          ))}
        </section>
      </div>
    </>
  );
}

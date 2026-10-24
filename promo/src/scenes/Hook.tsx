// A. 丸暗記していた5語（회사・사회・회원・사원・회사원）は、3字の読み（会 회・社 사・員 원）の組み合わせだった。
// 一語ずつの札が消えて三つの字が並び、語が一つずつ組み上がる。そのたびに使った字が光る。3字で、5語。
// そこから字が増えて、つながりは網になる（Web.tsx：21字で、72語）。字は日本の字で（ui.tsx の 漢字の見せ方）。
import { fall, leave, prog, rise } from "../anim";
import { T } from "../timeline";
import { C, FONT } from "../theme";
import { Web } from "./Web";

/** `uses`：組み上がるときに光る札（0 會・1 社・2 員）。 */
const WORDS: { ko: string; jp: string; uses: number[] }[] = [
  { ko: "회사", jp: "会社", uses: [0, 1] },
  { ko: "사회", jp: "社会", uses: [1, 0] },
  { ko: "회원", jp: "会員", uses: [0, 2] },
  { ko: "사원", jp: "社員", uses: [1, 2] },
  { ko: "회사원", jp: "会社員", uses: [0, 1, 2] },
];

const big = { margin: 0, fontSize: 60, fontWeight: 600, lineHeight: 1.45, letterSpacing: "0.01em", fontFamily: FONT.ja, textAlign: "center" } as const;

export function Hook({ frame }: { frame: number }) {
  const t = T.hook;
  const at = [t.w1, t.w2, t.w3, t.w4, t.w5];
  // その字が、いま組み上がった語に使われているか（光の強さ 0 → 1 → 0）。
  const glow = (i: number) => Math.max(...WORDS.map((w, k) => (w.uses.includes(i) ? prog(frame, at[k], 5) * (1 - prog(frame, at[k] + 12, 10)) : 0)));
  return (
    <>
      <Web frame={frame} hookGlow={[glow(0), glow(1), glow(2)]} />
      {/* 問い：最初のコマから見えている */}
      <div style={{ position: "absolute", top: 150, left: 0, right: 0, ...(frame >= t.split ? leave(frame, t.split, 10, 12) : {}) }}>
        <p style={big}>韓国語の単語、</p>
        <p style={big}>一つずつ丸暗記していませんか？</p>
      </div>
      {/* 一語ずつ覚えていた札 */}
      <div style={{ position: "absolute", top: 520, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 22, ...(frame >= t.split ? leave(frame, t.split, 12, 16) : {}) }}>
        {WORDS.map((w, i) => (
          <div
            key={w.ko}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 6,
              padding: "22px 30px",
              border: `1.5px solid ${C.line2}`,
              borderRadius: 18,
              background: C.paper,
              ...fall(frame, t.cards + i * 7, 18, 16),
            }}
          >
            <span style={{ fontFamily: FONT.ko, fontSize: 50, fontWeight: 600, lineHeight: 1.2 }}>{w.ko}</span>
            <span style={{ fontSize: 26, color: C.muted }}>{w.jp}</span>
          </div>
        ))}
      </div>

      {/* 読みを一字ずつ */}
      <p style={{ ...big, position: "absolute", top: 160, left: 0, right: 0, ...(frame >= t.count ? leave(frame, t.count, 9, 12) : fall(frame, t.split + 6, 16, 16)) }}>
        漢字の読みを、一字ずつ覚えると──
      </p>
      <p style={{ ...big, position: "absolute", top: 146, left: 0, right: 0, fontSize: 72, ...(frame >= t.net ? leave(frame, t.net, 9, 12) : fall(frame, t.count + 8, 16, 16)) }}>
        <span style={{ color: C.accent }}>3</span>字で、<span style={{ color: C.accent }}>5</span>語。
      </p>
      {/* 組み上がる語 */}
      <div style={{ position: "absolute", top: 704, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 20, ...(frame >= t.net ? leave(frame, t.net, 10, 14) : {}) }}>
        {WORDS.map((w, i) => (
          <div
            key={w.ko}
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: 14,
              padding: "16px 28px",
              border: `1.5px solid ${C.accent}`,
              borderRadius: 999,
              background: C.tint,
              ...rise(frame, at[i], 22, 14),
            }}
          >
            <span style={{ fontFamily: FONT.ko, fontSize: 44, fontWeight: 600, lineHeight: 1.2 }}>{w.ko}</span>
            <span style={{ fontFamily: FONT.hanja, fontWeight: 500, fontSize: 34, color: C.ink2 }}>{w.jp}</span>
          </div>
        ))}
      </div>

      {/* 字が増えると */}
      <p style={{ ...big, position: "absolute", top: 70, left: 0, right: 0, fontSize: 54, ...(frame >= t.known ? leave(frame, t.known, 10, 12) : fall(frame, t.net + 8, 16, 16)) }}>
        字が増えるほど、つながりは広がる。
      </p>
      <div style={{ position: "absolute", top: 452, left: 0, right: 0, ...fall(frame, t.known + 6, 16, 16) }}>
        <p style={big}>漢字は、もう知っている。</p>
        <p style={big}>足りないのは、韓国語の読みだけ。</p>
      </div>
    </>
  );
}

// 一目でわかる紹介画像（1920×1080 の一枚。X の投稿や、映像の表紙に）。
//   左：名前と一行、「野球が 야구、体育が 체육 なら、球体は？」を字の札で：野球 の 球（구）と 体育 の 体（체）が
//   下りてきて、習っていない 球体（구체）が読める。右：その 구체 を 読んでみる で読めたところの、アプリの画面。
// 字は日本の字で（ui.tsx の 漢字の見せ方）。画面は映像と同じ部品（Story.tsx の ReadScreen）。
import { AbsoluteFill, Img, staticFile } from "remotion";
import { ReadScreen } from "./scenes/Story";
import { C, FONT, useFonts } from "./theme";
import { T } from "./timeline";

type Tone = "accent" | "again";
const toneColor = (t?: Tone) => (t === "accent" ? C.accent : t === "again" ? C.again : C.line2);
const toneTint = (t?: Tone) => (t === "accent" ? C.tint : t === "again" ? C.againTint : C.paper);

const TILE = { w: 118, h: 156 };

/** 字の札：上に韓国語の音、下に字。`tone`：下りていく字の色。 */
function Tile({ ko, kanji, x, y, tone }: { ko: string; kanji: string; x: number; y: number; tone?: Tone }) {
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: TILE.w,
        height: TILE.h,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 2,
        border: `2px solid ${toneColor(tone)}`,
        borderRadius: 20,
        background: toneTint(tone),
      }}
    >
      <span style={{ fontFamily: FONT.ko, fontSize: 34, fontWeight: 600, lineHeight: 1.2, color: tone ? toneColor(tone) : C.ink }}>{ko}</span>
      <span style={{ fontFamily: FONT.hanja, fontWeight: 500, fontSize: 70, lineHeight: 1.15 }}>{kanji}</span>
    </div>
  );
}

/** 札の位置（左上）。上の段：野球・体育。下の段：球体。 */
const ROW_A = 548;
const ROW_B = 792;
const POS = {
  ya: { x: 110, y: ROW_A },
  gu: { x: 110 + TILE.w + 12, y: ROW_A },
  che: { x: 520, y: ROW_A },
  yuk: { x: 520 + TILE.w + 12, y: ROW_A },
  gu2: { x: 315, y: ROW_B },
  che2: { x: 315 + TILE.w + 12, y: ROW_B },
};
const bottom = (p: { x: number; y: number }) => ({ x: p.x + TILE.w / 2, y: p.y + TILE.h });
const top = (p: { x: number; y: number }) => ({ x: p.x + TILE.w / 2, y: p.y });

/** 上の札から下の札へ、根のように下りる線。 */
function Root({ from, to, tone }: { from: { x: number; y: number }; to: { x: number; y: number }; tone: Tone }) {
  const a = bottom(from);
  const b = top(to);
  const mid = (a.y + b.y) / 2;
  return <path d={`M${a.x} ${a.y + 6} C${a.x} ${mid}, ${b.x} ${mid}, ${b.x} ${b.y - 6}`} fill="none" stroke={toneColor(tone)} strokeWidth={4} strokeLinecap="round" strokeDasharray="2 10" />;
}

/** 電話の枠と、その中のアプリの画面（読んでみる：구체 が読めたところ）。 */
const PHONE = { x: 1236, y: 64, w: 520, h: 1060, frame: 14, scale: 1.22 };

function Phone() {
  const sw = PHONE.w - PHONE.frame * 2;
  const sh = PHONE.h - PHONE.frame * 2;
  const app = { w: sw / PHONE.scale, h: sh / PHONE.scale };
  return (
    <div style={{ position: "absolute", left: PHONE.x, top: PHONE.y, width: PHONE.w, height: PHONE.h, borderRadius: 72, background: C.ink, padding: PHONE.frame }}>
      <div style={{ position: "relative", width: sw, height: sh, borderRadius: 58, overflow: "hidden", background: C.paper }}>
        <div style={{ position: "absolute", left: 0, top: 0, width: app.w, height: app.h, transform: `scale(${PHONE.scale})`, transformOrigin: "0 0" }}>
          {/* 上の、時計や電池のあたり */}
          <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: 46 }} />
          <div style={{ position: "absolute", left: 0, right: 0, top: 46, bottom: 0 }}>
            <ReadScreen frame={T.read.success + 60} />
          </div>
        </div>
        <div style={{ position: "absolute", left: "50%", top: 14, width: 124, height: 34, marginLeft: -62, borderRadius: 17, background: C.ink }} />
      </div>
    </div>
  );
}

export function Card() {
  useFonts();
  return (
    <AbsoluteFill style={{ background: C.paper, color: C.ink, fontFamily: FONT.ui, WebkitFontSmoothing: "antialiased" }}>
      <style>{"* { box-sizing: border-box; }"}</style>
      {/* 名前 */}
      <div style={{ position: "absolute", left: 110, top: 88, display: "flex", alignItems: "center", gap: 22 }}>
        {/* アイコンの地は紙とほぼ同じ色なので、細い枠でアイコンの形を見せる */}
        <Img src={staticFile("app/icon.png")} style={{ width: 84, height: 84, boxSizing: "border-box", borderRadius: "22%", border: `1.5px solid ${C.line}` }} />
        <span style={{ fontFamily: FONT.mincho, fontWeight: 700, fontSize: 48, letterSpacing: "0.12em" }}>ことのね</span>
        <span style={{ marginLeft: 10, padding: "6px 16px", border: `1.5px solid ${C.line2}`, borderRadius: 999, fontSize: 22, color: C.muted }}>登録なし・ブラウザですぐに</span>
      </div>
      {/* 一行 */}
      <div style={{ position: "absolute", left: 110, top: 210 }}>
        <p style={{ margin: 0, fontSize: 72, fontWeight: 600, lineHeight: 1.36, letterSpacing: "0.01em" }}>覚えた韓国語を、</p>
        <p style={{ margin: 0, fontSize: 72, fontWeight: 600, lineHeight: 1.36, letterSpacing: "0.01em" }}>漢字の根でつなぐ。</p>
      </div>
      {/* 野球が 야구、体育が 체육 なら、球体は？ */}
      <p style={{ position: "absolute", left: 110, top: 462, margin: 0, fontSize: 38, fontWeight: 500, color: C.ink2 }}>
        野球が <span style={{ fontFamily: FONT.ko, fontWeight: 600, color: C.ink }}>야구</span>、体育が <span style={{ fontFamily: FONT.ko, fontWeight: 600, color: C.ink }}>체육</span> なら、球体は？
      </p>
      <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
        <Root from={POS.gu} to={POS.gu2} tone="accent" />
        <Root from={POS.che} to={POS.che2} tone="again" />
      </svg>
      <Tile ko="야" kanji="野" {...POS.ya} />
      <Tile ko="구" kanji="球" {...POS.gu} tone="accent" />
      <span style={{ position: "absolute", left: 412, top: ROW_A + 44, width: 80, textAlign: "center", fontSize: 56, fontWeight: 300, color: C.faint }}>+</span>
      <Tile ko="체" kanji="体" {...POS.che} tone="again" />
      <Tile ko="육" kanji="育" {...POS.yuk} />
      <Tile ko="구" kanji="球" {...POS.gu2} tone="accent" />
      <Tile ko="체" kanji="体" {...POS.che2} tone="again" />
      <div style={{ position: "absolute", left: 600, top: ROW_B + 12 }}>
        <p style={{ margin: 0, fontSize: 52, fontWeight: 600, lineHeight: 1.35 }}>
          = <span style={{ fontFamily: FONT.ko, color: C.accent }}>구체</span>
        </p>
        <p style={{ margin: 0, fontSize: 34, fontWeight: 600, lineHeight: 1.6 }}>習っていない語なのに、読める。</p>
      </div>
      {/* 下の一行 */}
      <p style={{ position: "absolute", left: 110, bottom: 56, margin: 0, fontSize: 31, fontWeight: 500, color: C.ink2 }}>
        漢字は、もう知っている。足りないのは、韓国語の読みだけ。
      </p>
      <Phone />
    </AbsoluteFill>
  );
}

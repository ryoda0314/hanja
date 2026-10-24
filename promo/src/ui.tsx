// ことのね の画面を、映像のために描き直したもの（../src/**/*.module.css、../src/index.css、../src/app.module.css）。
// 大きさはアプリの px のまま。画面は CSS の拡大で大きく見せる。ひとりでには動かない：どの変化もコマで決まる。
import type { CSSProperties, ReactNode } from "react";
import { Img, staticFile } from "remotion";
import { C, FONT } from "./theme";

// ---- アイコン（../src/components/Icon.tsx） ----------------------------------------------------------------------

const PATHS = {
  // 芽と根：地面の上に二枚の葉、下に根。
  collect: (
    <>
      <path d="M12 13V8.5" />
      <path d="M12 9.5C12 6.4 9.9 4.5 6.6 4.5c0 3 2.1 5 5.4 5z" />
      <path d="M12 8.5c0-2.8 1.9-4.6 5-4.6 0 2.8-1.9 4.6-5 4.6z" />
      <path d="M4.5 13h15" />
      <path d="M12 13v7" />
      <path d="M12 15.5l-3.5 3" />
      <path d="M12 15.5l3.5 3" />
    </>
  ),
  find: (
    <>
      <circle cx="11" cy="11" r="6" />
      <path d="M20 20l-4.5-4.5" />
    </>
  ),
  words: (
    <>
      <path d="M12 7c-2.2-1.6-5.2-2.1-8.5-1.6v13c3.3-.5 6.3 0 8.5 1.6 2.2-1.6 5.2-2.1 8.5-1.6v-13C17.2 4.9 14.2 5.4 12 7z" />
      <path d="M12 7v13" />
    </>
  ),
  hanja: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="2.5" />
      <path d="M12 4v16" strokeDasharray="2 2.2" />
      <path d="M4 12h16" strokeDasharray="2 2.2" />
    </>
  ),
  me: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" />
    </>
  ),
  back: <path d="M15 18l-6-6 6-6" />,
  close: (
    <>
      <path d="M6 6l12 12" />
      <path d="M18 6L6 18" />
    </>
  ),
  arrow: (
    <>
      <path d="M5 12h14" />
      <path d="M13 6l6 6-6 6" />
    </>
  ),
  speaker: (
    <>
      <path d="M11 5 6 9H3v6h3l5 4z" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7" />
      <path d="M18.5 5.5a9 9 0 0 1 0 13" />
    </>
  ),
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
};
export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 20, color = "currentColor", stroke = 1.8 }: { name: IconName; size?: number; color?: string; stroke?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" style={{ display: "block", flexShrink: 0 }}>
      {PATHS[name]}
    </svg>
  );
}

// ---- 小さな部品 ------------------------------------------------------------------------------------------------------

export const label: CSSProperties = { margin: 0, fontSize: 13, fontWeight: 600, color: C.muted };
export const note: CSSProperties = { margin: 0, fontSize: 13, color: C.muted, lineHeight: 1.7 };

export const rgba = (hex: string, a: number) => `rgba(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(",")},${a})`;

/** 上下だけ切る（右端の輪が少しはみ出せるように）。 */
export const CLIP_Y: CSSProperties = { clipPath: "inset(0 -80px)" };

/** `p` が 0 → 1 で、高さ 0 から伸びる（下のものがなめらかに動く）。 */
export function Grow({ p, children }: { p: number; children: ReactNode }) {
  return (
    <div style={{ display: "grid", gridTemplateRows: `${Math.max(0, Math.min(1, p))}fr` }}>
      <div style={{ minHeight: 0, ...CLIP_Y }}>{children}</div>
    </div>
  );
}

/** 指で押したところ：輪が寄って、離れる。`t` は押してからのコマ（前なら負）。 */
export function Press({ t, x = "50%", y = "50%", size = 46 }: { t: number; x?: number | string; y?: number | string; size?: number }) {
  if (t < -8 || t > 16) return null;
  const inP = Math.min(1, (t + 8) / 8);
  const outP = t > 0 ? Math.min(1, t / 16) : 0;
  return (
    <span
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: size,
        height: size,
        marginLeft: -size / 2,
        marginTop: -size / 2,
        borderRadius: "50%",
        background: rgba(C.ink, 0.14 * inP * (1 - outP)),
        border: `2px solid ${rgba(C.ink, 0.32 * inP * (1 - outP))}`,
        transform: `scale(${1.25 - 0.25 * inP + 0.5 * outP})`,
        pointerEvents: "none",
        zIndex: 5,
      }}
    />
  );
}

/** ボタン（index.css の .btn / .btn-quiet）。 */
export function Btn({ children, quiet = false, press = -99, disabled = false, style }: { children: ReactNode; quiet?: boolean; press?: number; disabled?: boolean; style?: CSSProperties }) {
  const pressed = press >= 0 && press < 6;
  return (
    <span
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        minHeight: 52,
        padding: quiet ? "0 20px" : "0 24px",
        borderRadius: 12,
        border: `1px solid ${quiet ? C.line2 : C.accent}`,
        background: quiet ? C.paper : C.accent,
        color: quiet ? C.ink : "#fff",
        fontSize: quiet ? 15 : 16,
        fontWeight: quiet ? 500 : 600,
        fontFamily: FONT.ui,
        opacity: disabled ? 0.55 : 1,
        transform: pressed ? "scale(0.97)" : undefined,
        flexShrink: 0,
        ...style,
      }}
    >
      {children}
      <Press t={press} />
    </span>
  );
}

export function Caret({ height = "1.15em" }: { height?: string }) {
  return <span style={{ display: "inline-block", width: 1.5, height, marginLeft: 1, marginRight: -2.5, verticalAlign: "-0.2em", background: C.ink }} />;
}

/** 読み上げのボタン（SpeakButton.module.css）。 */
export function Speak({ size = 44 }: { size?: number }) {
  return (
    <span
      style={{
        flexShrink: 0,
        width: size,
        height: size,
        borderRadius: "50%",
        border: `1px solid ${C.line2}`,
        background: C.paper,
        color: C.ink,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Icon name="speaker" size={size >= 60 ? 24 : 20} />
    </span>
  );
}

/** アイコンと、明朝の ことのね（Logo.module.css の sm）。 */
export function Logo() {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
      <Img src={staticFile("app/icon.png")} style={{ width: 28, height: 28, borderRadius: "22%" }} />
      <span style={{ fontFamily: FONT.mincho, fontWeight: 700, fontSize: 17, letterSpacing: "0.06em", lineHeight: 1.2 }}>ことのね</span>
    </span>
  );
}

/** 日本語 → 한국어（Layout の PairLink）。 */
export function Pair() {
  return (
    <span style={{ minHeight: 44, padding: "0 16px", border: `1px solid ${C.line2}`, borderRadius: 999, display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13 }}>
      <span>日本語</span>
      <Icon name="arrow" size={16} />
      <span style={{ fontFamily: FONT.ko }}>한국어</span>
    </span>
  );
}

/** 打つ欄：打った字（なければ薄い見本）と、点滅する縦棒。 */
export function Field({ text, placeholder = "", caret, size = 20, height = 52 }: { text: string; placeholder?: string; caret: boolean; size?: number; height?: number }) {
  return (
    <span
      style={{
        flex: 1,
        minWidth: 0,
        minHeight: height,
        padding: "0 14px",
        border: `1.5px solid ${C.ink}`,
        borderRadius: 12,
        background: C.paper,
        display: "flex",
        alignItems: "center",
        fontSize: size,
        fontFamily: FONT.ko,
      }}
    >
      {text ? (
        <span>
          {text}
          {caret ? <Caret /> : null}
        </span>
      ) : (
        <span style={{ position: "relative" }}>
          {caret ? <Caret /> : null}
          <span style={{ color: C.faint }}>{placeholder}</span>
        </span>
      )}
    </span>
  );
}

// ---- 漢字の見せ方（hanja.module.css、HanjaText、Roots） ----------------------------------------------------------
// 映像の漢字は日本の字で見せる（日本の人に向けたアプリなので）。アプリの 漢字の字形 を「日本の字」にしたときの画面：
// 字は日本の字だけ、韓国の字形は添えない。字の情報はアプリの辞書と同じく韓国の字形（學・會・體）で引く。

/** 字の情報（辞書の hanja-chars.json から：音・訓・日本の字・いちばんよく使う音読み・アプリが出す日本語の読み）。 */
export const CHAR: Record<string, { eum: string; hun?: string; jp?: string; on: string; ja: string }> = {
  學: { eum: "학", hun: "배울", jp: "学", on: "ガク", ja: "ガク・まなぶ" },
  生: { eum: "생", hun: "날", on: "セイ", ja: "セイ・いきる" },
  大: { eum: "대", hun: "큰", on: "ダイ", ja: "ダイ・おお" },
  會: { eum: "회", jp: "会", on: "カイ", ja: "カイ・あう" },
  社: { eum: "사", on: "シャ", ja: "シャ・やしろ" },
  員: { eum: "원", on: "イン", ja: "イン・かず" },
  野: { eum: "야", on: "ヤ", ja: "ヤ・の" },
  球: { eum: "구", on: "キュウ", ja: "キュウ・たま" },
  體: { eum: "체", jp: "体", on: "タイ", ja: "タイ・からだ" },
  育: { eum: "육", hun: "기를", on: "イク", ja: "イク・そだつ" },
};

/** 日本の字に（アプリの jpForm）。學生 → 学生。 */
export const jpForm = (hanja: string) => [...hanja].map((c) => CHAR[c]?.jp ?? c).join("");

/** 語の漢字（HanjaText）。 */
export function Hanja({ hanja, size, color = C.ink2 }: { hanja: string; size: number; color?: string }) {
  return <span style={{ fontFamily: FONT.hanja, fontWeight: 500, fontSize: size, lineHeight: 1.4, color }}>{jpForm(hanja)}</span>;
}

/** 伏せた漢字（まだ集めていない語）。 */
export function Masked({ count, size }: { count: number; size: number }) {
  return <span style={{ fontFamily: FONT.hanja, fontSize: size, lineHeight: 1.4, color: C.faint, letterSpacing: "0.08em" }}>{"？".repeat(count)}</span>;
}

export type Note = { kind: "new" | "again"; n?: number };

/**
 * 語を漢字の根に分けた並び：音節、字、訓と音、日本語の読み、添え書き。
 * `grow`：字ごとに下から現れる度合い（0 → 1）。`masked`：字を ？ で伏せる。
 */
export function Roots({ hangul, hanja, masked = false, grow, notes }: { hangul: string; hanja: string; masked?: boolean; grow?: number[]; notes?: (Note | null)[] }) {
  const chars = [...hanja];
  const syll = [...hangul];
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${chars.length}, minmax(0, 1fr))`, gap: 1, background: C.line, borderTop: `1px solid ${C.line}`, borderBottom: `1px solid ${C.line}` }}>
      {chars.map((ch, i) => {
        const d = CHAR[ch];
        const g = grow?.[i] ?? 1;
        const n = notes?.[i];
        return (
          <div key={i} style={{ background: C.paper, minWidth: 0 }}>
            <div
              style={{
                position: "relative",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 2,
                padding: "12px 4px 14px",
                textAlign: "center",
                opacity: g,
                transform: `translateY(${(1 - g) * 14}px)`,
              }}
            >
              <span style={{ fontFamily: FONT.ko, fontSize: 15, fontWeight: 500, color: C.ink2, lineHeight: 1.4 }}>{syll[i]}</span>
              {masked ? (
                <span style={{ fontFamily: FONT.hanja, fontSize: 52, lineHeight: 1.2, color: C.line2 }}>？</span>
              ) : (
                <>
                  <span style={{ fontFamily: FONT.hanja, fontWeight: 500, fontSize: 52, lineHeight: 1.2 }}>{d?.jp ?? ch}</span>
                  <span style={{ fontFamily: FONT.ko, fontSize: 14, color: C.ink2, lineHeight: 1.5 }}>
                    {d.hun ? <span style={{ fontSize: 12, color: C.muted }}>{d.hun} </span> : null}
                    <span style={{ fontWeight: 600, color: C.ink }}>{d.eum}</span>
                  </span>
                  <span style={{ fontSize: 12, color: C.muted, lineHeight: 1.5 }}>{d.ja}</span>
                  {n ? (
                    <span style={{ marginTop: 4, fontSize: 11, fontWeight: 600, lineHeight: 1.4, letterSpacing: "0.02em", color: n.kind === "new" ? C.accent : C.again }}>
                      {n.kind === "new" ? (
                        "はじめての字"
                      ) : (
                        <>
                          また出会った字
                          <br />
                          {n.n}語目
                        </>
                      )}
                    </span>
                  ) : null}
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * 字のカード（CharCard）：明朝の字、韓国語の音と日本語の音読み、根の深さ（1・2・3〜4・5語以上の雨粒）。
 * `hl`：音と音読みに色を敷く度合い（対応を見せるとき）。
 */
export function CharCard({ char, count, hl = 0, style }: { char: string; count: number; hl?: number; style?: CSSProperties }) {
  const d = CHAR[char];
  const level = count >= 5 ? 4 : count >= 3 ? 3 : count;
  const mark = hl > 0 ? { background: `rgba(227,241,233,${hl})`, color: hl > 0.5 ? C.accent : undefined, borderRadius: 4, padding: "0 3px", margin: "0 -3px" } : {};
  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 4,
        padding: "14px 6px 12px",
        border: `1px solid ${C.line2}`,
        borderRadius: 12,
        background: C.paper,
        ...style,
      }}
    >
      <span style={{ fontFamily: FONT.hanja, fontWeight: 500, fontSize: 44, lineHeight: 1.2 }}>{d.jp ?? char}</span>
      <span style={{ display: "flex", alignItems: "baseline", gap: 6, fontSize: 15, fontWeight: 600, lineHeight: 1.4 }}>
        <span style={{ fontFamily: FONT.ko, ...mark }}>{d.eum}</span>
        <span style={{ fontSize: 11, fontWeight: 400, color: C.muted, ...mark }}>{d.on}</span>
      </span>
      <span style={{ display: "inline-flex", alignItems: "flex-end", gap: 6, fontSize: 11, fontWeight: 600, color: C.accent }}>
        <span style={{ display: "inline-flex", alignItems: "flex-end", gap: 3 }}>
          {[6, 9, 12, 15].map((h, k) => (
            <i key={k} style={{ display: "block", width: 3, height: h, borderRadius: 2, background: k < level ? C.accent : C.line2 }} />
          ))}
        </span>
        {count}語
      </span>
    </div>
  );
}

/** 語の名前（大きなハングルと漢字）と読み上げ、意味（Collect の Names、WordSheet の top）。 */
export function Names({ hangul, hanja, gloss, masked = false, hanjaStyle }: { hangul: string; hanja: string; gloss?: string; masked?: boolean; hanjaStyle?: CSSProperties }) {
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: "2px 14px" }}>
          <span style={{ fontFamily: FONT.ko, fontSize: 34, fontWeight: 500, lineHeight: 1.35 }}>{hangul}</span>
          <span style={{ display: "inline-block", ...hanjaStyle }}>{masked ? <Masked count={[...hanja].length} size={26} /> : <Hanja hanja={hanja} size={26} />}</span>
        </div>
        <Speak size={64} />
      </div>
      {gloss ? <p style={{ margin: "-8px 0 0", fontSize: 15, lineHeight: 1.7, color: C.ink2 }}>{gloss}</p> : null}
    </>
  );
}

/** 語の一行（app.module.css の wordRow）。 */
export function WordRow({ hangul, hanja, gloss, meta }: { hangul: string; hanja: string; gloss: string; meta?: ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 0", borderBottom: `1px solid ${C.line}` }}>
      <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
        <span style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: "2px 12px" }}>
          <span style={{ fontFamily: FONT.ko, fontSize: 20, fontWeight: 500, lineHeight: 1.5 }}>{hangul}</span>
          <Hanja hanja={hanja} size={18} />
        </span>
        <span style={{ fontSize: 13, color: C.muted, lineHeight: 1.6 }}>{gloss}</span>
        {meta ? <span style={{ fontSize: 12, color: C.faint }}>{meta}</span> : null}
      </span>
      <span style={{ color: C.faint, display: "inline-flex", transform: "rotate(180deg)" }}>
        <Icon name="back" size={18} />
      </span>
    </div>
  );
}

/** あつめると読める語が増える数（Gain：before）。 */
export function GainBefore({ count }: { count: number }) {
  return (
    <p style={{ margin: 0, display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: "2px 6px" }}>
      <span style={{ fontSize: 15, fontWeight: 500, color: C.ink2 }}>あつめると、読める語が</span>
      <strong style={{ fontSize: 30, fontWeight: 600, lineHeight: 1.2, color: C.accent }}>{count}</strong>
      <span style={{ fontSize: 15, fontWeight: 500, color: C.ink2 }}>語増えます</span>
    </p>
  );
}

/** 読めるようになった数（Gain：after）。 */
export function GainAfter({ shown }: { shown: number }) {
  return (
    <p style={{ margin: 0, display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: "2px 6px", padding: "14px 16px", background: C.tint, borderRadius: 12 }}>
      <strong style={{ fontSize: 44, fontWeight: 600, lineHeight: 1.1, color: C.accent }}>+{shown}</strong>
      <span style={{ fontSize: 15, fontWeight: 600, color: C.accent }}>語、読めるようになりました</span>
    </p>
  );
}

export const STAGES = ["あつめた", "また出会った", "読めた", "身についた"] as const;

/** 覚え具合の目盛り（Stage.module.css）：段階が進むごとに雨粒が一つ増える。`level` は 0〜3（途中の値で色が移る）。 */
export function Gauge({ level }: { level: number }) {
  const shown = Math.round(level);
  return (
    <span style={{ display: "inline-flex", alignItems: "flex-end", gap: 8, fontSize: 11, fontWeight: 600, letterSpacing: "0.04em", color: shown === 0 ? C.muted : C.accent }}>
      <span style={{ display: "inline-flex", alignItems: "flex-end", gap: 3 }}>
        {[7, 10, 13, 16].map((h, k) => {
          const on = Math.max(0, Math.min(1, level - k + 1));
          return <i key={k} style={{ display: "block", width: 3, height: h, borderRadius: 2, background: k === 0 || on >= 1 ? C.accent : on > 0 ? mixHex(C.line2, C.accent, on) : C.line2 }} />;
        })}
      </span>
      {STAGES[shown]}
    </span>
  );
}

function mixHex(a: string, b: string, p: number) {
  const ca = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const cb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return `rgb(${ca.map((x, i) => Math.round(x + (cb[i] - x) * p)).join(",")})`;
}

// ---- 文で出会う の文（SentenceView.module.css、Meet.module.css） -------------------------------------------------

/** 文の一切れ：ただの字か、印の語（集めた語・集めた字で読める語・まだの語）と、上に添える漢字。`spot`：語を灯す度合い。 */
export type Seg = string | { text: string; kind: "owned" | "readable" | "new"; rt: string; press?: number; spot?: number };

/** 印の付いた韓国語の文。 */
export function Sentence({ segs, size = 21 }: { segs: Seg[]; size?: number }) {
  return (
    <span style={{ fontFamily: FONT.ko, fontSize: size, fontWeight: 500, lineHeight: 2.05 }}>
      {segs.map((s, i) =>
        typeof s === "string" ? (
          <span key={i}>{s}</span>
        ) : (
          <span
            key={i}
            style={{
              position: "relative",
              display: "inline-block",
              borderRadius: 8,
              boxShadow: s.spot ? `0 0 0 ${2 + 4 * s.spot}px ${rgba(C.accent, 0.3 * s.spot)}` : undefined,
            }}
          >
          <ruby
            style={{
              borderRadius: 4,
              textDecorationLine: "underline",
              textDecorationThickness: s.kind === "owned" ? 2 : 2.5,
              textUnderlineOffset: "0.3em",
              textDecorationStyle: s.kind === "owned" ? "dotted" : "solid",
              textDecorationColor: s.kind === "owned" ? C.again : C.accent,
              background: s.kind === "readable" ? C.tint : undefined,
              padding: s.kind === "readable" ? "0 0.1em" : undefined,
            }}
          >
            {s.text}
            <rt
              style={{
                fontSize: "0.5em",
                letterSpacing: "0.04em",
                fontFamily: s.kind === "owned" ? FONT.hanja : FONT.ui,
                fontWeight: s.kind === "owned" ? 500 : 600,
                color: s.kind === "owned" ? C.again : C.accent,
              }}
            >
              {s.rt}
            </rt>
          </ruby>
          {s.press !== undefined ? <Press t={s.press} y="62%" size={50} /> : null}
          </span>
        ),
      )}
    </span>
  );
}

/** 雨の一文：雨粒の印、印の付いた文、訳、読み上げ（Meet の item）。`drop`：雨粒の印が着地する度合い。 */
export function RainItem({ segs, ja, drop = 1, style }: { segs: Seg[]; ja: string; drop?: number; style?: CSSProperties }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 0", borderBottom: `1px solid ${C.line}`, ...style }}>
      <span style={{ flexShrink: 0, alignSelf: "stretch", width: 3, margin: "6px 0", borderRadius: 2, background: C.line2, transformOrigin: "top", transform: `scaleY(${drop})` }} />
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
        <Sentence segs={segs} />
        <span style={{ fontSize: 14, color: C.muted, lineHeight: 1.6 }}>{ja}</span>
      </div>
      <Speak />
    </div>
  );
}

/** 印の見方。 */
export function Legend() {
  const sample = (kind: "owned" | "readable" | "new") => (
    <span
      style={{
        fontFamily: FONT.ko,
        fontSize: 13,
        color: C.ink2,
        textDecorationLine: "underline",
        textDecorationThickness: kind === "owned" ? 2 : 2.5,
        textUnderlineOffset: "0.3em",
        textDecorationStyle: kind === "owned" ? "dotted" : "solid",
        textDecorationColor: kind === "owned" ? C.again : C.accent,
        background: kind === "readable" ? C.tint : undefined,
        borderRadius: 4,
        padding: kind === "readable" ? "0 0.1em" : undefined,
      }}
    >
      가나
    </span>
  );
  return (
    <span style={{ display: "inline-flex", flexWrap: "wrap", gap: "4px 14px", fontSize: 12, color: C.muted }}>
      <span style={{ display: "inline-flex", alignItems: "baseline", gap: 6 }}>
        {sample("owned")}集めた語
      </span>
      <span style={{ display: "inline-flex", alignItems: "baseline", gap: 6 }}>
        {sample("readable")}集めた字で読める
      </span>
      <span style={{ display: "inline-flex", alignItems: "baseline", gap: 6 }}>
        {sample("new")}まだの語
      </span>
    </span>
  );
}

/** 押せる小さな札（チェックの好み）。 */
export function Toggle({ on, children }: { on: boolean; children: ReactNode }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, minHeight: 36, fontSize: 13, color: C.ink2 }}>
      <span
        style={{
          width: 18,
          height: 18,
          borderRadius: 4,
          border: `1.5px solid ${on ? C.accent : C.line2}`,
          background: on ? C.accent : C.paper,
          color: "#fff",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {on ? <Icon name="check" size={14} stroke={2.6} /> : null}
      </span>
      {children}
    </span>
  );
}

/** 上のバー（app.module.css の subbar）。 */
export function SubBar({ title, count, back = false }: { title: string; count?: string; back?: boolean }) {
  return (
    <header style={{ position: "absolute", left: 0, right: 0, top: 0, height: 61, padding: back ? "8px 12px 8px 8px" : "8px 12px 8px 8px", display: "flex", alignItems: "center", gap: 4, borderBottom: `1px solid ${C.line}`, background: C.paper, zIndex: 2 }}>
      {back ? (
        <span style={{ width: 44, height: 44, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
          <Icon name="back" size={22} />
        </span>
      ) : null}
      <h1 style={{ flex: 1, minWidth: 0, margin: 0, fontSize: 15, fontWeight: 600, paddingLeft: back ? 0 : 12 }}>{title}</h1>
      {count ? <span style={{ fontSize: 13, color: C.muted, paddingRight: 8 }}>{count}</span> : null}
    </header>
  );
}

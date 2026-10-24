import type { CSSProperties } from "react";
import { Easing, interpolate } from "remotion";

export const FPS = 30;

/** 秒 → コマ。 */
export const f = (seconds: number) => Math.round(seconds * FPS);

// アプリの雨（Meet.module.css）：上から降ってきて落ち着く。ことのあめ と同じ。
export const FALL = Easing.bezier(0.2, 0.8, 0.3, 1);
export const SOFT = Easing.bezier(0.33, 0, 0.2, 1);

/** `start` から `dur` コマで 0 → 1。 */
export function prog(frame: number, start: number, dur: number, easing: (t: number) => number = FALL): number {
  if (dur <= 0) return frame >= start ? 1 : 0;
  return interpolate(frame, [start, start + dur], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing });
}

/** 上から降ってくる。 */
export function fall(frame: number, start: number, dist = 18, dur = f(0.55)): CSSProperties {
  const p = prog(frame, start, dur);
  return { opacity: p, transform: `translateY(${(1 - p) * -dist}px)` };
}

/** 下からせり上がる（根が伸びるように）。 */
export function rise(frame: number, start: number, dist = 14, dur = f(0.6)): CSSProperties {
  const p = prog(frame, start, dur);
  return { opacity: p, transform: `translateY(${(1 - p) * dist}px)` };
}

/** 少し上がりながら、静かに消える。 */
export function leave(frame: number, start: number, dur = f(0.4), dist = 10): CSSProperties {
  const p = prog(frame, start, dur, SOFT);
  return { opacity: 1 - p, transform: `translateY(${p * -dist}px)` };
}

export const mix = (a: number, b: number, p: number) => a + (b - a) * p;

/** 色から色へ（どちらも #rrggbb）。 */
export function mixColor(a: string, b: string, p: number): string {
  const ca = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const cb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return `rgb(${ca.map((x, i) => Math.round(mix(x, cb[i], p))).join(",")})`;
}

// ---- ハングルを打つ：韓国語の入力のとおり、字母を一つずつ打って音節に組み上がる -------------------------------
// 학생 は ㅎ → 하 → 학 → 핛（ㅅ がいったん 학 の下に付く）→ 학새 → 학생。

const L = "ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ";
const T = ["", "ㄱ", "ㄲ", "ㄳ", "ㄴ", "ㄵ", "ㄶ", "ㄷ", "ㄹ", "ㄺ", "ㄻ", "ㄼ", "ㄽ", "ㄾ", "ㄿ", "ㅀ", "ㅁ", "ㅂ", "ㅄ", "ㅅ", "ㅆ", "ㅇ", "ㅈ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"];
const CLUSTER: Record<string, string> = {
  ㄱㅅ: "ㄳ",
  ㄴㅈ: "ㄵ",
  ㄴㅎ: "ㄶ",
  ㄹㄱ: "ㄺ",
  ㄹㅁ: "ㄻ",
  ㄹㅂ: "ㄼ",
  ㄹㅅ: "ㄽ",
  ㄹㅌ: "ㄾ",
  ㄹㅍ: "ㄿ",
  ㄹㅎ: "ㅀ",
  ㅂㅅ: "ㅄ",
};
const compose = (l: number, v: number, t = 0) => String.fromCharCode(0xac00 + (l * 21 + v) * 28 + t);
const partsOf = (s: string) => {
  const c = s.charCodeAt(0) - 0xac00;
  return { l: Math.floor(c / 588), v: Math.floor((c % 588) / 28), t: c % 28 };
};

/** 打っている途中の見え方を、一打ちずつ。 */
export function koSteps(word: string): string[] {
  const steps: string[] = [];
  const syl = [...word];
  let done = "";
  syl.forEach((s, i) => {
    const { l, v, t } = partsOf(s);
    const initial = L[l];
    if (i > 0) {
      // 初声は、いったん前の音節の終声（またはその重ね）として付く。
      const p = partsOf(syl[i - 1]);
      const final = T[p.t];
      const joined = final ? CLUSTER[final + initial] : T.indexOf(initial) > 0 ? initial : undefined;
      steps.push(joined ? done.slice(0, -1) + compose(p.l, p.v, T.indexOf(joined)) : done + initial);
    } else {
      steps.push(done + initial);
    }
    steps.push(done + compose(l, v));
    if (t) steps.push(done + compose(l, v, t));
    done += s;
  });
  return steps;
}

export type Typing = { word: string; steps: string[]; at: number[]; duration: number };

/** `per`：一打ちのコマ数（ときどき少し長く）。 */
export function koTyping(word: string, per = 4): Typing {
  const steps = koSteps(word);
  const at: number[] = [];
  let t = 0;
  steps.forEach((_, i) => {
    t += per + (i % 4 === 2 ? 2 : 0);
    at.push(t);
  });
  return { word, steps, at, duration: t };
}

/** `frame`（打ちはじめからのコマ）での見え方。 */
export function typedAt(typing: Typing, frame: number): string {
  let text = "";
  typing.at.forEach((a, i) => {
    if (frame >= a) text = typing.steps[i];
  });
  return text;
}

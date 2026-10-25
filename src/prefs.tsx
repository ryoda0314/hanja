// 表示と読み上げの設定（漢字の字形・アクセントの色・読み上げの速さ）。端末の localStorage に残す。
// 消えても既定に戻るだけで、集めた語には影響しない。
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type ScriptPref = "ko" | "ja" | "both";
export type AccentPref = "wakaba" | "rain" | "ink" | "hydrangea" | "dusk";
export type RatePref = "slow" | "normal" | "fast";

/** 字形。日本語を話す人のためのアプリなので、日本の字（新字体）が既定。 */
export const SCRIPTS: readonly ScriptPref[] = ["ja", "ko", "both"];
/** わかば は ことのね の色。ほかの4色は姉妹アプリ ことのあめ と同じ。 */
export const ACCENTS: readonly AccentPref[] = ["wakaba", "rain", "ink", "hydrangea", "dusk"];
export const RATES: Record<RatePref, number> = { slow: 0.7, normal: 0.9, fast: 1.1 };

const KEYS = { script: "hanjaatume.kanji", accent: "hanjaatume.accent", rate: "hanjaatume.rate" };
/** 前の版の字形の設定。開くたびに既定（両方）を書き込んでいたので、選んだかどうかは 韓国の字 のときしか分からない。 */
const OLD_SCRIPT_KEY = "hanjaatume.script";

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function load<T extends string>(key: string, choices: readonly T[], fallback: T): T {
  const saved = read(key);
  return choices.includes(saved as T) ? (saved as T) : fallback;
}

/** 字形のはじめの値：選んだ字形。まだ選んでいなければ日本の字（前の版で 韓国の字 を選んでいたら、それを引き継ぐ）。 */
export function initialScript(get: (key: string) => string | null = read): ScriptPref {
  const saved = get(KEYS.script);
  if (SCRIPTS.includes(saved as ScriptPref)) return saved as ScriptPref;
  return get(OLD_SCRIPT_KEY) === "ko" ? "ko" : "ja";
}

function save(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* プライベートモードなど：残らないだけ */
  }
}

interface Prefs {
  script: ScriptPref;
  setScript: (s: ScriptPref) => void;
  accent: AccentPref;
  setAccent: (a: AccentPref) => void;
  rate: RatePref;
  setRate: (r: RatePref) => void;
}

const PrefsContext = createContext<Prefs>({
  script: "ja",
  setScript: () => {},
  accent: "wakaba",
  setAccent: () => {},
  rate: "normal",
  setRate: () => {},
});

export function PrefsProvider({ children }: { children: ReactNode }) {
  const [script, setScript] = useState<ScriptPref>(() => initialScript());
  const [accent, setAccent] = useState<AccentPref>(() => load(KEYS.accent, ACCENTS, "wakaba"));
  const [rate, setRate] = useState<RatePref>(() => load(KEYS.rate, ["slow", "normal", "fast"], "normal"));

  // 字形は選んだときだけ残す（既定を書き込むと、既定を変えたときに前の既定のままになる）。
  function chooseScript(s: ScriptPref) {
    setScript(s);
    save(KEYS.script, s);
  }
  useEffect(() => save(KEYS.rate, rate), [rate]);
  useEffect(() => {
    save(KEYS.accent, accent);
    document.documentElement.dataset.accent = accent;
  }, [accent]);

  return (
    <PrefsContext.Provider value={{ script, setScript: chooseScript, accent, setAccent, rate, setRate }}>
      {children}
    </PrefsContext.Provider>
  );
}

export function usePrefs() {
  return useContext(PrefsContext);
}

/**
 * 韓国漢字（ko）と日本漢字（jp）から、設定に応じた表示用テキストを返す。
 * jp が未指定または ko と同形なら、常に ko を返す。
 */
export function displayHanja(script: ScriptPref, ko: string, jp?: string): string {
  const j = jp && jp !== ko ? jp : null;
  if (!j) return ko;
  if (script === "ja") return j;
  if (script === "both") return `${ko} / ${j}`;
  return ko;
}

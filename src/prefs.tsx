// 漢字の表示設定（韓国漢字／日本漢字／両方）。localStorage に永続化。
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type ScriptPref = "ko" | "ja" | "both";

const KEY = "hanjaatume.script";

const ScriptContext = createContext<{
  script: ScriptPref;
  setScript: (s: ScriptPref) => void;
}>({ script: "both", setScript: () => {} });

export function ScriptProvider({ children }: { children: ReactNode }) {
  const [script, setScript] = useState<ScriptPref>(() => {
    const saved = typeof localStorage !== "undefined" ? localStorage.getItem(KEY) : null;
    return saved === "ko" || saved === "ja" || saved === "both" ? saved : "both";
  });

  useEffect(() => {
    try {
      localStorage.setItem(KEY, script);
    } catch {
      /* ignore */
    }
  }, [script]);

  return (
    <ScriptContext.Provider value={{ script, setScript }}>{children}</ScriptContext.Provider>
  );
}

export function useScript() {
  return useContext(ScriptContext);
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

import { useEffect, useState, type ReactNode } from "react";
import { initFullDataset } from "../data/dataset";

/** 全辞書データの読込が終わるまでローディング画面を出し、完了後に子を描画する。 */
export default function DataGate({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    initFullDataset().finally(() => {
      if (active) setReady(true);
    });
    return () => {
      active = false;
    };
  }, []);

  if (!ready) {
    return (
      <div className="flex h-full items-center justify-center text-slate-300">
        <div className="flex flex-col items-center gap-4">
          <div className="relative h-24 w-[4.5rem] animate-pulse rounded-2xl border border-amber-200/60 bg-gradient-to-br from-amber-400 via-orange-500 to-rose-600 shadow-[0_8px_32px_-6px_rgba(251,191,36,0.7)]">
            <span
              className="absolute inset-0 flex items-center justify-center font-hanja text-4xl text-white"
              style={{ textShadow: "0 2px 8px rgba(0,0,0,0.45)" }}
            >
              漢
            </span>
          </div>
          <span className="text-sm text-slate-500">辞書を読み込み中…</span>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

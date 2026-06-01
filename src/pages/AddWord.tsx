import { useState } from "react";
import { resolveLocalAll, resolveManual } from "../data/resolver";
import type { ResolvedWord } from "../data/types";
import { addWord, hasWord } from "../db";
import HanjaCard from "../components/HanjaCard";
import HanjaText from "../components/HanjaText";
import PageHeader from "../components/PageHeader";

type Status =
  | { kind: "idle" }
  | { kind: "resolved"; word: ResolvedWord }
  | { kind: "candidates"; words: ResolvedWord[] }
  | { kind: "notfound"; hangul: string };

const inputCls =
  "w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-lg outline-none placeholder:text-slate-500 focus:border-amber-400/60";

export default function AddWord() {
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [message, setMessage] = useState<string | null>(null);
  const [manualHanja, setManualHanja] = useState("");
  const [manualGloss, setManualGloss] = useState("");

  function handleResolve() {
    const hangul = input.trim();
    if (!hangul) return;
    setMessage(null);
    const words = resolveLocalAll(hangul);
    if (words.length === 1) {
      setStatus({ kind: "resolved", word: words[0] });
    } else if (words.length > 1) {
      setStatus({ kind: "candidates", words });
    } else {
      setManualHanja("");
      setManualGloss("");
      setStatus({ kind: "notfound", hangul });
    }
  }

  async function save(word: ResolvedWord) {
    if (await hasWord(word.hangul, word.hanja)) {
      setMessage(`「${word.hangul}」はすでに集めています。`);
      return;
    }
    const added = await addWord(word);
    setMessage(added ? `「${word.hangul}（${word.hanja}）」を集めました！` : "追加できませんでした。");
    setInput("");
    setStatus({ kind: "idle" });
    setManualHanja("");
    setManualGloss("");
  }

  return (
    <div className="space-y-5">
      <PageHeader title="漢字語を追加" subtitle="勉強した韓国語の漢字語を入力してください" />

      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleResolve()}
          placeholder="예: 학생"
          autoComplete="off"
          autoCapitalize="off"
          className={inputCls}
        />
        <button
          onClick={handleResolve}
          className="rounded-xl bg-zinc-100 px-5 font-bold text-zinc-900 active:scale-95"
        >
          調べる
        </button>
      </div>

      {message && (
        <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-200">
          {message}
        </div>
      )}

      {status.kind === "candidates" && (
        <div className="space-y-2">
          <p className="text-sm text-slate-400">
            同じ読みの漢字語が複数あります。正しいものを選んでください。
          </p>
          {status.words.map((w) => (
            <button
              key={w.hanja}
              onClick={() => setStatus({ kind: "resolved", word: w })}
              className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-left active:scale-[0.99]"
            >
              <HanjaText ko={w.hanja} jp={w.hanjaJp} className="text-lg text-slate-200" />
              <span className="ml-3 truncate text-sm text-slate-400">{w.gloss}</span>
            </button>
          ))}
        </div>
      )}

      {status.kind === "resolved" && <Preview word={status.word} onSave={() => save(status.word)} />}

      {status.kind === "notfound" && (
        <div className="space-y-3 rounded-2xl border border-amber-500/30 bg-amber-500/[0.07] p-4">
          <p className="text-sm text-amber-200/90">
            「{status.hangul}」は辞書に見つかりませんでした。漢字と意味を手入力して登録できます。
          </p>
          <label className="block text-xs text-slate-400">
            漢字表記
            <input
              value={manualHanja}
              onChange={(e) => setManualHanja(e.target.value)}
              placeholder="예: 學生"
              className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 font-hanja text-base outline-none focus:border-amber-400/60"
            />
          </label>
          <label className="block text-xs text-slate-400">
            意味
            <input
              value={manualGloss}
              onChange={(e) => setManualGloss(e.target.value)}
              placeholder="예: 学生"
              className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-base outline-none focus:border-amber-400/60"
            />
          </label>
          {manualHanja.trim() && (
            <Preview
              word={resolveManual(status.hangul, manualHanja, manualGloss)}
              onSave={() => save(resolveManual(status.hangul, manualHanja, manualGloss))}
            />
          )}
        </div>
      )}
    </div>
  );
}

function Preview({ word, onSave }: { word: ResolvedWord; onSave: () => void }) {
  return (
    <div className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-baseline gap-3">
        <span className="text-2xl font-bold">{word.hangul}</span>
        <HanjaText ko={word.hanja} jp={word.hanjaJp} className="text-xl text-slate-300" />
      </div>
      {word.gloss && <p className="text-sm text-slate-400">{word.gloss}</p>}

      <div>
        <p className="mb-2 text-xs text-slate-500">手に入る漢字カード</p>
        <div className="flex flex-wrap gap-2">
          {word.chars.map((ch, i) => (
            <div key={`${ch}-${i}`} className="w-[4.5rem]">
              <HanjaCard char={ch} size="sm" />
            </div>
          ))}
        </div>
      </div>

      <button
        onClick={onSave}
        className="w-full rounded-xl bg-zinc-100 py-3 font-bold text-zinc-900 active:scale-[0.98]"
      >
        集める（図鑑に登録）
      </button>
    </div>
  );
}

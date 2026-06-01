import { useScript, type ScriptPref } from "../prefs";

const options: { value: ScriptPref; label: string }[] = [
  { value: "ko", label: "韓" },
  { value: "ja", label: "日" },
  { value: "both", label: "両" },
];

/** 漢字の表示（韓国/日本/両方）切替。各ページの見出し横に置く小さなトグル。 */
export default function ScriptToggle() {
  const { script, setScript } = useScript();
  return (
    <div className="flex overflow-hidden rounded-lg border border-white/10">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => setScript(o.value)}
          className={`px-2.5 py-1 text-xs font-semibold transition-colors ${
            script === o.value
              ? "bg-zinc-100 text-zinc-900"
              : "bg-white/5 text-slate-400 hover:text-slate-200"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

import { useScript } from "../prefs";

/**
 * 漢字語の表記を表示設定（韓/日/両）に応じて描画する。
 * 両方表示かつ字形が異なるときは「韓 / 日」を色分けして見せる。
 */
export default function HanjaText({
  ko,
  jp,
  className = "",
}: {
  ko: string;
  jp?: string;
  className?: string;
}) {
  const { script } = useScript();
  const j = jp && jp !== ko ? jp : null;

  if (!j || script === "ko") return <span className={`font-serif ${className}`}>{ko}</span>;
  if (script === "ja") return <span className={`font-serif ${className}`}>{j}</span>;

  // both: 韓国漢字 / 日本漢字
  return (
    <span className={`font-serif ${className}`}>
      {ko}
      <span className="mx-1 text-slate-600">/</span>
      <span className="text-sky-300">{j}</span>
    </span>
  );
}

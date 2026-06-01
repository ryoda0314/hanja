import { Link } from "react-router-dom";
import { getCharData } from "../data/dataset";
import { useScript } from "../prefs";
import { rarityByStrokes } from "../util/rarity";
import { LockIcon, StarIcon } from "./icons";

type Size = "sm" | "md" | "lg";

const glyphSize: Record<Size, string> = {
  sm: "text-3xl",
  md: "text-[2.75rem]",
  lg: "text-7xl",
};

/** 漢字1文字をトレーディングカードとして表示する。owned=false は未収集（ロック）。 */
export default function HanjaCard({
  char,
  owned = true,
  count,
  size = "md",
  link = false,
}: {
  char: string;
  owned?: boolean;
  count?: number;
  size?: Size;
  link?: boolean;
}) {
  const { script } = useScript();
  const data = getCharData(char);
  const reading = data?.readings[0];
  const jp = data?.jp && data.jp !== char ? data.jp : null;
  const glyph = script === "ja" && jp ? jp : char;
  const rarity = rarityByStrokes(data?.strokes ?? 0);

  const inner = owned ? (
    <div
      className={`relative flex h-full flex-col overflow-hidden rounded-xl border bg-gradient-to-b from-zinc-800/90 to-zinc-900 shadow-md shadow-black/40 ${rarity.borderClass} ${
        rarity.holo ? "holo" : ""
      }`}
    >
      {/* 上端のレア色ライン（控えめ） */}
      <span
        className={`absolute inset-x-0 top-0 h-px ${rarity.accentClass}`}
        style={{ background: "currentColor", opacity: 0.5 }}
      />

      <div className="flex items-center justify-between px-2 pt-1.5">
        <div className={`flex gap-px ${rarity.accentClass}`}>
          {Array.from({ length: rarity.stars }).map((_, i) => (
            <StarIcon key={i} size={size === "lg" ? 11 : 8} />
          ))}
        </div>
        {script === "both" && jp && (
          <span className="rounded bg-white/10 px-1 text-[9px] leading-tight text-slate-300">
            日{jp}
          </span>
        )}
      </div>

      <div className="flex flex-1 items-center justify-center px-1">
        <span className={`font-hanja leading-none text-zinc-50 ${glyphSize[size]}`}>{glyph}</span>
      </div>

      <div className="px-2 pb-1.5 text-center">
        {reading && (
          <div className="truncate text-zinc-200">
            <span className={size === "sm" ? "text-sm font-semibold" : "text-[15px] font-semibold"}>
              {reading.eum}
            </span>
            {reading.hun && size !== "sm" && (
              <span className="ml-1 text-[10px] text-zinc-500">{reading.hun}</span>
            )}
          </div>
        )}
      </div>

      {count != null && count > 1 && (
        <span className="absolute right-1.5 top-1.5 rounded-full bg-black/40 px-1.5 text-[9px] font-semibold text-zinc-300">
          ×{count}
        </span>
      )}
    </div>
  ) : (
    <div className="flex h-full flex-col items-center justify-center rounded-xl border border-white/5 bg-white/[0.02] p-2">
      <span className={`font-hanja leading-none text-zinc-700 ${glyphSize[size]}`}>{glyph}</span>
      <LockIcon size={13} className="mt-2 text-zinc-700" />
    </div>
  );

  const wrap = "block aspect-[3/4] transition-transform active:scale-[0.97]";

  if (link) {
    return (
      <Link to={`/dex/${encodeURIComponent(char)}`} className={wrap}>
        {inner}
      </Link>
    );
  }
  return <div className={wrap}>{inner}</div>;
}

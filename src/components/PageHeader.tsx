import type { ReactNode } from "react";
import ScriptToggle from "./ScriptToggle";

/** 各ページ共通の見出し。右側に漢字表示トグルを置く（常駐バーは廃止）。 */
export default function PageHeader({
  title,
  subtitle,
  toggle = true,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  toggle?: boolean;
}) {
  return (
    <header className="flex items-start justify-between gap-3">
      <div>
        <h1 className="font-hanja text-2xl font-bold text-zinc-50">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-zinc-500">{subtitle}</p>}
      </div>
      {toggle && (
        <div className="shrink-0 pt-1">
          <ScriptToggle />
        </div>
      )}
    </header>
  );
}

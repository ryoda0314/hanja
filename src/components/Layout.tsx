import { NavLink, Outlet } from "react-router-dom";
import type { ComponentType, SVGProps } from "react";
import { BookIcon, GridIcon, HomeIcon, LayersIcon, PlusIcon } from "./icons";

type Tab = {
  to: string;
  label: string;
  sub: string;
  Icon: ComponentType<SVGProps<SVGSVGElement> & { size?: number }>;
  end: boolean;
};

const tabs: Tab[] = [
  { to: "/", label: "홈", sub: "ホーム", Icon: HomeIcon, end: true },
  { to: "/add", label: "추가", sub: "追加", Icon: PlusIcon, end: false },
  { to: "/words", label: "단어장", sub: "単語帳", Icon: BookIcon, end: false },
  { to: "/dex", label: "도감", sub: "図鑑", Icon: GridIcon, end: false },
  { to: "/combine", label: "조합", sub: "組合せ", Icon: LayersIcon, end: false },
];

export default function Layout() {
  return (
    <div className="mx-auto flex h-full max-w-md flex-col text-slate-100">
      <main
        className="flex-1 overflow-y-auto px-4"
        style={{
          paddingTop: "calc(1.25rem + env(safe-area-inset-top))",
          paddingBottom: "calc(5.5rem + env(safe-area-inset-bottom))",
        }}
      >
        <Outlet />
      </main>

      <nav
        className="fixed inset-x-0 bottom-0 mx-auto max-w-md border-t border-white/10 bg-[#0c0e17]/90 backdrop-blur-md"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <ul className="grid grid-cols-5">
          {tabs.map(({ to, label, sub, Icon, end }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={end}
                className={({ isActive }) =>
                  `flex flex-col items-center gap-1 py-2.5 text-[10px] transition-colors ${
                    isActive ? "text-zinc-100" : "text-zinc-600 hover:text-zinc-400"
                  }`
                }
              >
                <Icon size={21} />
                <span className="font-semibold leading-none">{label}</span>
                <span className="leading-none opacity-60">{sub}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}

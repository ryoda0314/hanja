import { useEffect, useState } from "react";
import { staticFile, useDelayRender } from "remotion";

// ことのね の紙と墨と、アクセントの わかば（../src/index.css）。紫は、また出会ったもの。
export const C = {
  paper: "#fcfbf8",
  surface: "#f1f4f8",
  ink: "#172033",
  ink2: "#3b4558",
  muted: "#5c6578",
  faint: "#8c94a5",
  line: "#e4e7ec",
  line2: "#d4d9e1",
  accent: "#0f7a50",
  tint: "#e3f1e9",
  again: "#6a4fe0",
  againTint: "#efebff",
} as const;

export const FONT = {
  ui: `"PlexJP", "PlexKR", sans-serif`,
  ja: `"PlexJP", sans-serif`,
  ko: `"PlexKR", "PlexJP", sans-serif`,
  hanja: `"SerifKR", serif`,
  mincho: `"Shippori", serif`,
} as const;

// アプリの字。`npm run assets` が public/fonts に置く。
const FACES: [family: string, file: string, weight: string][] = [
  ["PlexJP", "fonts/IBMPlexSansJP-Regular.ttf", "400"],
  ["PlexJP", "fonts/IBMPlexSansJP-Medium.ttf", "500"],
  ["PlexJP", "fonts/IBMPlexSansJP-SemiBold.ttf", "600"],
  ["PlexKR", "fonts/IBMPlexSansKR-Regular.ttf", "400"],
  ["PlexKR", "fonts/IBMPlexSansKR-Medium.ttf", "500"],
  ["PlexKR", "fonts/IBMPlexSansKR-SemiBold.ttf", "600"],
  ["SerifKR", "fonts/NotoSerifKR.ttf", "200 900"],
  ["Shippori", "fonts/ShipporiMincho-Bold.ttf", "700"],
];

let loading: Promise<unknown> | null = null;

/** 字が読み終わるまで、どのコマも待たせる（映像の根から呼ぶ）。 */
export function useFonts() {
  const { delayRender, continueRender, cancelRender } = useDelayRender();
  const [handle] = useState(() => delayRender("fonts"));
  useEffect(() => {
    loading ??= Promise.all(
      FACES.map(([family, file, weight]) => {
        const face = new FontFace(family, `url(${staticFile(file)})`, { weight });
        document.fonts.add(face);
        return face.load();
      }),
    );
    loading.then(() => continueRender(handle), cancelRender);
  }, [handle, continueRender, cancelRender]);
}

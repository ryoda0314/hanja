import { Composition, Still } from "remotion";
import { FPS } from "./anim";
import { Card } from "./Card";
import { Install, INSTALL, INSTALL_FRAMES } from "./Install";
import { Promo } from "./Promo";
import { TOTAL } from "./timeline";

export function Root() {
  return (
    <>
      <Composition id="Promo" component={Promo} durationInFrames={TOTAL} fps={FPS} width={1920} height={1080} />
      {/* 一目でわかる紹介画像（npm run card） */}
      <Still id="Card" component={Card} width={1920} height={1080} />
      {/* ホーム画面への追加のしかた（縦、X に載せる。npm run install-video） */}
      <Composition id="Install" component={Install} durationInFrames={INSTALL_FRAMES} fps={FPS} width={INSTALL.width} height={INSTALL.height} />
    </>
  );
}

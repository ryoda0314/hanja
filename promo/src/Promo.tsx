import { AbsoluteFill, Audio, interpolate, Sequence, staticFile, useCurrentFrame } from "remotion";
import { prog } from "./anim";
import { End } from "./scenes/End";
import { Hook } from "./scenes/Hook";
import { NameMark } from "./scenes/Mark";
import { Story } from "./scenes/Story";
import NET from "./net.json";
import { C, FONT, useFonts } from "./theme";
import { NET_AT, T, TOTAL, TYPE1, TYPE2, TYPE3, TYPE4, TYPE5, VOICE_AT } from "./timeline";

/** `from` から `to`（コマ）まで見せる。両端は `fade` コマで薄れる。 */
function Window({
  frame,
  from,
  to,
  fade = 12,
  fadeIn = true,
  fadeOut = true,
  children,
}: {
  frame: number;
  from: number;
  to: number;
  fade?: number;
  fadeIn?: boolean;
  fadeOut?: boolean;
  children: React.ReactNode;
}) {
  if (frame < from || frame >= to) return null;
  const opacity = Math.min(fadeIn ? prog(frame, from, fade) : 1, fadeOut ? 1 - prog(frame, to - fade, fade) : 1);
  return <AbsoluteFill style={{ opacity }}>{children}</AbsoluteFill>;
}

/** 映像。 */
export function Promo() {
  useFonts();
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: C.paper, color: C.ink, fontFamily: FONT.ui, WebkitFontSmoothing: "antialiased" }}>
      <style>{"* { box-sizing: border-box; }"}</style>
      <Window frame={frame} from={0} to={T.title.start + 8} fadeIn={false} fade={16}>
        <Hook frame={frame} />
      </Window>
      <Window frame={frame} from={T.title.start} to={T.collect.start + 10} fade={14}>
        <NameMark frame={frame} icon={T.title.icon} word={T.title.word} lead={T.title.lead} size={280} top={150} wordSize={104} leadSize={46} />
      </Window>
      <Window frame={frame} from={T.collect.start} to={T.end.start + 10} fade={14}>
        <Story frame={frame} />
      </Window>
      <Window frame={frame} from={T.end.start} to={TOTAL} fade={20} fadeOut={false}>
        <End frame={frame} />
      </Window>
      <Sound />
    </AbsoluteFill>
  );
}

// ---- 音：ナレーション（scripts/voice.mjs が作る）と、静かな音楽と、画面の小さな音（scripts/music.py が作る） -------

const MUSIC = 0.5;
/** 声のあいだ、音楽をどれだけ下げるか（0〜1）。 */
const DUCK = 0.5;

/**
 * 音楽を下げる度合い（コマごと、0〜1）。声の 4 コマ前から下げはじめ、声が消えてから戻す。
 * 声と声のあいだの短いすき間では戻しきらない（戻る速さを、下がる速さより遅くしている）。
 */
const DUCKING: number[] = (() => {
  const want = new Float32Array(TOTAL);
  for (const v of VOICE_AT) for (let i = Math.max(0, v.from - 4); i < Math.min(TOTAL, v.until + 2); i++) want[i] = 1;
  const out: number[] = [];
  let level = 0;
  for (let i = 0; i < TOTAL; i++) {
    level += (want[i] - level) * (want[i] > level ? 0.25 : 0.07);
    out.push(level);
  }
  return out;
})();

function Clip({ from, src, volume = 1, frames }: { from: number; src: string; volume?: number; frames?: number }) {
  return (
    <Sequence from={from} durationInFrames={frames} layout="none">
      <Audio src={staticFile(src)} volume={volume} />
    </Sequence>
  );
}

function Sound() {
  const h = T.hook;
  const c = T.collect;
  const r = T.read;
  const m = T.meet;
  const w = T.words;
  const musicVolume = (frame: number) =>
    MUSIC * interpolate(frame, [0, 20, TOTAL - 75, TOTAL - 4], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) * (1 - DUCK * (DUCKING[frame] ?? 0));
  // 札が並ぶとき・文が降るときの雨粒。語が組み上がるとき・覚え具合の段階を言うとき（声と重なる）は小さく。
  const drops = [h.cards, h.cards + 7, h.cards + 14, h.cards + 21, h.cards + 28, m.line1, m.line2, m.line3, m.line4];
  const wordDrops = [h.w1, h.w2, h.w3, h.w4, h.w5, ...NET_AT.slice(NET.first, NET.first + NET.slow), w.s1, w.s2, w.s3, w.s4];
  // 網の一気のところは、雨が強まる。
  const shower = Array.from({ length: 24 }, (_, i) => h.burst + i * 2);
  const taps = [c.look1, c.press1, c.look2, c.press2, r.submit, m.tap, m.collect, w.press, w.submit];
  const typing: [number, number][] = [
    [c.type1, TYPE1.duration],
    [c.type2, TYPE2.duration],
    [r.type, TYPE3.duration],
    [m.type, TYPE5.duration],
    [w.type, TYPE4.duration],
  ];
  return (
    <>
      <Audio src={staticFile("sound/music.wav")} volume={musicVolume} />
      {VOICE_AT.map((v) => (
        <Clip key={v.id} from={v.from} src={`voice/${v.id}.wav`} />
      ))}
      {drops.map((at, i) => (
        <Clip key={`d${at}`} from={at} src={`sound/drop${(i % 3) + 1}.wav`} volume={i < 5 ? 0.18 : 0.24} />
      ))}
      {wordDrops.map((at, i) => (
        <Clip key={`w${at}`} from={at} src={`sound/drop${(i % 3) + 1}.wav`} volume={0.14} />
      ))}
      {shower.map((at, i) => (
        <Clip key={`s${at}`} from={at} src={`sound/drop${(i % 3) + 1}.wav`} volume={0.1 + (0.1 * i) / shower.length} />
      ))}
      {[0, 4, 7].map((delay, i) => (
        <Clip key={`t${delay}`} from={T.title.icon + delay + 8} src={`sound/drop${i + 1}.wav`} volume={0.28} />
      ))}
      {[0, 4, 7].map((delay, i) => (
        <Clip key={`e${delay}`} from={T.end.icon + delay + 8} src={`sound/drop${i + 1}.wav`} volume={0.24} />
      ))}
      {taps.map((at) => (
        <Clip key={`p${at}`} from={at - 2} src="sound/tap.wav" volume={0.5} />
      ))}
      {typing.map(([at, dur]) => (
        <Clip key={`k${at}`} from={at} frames={dur + 2} src="sound/typing.wav" volume={0.45} />
      ))}
      <Clip from={h.count + 8} src="sound/chime.wav" volume={0.26} />
      <Clip from={h.total + 4} src="sound/chime.wav" volume={0.3} />
      <Clip from={c.done2 + 2} src="sound/chime.wav" volume={0.26} />
      <Clip from={r.success} src="sound/chime.wav" volume={0.26} />
      <Clip from={m.reveal} src="sound/chime.wav" volume={0.24} />
      <Clip from={w.success} src="sound/chime.wav" volume={0.24} />
    </>
  );
}

// いつ何が起きるか（秒で決めて、コマにする）。打つ長さは打ち方（anim.ts koTyping）から、ナレーションの長さは
// クリップの長さ（src/voice.json：scripts/voice.mjs が書く）から。声が言い終わってから、次のできごとへ進む。
//
// 見る人：韓国語の単語を一つずつ丸暗記してつまずいていて、「漢字の読みを一字ずつ覚えると、組み合わせるだけで単語が
// 作れる」「野球が 야구、体育が 체육 なら、球体は 구체」に目を開かれた人たち。その覚え方が、そのままアプリになっている
// ことを、アプリの画面で見せる。数はすべてアプリの辞書のとおり（학생・대학・회사・사회・회원 を集めた人が、야구 で +1、
// 체육 で +4：구체・대체・생체・생육。冒頭の網は 21字で 72語：scripts/net.mjs）。
import { f, koTyping } from "./anim";
import NET from "./net.json";
import VOICE from "./voice.json";

export const TYPE1 = koTyping("야구");
export const TYPE2 = koTyping("체육");
export const TYPE3 = koTyping("구체", 5);
export const TYPE4 = koTyping("대학", 5);
export const TYPE5 = koTyping("대회", 5);

const sec = (frames: number) => frames / 30;

type VoiceId = keyof typeof VOICE;
/** クリップの末尾の余白（声が消えてから残した 250ms と、足した 120ms）。次の声やできごとは、ここに重ねてよい。 */
const TAIL = 0.37;
/** 声が鳴っている長さ（秒）。 */
const said = (id: VoiceId) => VOICE[id] - TAIL;
/** ナレーションを置いた時（秒）。make() が積む。 */
const cues: { id: VoiceId; at: number }[] = [];
/** `at` 秒に声を置いて、言い終わる時（秒）を返す。 */
const say = (id: VoiceId, at: number) => {
  cues.push({ id, at });
  return at + said(id);
};

/** 網：一つずつ組み上がる語の声（net.json の slow と同じ並び：학생・선생・시간・전화・한국어・일본어・대한민국）。 */
const SLOW_VOICE: VoiceId[] = ["K06", "K07", "K08", "K09", "K10", "K11", "K12"];
/** 残りの語が一気に組み上がる長さ（秒）。 */
const BURST = 1.6;
if (SLOW_VOICE.length !== NET.slow) throw new Error("SLOW_VOICE と net.json の slow の数が合わない");

function make() {
  // A. 丸暗記していた5語は、3字の読みでできていた（会 회・社 사・員 원）。字が増えると、つながりは網になる。
  //    net：三つの札が輪に移る。web：はじめの5語の線。words：一つずつの語。burst：残りが一気に。total：21字で、72語。
  const hook = { start: 0, cards: 0.7, split: 0, tiles: 0, w1: 0, w2: 0, w3: 0, w4: 0, w5: 0, count: 0, net: 0, web: 0, words: 0, burst: 0, total: 0, known: 0, end: 0 };
  hook.split = say("V01", 0.25) + 0.15;
  hook.tiles = hook.split + 0.3;
  // 漢字の読みを、一字ずつ覚えると、 → 語が一つずつ組み上がる。そのたびに、その語の韓国語の声。
  let at = say("V02", hook.split + 0.15) + 0.12;
  const chips = (["K01", "K02", "K03", "K04", "K05"] as VoiceId[]).map((id) => {
    const from = at;
    at = say(id, from) + 0.1;
    return from;
  });
  [hook.w1, hook.w2, hook.w3, hook.w4, hook.w5] = chips;
  // 3字で、5語。（字幕と鈴だけ）
  hook.count = at + 0.25;
  hook.net = hook.count + 1.1;
  hook.web = hook.net + 0.75;
  hook.words = hook.net + 1.05;
  at = hook.words;
  const slowAt = SLOW_VOICE.map((id) => {
    const from = at;
    at = say(id, from) + 0.04;
    return from;
  });
  hook.burst = at + 0.3;
  // 21字で、72語。（字幕と鈴だけ）→ 漢字は、もう知っている。足りないのは、韓国語の読みだけ。
  hook.total = hook.burst + BURST + 0.15;
  hook.known = hook.total + 1.15;
  hook.end = say("V05", hook.known + 0.25) + 0.55;

  // B. ことのね
  const title = { start: hook.end, icon: hook.end + 0.3, word: hook.end + 0.7, lead: hook.end + 1.5, end: 0 };
  title.end = say("V06", title.word - 0.05) + 0.45;

  // C. あつめる：야구（+1）、체육（+4）。
  const c = { start: title.end - 0.2, cap1: 0, focus: 0, type1: 0, look1: 0, found1: 0, press1: 0, done1: 0, type2: 0, look2: 0, found2: 0, cap2: 0, press2: 0, done2: 0, end: 0 };
  c.cap1 = c.start + 0.4;
  c.focus = c.start + 0.7;
  c.type1 = c.start + 1.0;
  c.look1 = c.type1 + sec(TYPE1.duration) + 0.3;
  c.found1 = c.look1 + 0.25;
  c.press1 = Math.max(c.found1 + 2.0, say("V07", c.start + 0.4) - 0.2);
  c.done1 = c.press1 + 0.25;
  // 次は、체육。── 체육 と言うところで打ちはじめる。
  say("V09", c.done1 + 1.0);
  c.type2 = c.done1 + 1.9;
  c.look2 = c.type2 + sec(TYPE2.duration) + 0.3;
  c.found2 = c.look2 + 0.25;
  c.cap2 = c.found2 + 0.3;
  c.press2 = c.found2 + 2.3;
  c.done2 = c.press2 + 0.25;
  c.end = Math.max(c.done2 + 2.4, say("V10", c.done2 + 0.35) + 0.5);

  // D. 読んでみる：球体 を見て、自分で 구체 と打つ。読めました。習っていない語なのに。
  const r = { start: c.end, cap3: 0, type: 0, submit: 0, success: 0, cap4: 0, end: 0 };
  r.cap3 = r.start + 0.2;
  r.type = say("V11", r.start + 0.3) - 0.25;
  r.submit = r.type + sec(TYPE3.duration) + 0.35;
  r.success = r.submit + 0.2;
  r.cap4 = r.success + 0.3;
  r.end = say("V12", say("K13", r.success + 0.15) + 0.15) + 0.7;

  // E. 漢字：読み方の表が、覚えた語から育つ。ガク は 학、イク は 육。
  const h = { start: r.end, cap5: 0, pairs: 0, end: 0 };
  h.cap5 = h.start + 0.2;
  h.pairs = h.start + 2.2;
  h.end = Math.max(h.start + 6.4, say("V14", h.pairs - 0.1) + 0.6);

  // F. 見つける：文の中で学ぶ。ことのあめ の例文が降り、集めた語には漢字が添えられ、まだの語は ？？ で伏せてある。
  //    marks：印の話。spot：대회（集めた字 大・会 だけでできた語）を灯す。tap：押すと語のシートが開く（sheet）。
  //    type → collect：ハングルで打ってあつめる。reveal：答え合わせのように 大会 が開き、根が伸びる。
  //    close：シートを閉じると、文の上にも 大会。met：雨の下の「この雨で出会った語」へ（別の日に出会うと「また出会った」）。
  const m = { start: h.end, cap6: 0, line1: 0, line2: 0, line3: 0, line4: 0, marks: 0, spot: 0, tap: 0, sheet: 0, type: 0, collect: 0, reveal: 0, close: 0, cap10: 0, met: 0, end: 0 };
  m.cap6 = m.start + 0.2;
  m.line1 = m.start + 0.5;
  m.line2 = m.start + 1.1;
  m.line3 = m.start + 1.7;
  m.line4 = m.start + 2.3;
  m.marks = say("V25", m.start + 0.45) + 0.12;
  m.spot = say("V26", m.marks) + 0.2;
  m.tap = say("V27", say("K15", m.spot + 0.1) + 0.12) + 0.05;
  m.sheet = m.tap + 0.25;
  // 打ってあつめると、（ここで打つ）答え合わせのように、漢字が開きます。（ここで 大会 が開く）
  const v28 = say("V28", m.sheet + 0.35);
  m.collect = Math.max(m.sheet + 1.6, v28 - 1.5);
  m.type = m.collect - 0.3 - sec(TYPE5.duration);
  m.reveal = m.collect + 0.2;
  m.close = Math.max(m.reveal + 1.6, v28 + 0.3);
  m.cap10 = m.close + 0.1;
  m.met = m.close + 0.6;
  m.end = Math.max(m.met + 2.4, say("V15", m.close + 0.3) + 0.5);

  // H. ことば：覚え具合は四つの段階（あつめた・また出会った・読めた・身についた）。忘れかけたころに、ふりかえり。
  //    大学 を 대학 と読めて、読めた → 身についた。読めるたびに、次のふりかえりは遠くなる（1日・2日・6日・20日後…）。
  const w = { start: m.end, cap7: 0, s1: 0, s2: 0, s3: 0, s4: 0, cap8: 0, press: 0, review: 0, type: 0, submit: 0, success: 0, step: 0, list: 0, cap9: 0, end: 0 };
  w.cap7 = w.start + 0.2;
  at = w.start + 0.55;
  [w.s1, w.s2, w.s3, w.s4] = (["V18", "V19", "V20", "V21"] as VoiceId[]).map((id) => {
    const from = at;
    at = say(id, from) + 0.06;
    return from;
  });
  w.cap8 = at + 0.15;
  w.press = say("V22", w.cap8 + 0.1) + 0.1;
  w.review = w.press + 0.35;
  // 漢字を見て読めたら、（ここで 대학 と打つ）一段階すすみます。（ここで 読めた → 身についた）
  const v24 = say("V24", w.review + 0.2);
  w.type = w.review + 0.5;
  w.submit = w.type + sec(TYPE4.duration) + 0.25;
  w.success = w.submit + 0.2;
  w.step = Math.max(w.success + 0.3, v24 - 1.4);
  w.list = Math.max(v24, w.step + 1.0) + 0.3;
  w.cap9 = w.list + 0.1;
  w.end = say("V23", w.list + 0.2) + 0.6;

  // G. 終わり
  const end = { start: w.end, icon: w.end + 0.3, word: w.end + 0.7, lead: w.end + 1.4, rest: w.end + 2.1, end: 0 };
  end.end = Math.max(end.start + 5.8, say("V16", end.word + 0.05) + 1.5);

  return { hook, title, collect: c, read: r, hanja: h, meet: m, words: w, end, slowAt };
}

const S = make();
const frames = <T extends Record<string, number>>(o: T) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, f(v)])) as { [K in keyof T]: number };

export const T = {
  hook: frames(S.hook),
  title: frames(S.title),
  collect: frames(S.collect),
  read: frames(S.read),
  hanja: frames(S.hanja),
  meet: frames(S.meet),
  words: frames(S.words),
  end: frames(S.end),
};

export const TOTAL = f(S.end.end);

/** ナレーション：クリップと、鳴らしはじめるコマ・声が消えるコマ（音楽はこの間だけ下がる）。 */
export const VOICE_AT = cues.map((c) => ({ id: c.id, from: f(c.at), until: f(c.at + said(c.id)) }));

/** 網の語が組み上がるコマ（net.json の並び）。はじめの5語は輪ができたとき、次の語はその声と一緒に一つずつ、残りは一気に。 */
export const NET_AT: number[] = NET.words.map((_, i) => {
  if (i < NET.first) return f(S.hook.web);
  if (i < NET.first + NET.slow) return f(S.slowAt[i - NET.first]);
  const n = NET.words.length - NET.first - NET.slow;
  return f(S.hook.burst + (BURST * (i - NET.first - NET.slow)) / n);
});

/** 音楽の区切り（秒）。scripts/music.py に渡す。 */
export const MUSIC_MARKS = { title: S.title.start, story: S.collect.start, later: S.hanja.start, end: S.end.start, total: S.end.end };

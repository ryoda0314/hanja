import { describe, expect, it } from "vitest";
import {
  audioUrl,
  learnerLevel,
  markStatus,
  parseSentences,
  pickRain,
  segments,
  sentenceScore,
  wordOf,
  type LevelOf,
} from "./sentences";

// 語の等級（テストでは決めておく）。easy はどの語も 초급。
const easy: LevelOf = () => 1;
const levels =
  (map: Record<string, number>): LevelOf =>
  (m) =>
    map[`${m.hangul}|${m.hanja}`] ?? 1;

const file = {
  audioBase: null,
  sentences: [
    // 내일 대학 가?
    { ko: "내일 대학 가?", ja: "明日大学行く？", w: [[3, 5, "大學"]] as [number, number, string][] },
    // 학생 식당 어때?
    {
      ko: "학생 식당 어때?",
      ja: "学食どう？",
      w: [
        [0, 2, "學生"],
        [3, 5, "食堂"],
      ] as [number, number, string][],
    },
    { ko: "한국어 공부해.", ja: "韓国語勉強してる", w: [[0, 3, "韓國語"]] as [number, number, string][] },
  ],
};

describe("parseSentences", () => {
  it("印にハングルを付け、語と字の索引を作る", () => {
    const d = parseSentences(file);
    expect(d.list[1].marks.map((m) => m.hangul)).toEqual(["학생", "식당"]);
    expect(d.byWord.get("대학|大學")).toEqual([0]);
    expect(d.byChar.get("學")).toEqual([0, 1]);
    expect(d.byChar.get("食")).toEqual([1]);
  });
});

describe("markStatus / sentenceScore", () => {
  const d = parseSentences(file);
  const owned = new Set(["학생|學生"]);
  const collected = new Set(["學", "生", "大"]);

  it("集めた語・集めた字で読める語・まだの語を分ける", () => {
    expect(markStatus({ hangul: "학생", hanja: "學生" }, collected, owned)).toBe("owned");
    expect(markStatus({ hangul: "대학", hanja: "大學" }, collected, owned)).toBe("readable");
    expect(markStatus({ hangul: "식당", hanja: "食堂" }, collected, owned)).toBe("new");
  });

  it("集めた語の入った文ほど点が高い", () => {
    expect(sentenceScore(d.list[1], collected, owned, { levelOf: easy })).toBe(3);
    expect(sentenceScore(d.list[0], collected, owned, { levelOf: easy })).toBe(2);
    expect(sentenceScore(d.list[2], collected, owned, { levelOf: easy })).toBe(0);
  });

  it("ふりかえりどきの集めた語は、もう少し高い", () => {
    expect(sentenceScore(d.list[1], collected, owned, { due: new Set(["학생|學生"]), levelOf: easy })).toBe(5);
  });

  it("まだ読めない語が学ぶ人の段階より上の等級なら、上の分だけ下げる", () => {
    const hard = levels({ "식당|食堂": 3, "한국어|韓國語": 3, "대학|大學": 3 });
    // 학생（集めた語）＋ 식당（고급 のまだの語）：3 − 2
    expect(sentenceScore(d.list[1], collected, owned, { level: 1, levelOf: hard })).toBe(1);
    expect(sentenceScore(d.list[2], collected, owned, { level: 1, levelOf: hard })).toBe(-2);
    // 段階が 고급 なら下げない
    expect(sentenceScore(d.list[2], collected, owned, { level: 3, levelOf: hard })).toBe(0);
    // 集めた字で読める語（대학）は、等級が上でも下げない
    expect(sentenceScore(d.list[0], collected, owned, { level: 1, levelOf: hard })).toBe(2);
  });
});

describe("learnerLevel", () => {
  const keys = (n: number, prefix: string) => Array.from({ length: n }, (_, i) => `${prefix}${i}|字`);
  const byPrefix: LevelOf = (m) => (m.hangul.startsWith("중") ? 2 : m.hangul.startsWith("고") ? 3 : 1);

  it("集めた語が無ければ 초급", () => {
    expect(learnerLevel([], byPrefix)).toBe(1);
  });

  it("30語以上集めた、いちばん上の等級", () => {
    expect(learnerLevel([...keys(100, "초"), ...keys(29, "중")], byPrefix)).toBe(1);
    expect(learnerLevel([...keys(100, "초"), ...keys(30, "중")], byPrefix)).toBe(2);
    expect(learnerLevel([...keys(30, "중"), ...keys(30, "고")], byPrefix)).toBe(3);
  });
});

describe("pickRain", () => {
  const d = parseSentences(file);
  const owned = new Set(["학생|學生"]);
  const collected = new Set(["學", "生", "大"]);

  it("点の高い文から選ぶ", () => {
    const got = pickRain(d.list, collected, owned, new Set(), { size: 2, levelOf: easy, random: () => 0.5 });
    expect(got.map((s) => s.id)).toEqual([1, 0]);
  });

  it("出した文は避け、足りなければまた使う", () => {
    const pick = (seen: number[], size: number) =>
      pickRain(d.list, collected, owned, new Set(seen), { size, levelOf: easy, random: () => 0.5 });
    expect(pick([1], 1).map((s) => s.id)).toEqual([0]);
    expect(pick([0, 1, 2], 2)).toHaveLength(2);
  });

  it("ふりかえりどきの語の入った文を先に", () => {
    const both = new Set(["학생|學生", "대학|大學"]);
    expect(pickRain(d.list, collected, both, new Set(), { size: 1, levelOf: easy, random: () => 0.5 }).map((s) => s.id)).toEqual([0]);
    const due = new Set(["학생|學生"]);
    expect(
      pickRain(d.list, collected, both, new Set(), { size: 1, due, levelOf: easy, random: () => 0.5 }).map((s) => s.id)
    ).toEqual([1]);
  });

  it("はじめたばかりの人には、まだの語がやさしい文を先に", () => {
    const fresh = parseSentences({
      sentences: [
        { ko: "경제 뉴스 봤어?", ja: "経済ニュース見た？", w: [[0, 2, "經濟"]] },
        { ko: "가족 여행 가자.", ja: "家族旅行行こう", w: [[0, 2, "家族"]] },
      ] as { ko: string; ja: string; w: [number, number, string][] }[],
    });
    const levelOf = levels({ "경제|經濟": 3 });
    const got = pickRain(fresh.list, new Set(), new Set(), new Set(), { size: 1, levelOf, random: () => 0.5 });
    expect(got.map((s) => s.ko)).toEqual(["가족 여행 가자."]);
  });
});

describe("segments", () => {
  it("印の語とそれ以外に分ける", () => {
    const d = parseSentences(file);
    expect(segments(d.list[1]).map((p) => p.text)).toEqual(["학생", " ", "식당", " 어때?"]);
    expect(segments(d.list[1]).filter((p) => "mark" in p)).toHaveLength(2);
  });
});

describe("wordOf", () => {
  it("辞書の語なら意味つきで返す", () => {
    expect(wordOf({ hangul: "학생", hanja: "學生" }).gloss).toBe("学生");
    expect(wordOf({ hangul: "없음", hanja: "無無" }).gloss).toBe("");
  });
});

describe("audioUrl", () => {
  it("置き場所が無ければ null", async () => {
    expect(await audioUrl(null, "안녕")).toBeNull();
  });

  it("文の SHA-256 で場所を作る", async () => {
    // "abc" の SHA-256
    expect(await audioUrl("https://x/", "abc")).toBe(
      "https://x/ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad.wav"
    );
  });
});

describe("pickRain（同じ語の重なり）", () => {
  it("ひと雨で同じ語は2文まで", () => {
    const many = parseSentences({
      sentences: [
        { ko: "시간 있어?", ja: "時間ある？", w: [[0, 2, "時間"]] },
        { ko: "시간 없어.", ja: "時間ない", w: [[0, 2, "時間"]] },
        { ko: "시간 돼?", ja: "時間空いてる？", w: [[0, 2, "時間"]] },
        { ko: "가족 여행", ja: "家族旅行", w: [[0, 2, "家族"]] },
      ] as { ko: string; ja: string; w: [number, number, string][] }[],
    });
    const owned = new Set(["시간|時間"]);
    const got = pickRain(many.list, new Set(["時", "間"]), owned, new Set(), { size: 3, levelOf: easy, random: () => 0.5 });
    expect(got.filter((s) => s.ko.startsWith("시간"))).toHaveLength(2);
    expect(got.map((s) => s.ko)).toContain("가족 여행");
  });
});

import { describe, expect, it } from "vitest";
import { audioUrl, markStatus, parseSentences, pickRain, segments, sentenceScore, wordOf } from "./sentences";

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
    expect(sentenceScore(d.list[1], collected, owned)).toBe(3);
    expect(sentenceScore(d.list[0], collected, owned)).toBe(2);
    expect(sentenceScore(d.list[2], collected, owned)).toBe(0);
  });
});

describe("pickRain", () => {
  const d = parseSentences(file);
  const owned = new Set(["학생|學生"]);
  const collected = new Set(["學", "生", "大"]);

  it("点の高い文から選ぶ", () => {
    const got = pickRain(d.list, collected, owned, new Set(), 2, () => 0.5);
    expect(got.map((s) => s.id)).toEqual([1, 0]);
  });

  it("出した文は避け、足りなければまた使う", () => {
    expect(pickRain(d.list, collected, owned, new Set([1]), 1, () => 0.5).map((s) => s.id)).toEqual([0]);
    expect(pickRain(d.list, collected, owned, new Set([0, 1, 2]), 2, () => 0.5)).toHaveLength(2);
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
    const got = pickRain(many.list, new Set(["時", "間"]), owned, new Set(), 3, () => 0.5);
    expect(got.filter((s) => s.ko.startsWith("시간"))).toHaveLength(2);
    expect(got.map((s) => s.ko)).toContain("가족 여행");
  });
});

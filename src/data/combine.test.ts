import { describe, expect, it } from "vitest";
import {
  byEase,
  checkWordExists,
  discoverWords,
  findWordsByHanja,
  isRealWord,
  nearWords,
  unlockedBy,
  unlockers,
  wordKey,
} from "./combine";

describe("discoverWords", () => {
  it("集めた漢字だけで作れる実在語を列挙する", () => {
    // 大・學・生 を集めた状態
    const collected = new Set(["大", "學", "生"]);
    const owned = new Set<string>();
    const results = discoverWords(collected, owned);
    const hanjas = results.map((r) => r.hanja);
    // 大學生 / 學生 / 大學 はすべて作れる
    expect(hanjas).toContain("大學生");
    expect(hanjas).toContain("學生");
    expect(hanjas).toContain("大學");
  });

  it("構成漢字が1つでも欠けている語は含めない", () => {
    // 學 だけでは 學校(校が無い) は作れない
    const collected = new Set(["學"]);
    const results = discoverWords(collected, new Set());
    expect(results.map((r) => r.hanja)).not.toContain("學校");
  });

  it("字数の少ない語（読みやすい語）が先に来る", () => {
    const collected = new Set(["大", "學", "生"]);
    const results = discoverWords(collected, new Set());
    expect(results.at(-1)?.hanja).toBe("大學生"); // 3文字は2文字より後
    expect(results[0].chars.length).toBe(2);
  });

  it("onlyNew=true は所持済みの語を除外する", () => {
    const collected = new Set(["學", "生"]);
    const owned = new Set([wordKey({ hangul: "학생", hanja: "學生" })]);
    const all = discoverWords(collected, owned, false).map((r) => r.hangul);
    const onlyNew = discoverWords(collected, owned, true).map((r) => r.hangul);
    expect(all).toContain("학생");
    expect(onlyNew).not.toContain("학생");
  });

  it("alreadyOwned フラグが正しく付く", () => {
    const collected = new Set(["學", "生"]);
    const owned = new Set([wordKey({ hangul: "학생", hanja: "學生" })]);
    const r = discoverWords(collected, owned).find((x) => x.hangul === "학생");
    expect(r?.alreadyOwned).toBe(true);
  });

  it("同じ読みでも漢字が違う語は、持っている語として扱わない", () => {
    const collected = new Set(["學", "生"]);
    const owned = new Set([wordKey({ hangul: "학생", hanja: "學省" })]);
    const r = discoverWords(collected, owned).find((x) => x.hangul === "학생");
    expect(r?.alreadyOwned).toBe(false);
  });
});

describe("byEase", () => {
  it("1字だけの語（字そのもの）は、2字以上の語より後ろ", () => {
    const one = { hangul: "가", hanja: "家", gloss: "" };
    const two = { hangul: "가족", hanja: "家族", gloss: "" };
    const three = { hangul: "대학생", hanja: "大學生", gloss: "" };
    expect([one, three, two].sort(byEase).map((w) => w.hanja)).toEqual(["家族", "大學生", "家"]);
  });
});

describe("wordKey", () => {
  it("互換漢字（読み別の重複コード）は統合漢字と同じキーになる", () => {
    expect(wordKey({ hangul: "연금", hanja: "年金" })).toBe(wordKey({ hangul: "연금", hanja: "年金" }));
  });
});

describe("nearWords / unlockers", () => {
  it("足りない字が1種類だけの語を、その字といっしょに返す", () => {
    // 學・生 を集めた状態 → 學校（校）, 大學（大）, 學習（習）などがあと1字
    const near = nearWords(new Set(["學", "生"]), new Set());
    const byHanja = new Map(near.map((n) => [n.word.hanja, n.missing]));
    expect(byHanja.get("學校")).toBe("校");
    expect(byHanja.get("大學")).toBe("大");
    // 大學生 も 大 だけが足りない
    expect(byHanja.get("大學生")).toBe("大");
    // 2字足りない 文學 ではなく、もう読める 學生 も含めない
    expect(byHanja.has("學生")).toBe(false);
  });

  it("2種類以上足りない語は含めない", () => {
    const near = nearWords(new Set(["學"]), new Set());
    expect(near.map((n) => n.word.hanja)).not.toContain("大學生");
  });

  it("持っている語は含めない", () => {
    const owned = new Set([wordKey({ hangul: "학교", hanja: "學校" })]);
    const near = nearWords(new Set(["學", "生"]), owned);
    expect(near.map((n) => n.word.hanja)).not.toContain("學校");
  });

  it("unlockers は増える語数の多い字から並ぶ", () => {
    const near = nearWords(new Set(["學", "生"]), new Set());
    const list = unlockers(near);
    // 大 は 大學 と 大學生 の2語を読めるようにする
    const big = list.find((u) => u.char === "大");
    expect(big?.count).toBe(2);
    for (let i = 1; i < list.length; i++) {
      expect(list[i - 1].count).toBeGreaterThanOrEqual(list[i].count);
    }
  });
});

describe("checkWordExists / findWordsByHanja / isRealWord", () => {
  it("実在する漢字列は語を返す", () => {
    expect(checkWordExists(["學", "生"])?.hangul).toBe("학생");
    expect(findWordsByHanja(["學", "生"]).map((w) => w.hangul)).toEqual(["학생"]);
  });

  it("実在しない漢字列は null", () => {
    expect(checkWordExists(["生", "學"])).toBeNull(); // 生學 は実在語でない
  });

  it("空配列は null", () => {
    expect(checkWordExists([])).toBeNull();
  });

  it("isRealWord はハングルで実在判定する", () => {
    expect(isRealWord("학생")).toBe(true);
    expect(isRealWord("없는단어")).toBe(false);
  });
});

describe("unlockedBy", () => {
  it("はじめての字を含む語をあつめると、その字で読めるようになる語を返す", () => {
    // 學・生 を持っていて 大學 をあつめる → 大 が入り 大學生 が読めるようになる（大門 は 門 が無い）
    const got = unlockedBy({ hangul: "대학", hanja: "大學" }, new Set(["學", "生"]), new Set());
    expect(got.map((w) => w.hanja)).toEqual(["大學生"]);
  });

  it("読みやすい順（字数の少ない語から）に並び、あつめる語そのものは含めない", () => {
    const got = unlockedBy({ hangul: "대학", hanja: "大學" }, new Set(["學", "生", "門"]), new Set());
    expect(got.map((w) => w.hanja)).toEqual(["大門", "大學生"]);
  });

  it("知っている字だけの語では何も増えない", () => {
    expect(unlockedBy({ hangul: "학생", hanja: "學生" }, new Set(["學", "生", "大"]), new Set())).toEqual([]);
  });

  it("持っている語は数えない", () => {
    const owned = new Set([wordKey({ hangul: "대학생", hanja: "大學生" })]);
    expect(unlockedBy({ hangul: "대학", hanja: "大學" }, new Set(["學", "生"]), owned)).toEqual([]);
  });
});

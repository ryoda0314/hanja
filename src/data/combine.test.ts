import { describe, expect, it } from "vitest";
import { checkWordExists, discoverWords, isRealWord } from "./combine";

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

  it("構成漢字が多い語が先に来る", () => {
    const collected = new Set(["大", "學", "生"]);
    const results = discoverWords(collected, new Set());
    expect(results[0].hanja).toBe("大學生"); // 3文字が先頭
  });

  it("onlyNew=true は所持済みの語を除外する", () => {
    const collected = new Set(["學", "生"]);
    const owned = new Set(["학생"]);
    const all = discoverWords(collected, owned, false).map((r) => r.hangul);
    const onlyNew = discoverWords(collected, owned, true).map((r) => r.hangul);
    expect(all).toContain("학생");
    expect(onlyNew).not.toContain("학생");
  });

  it("alreadyOwned フラグが正しく付く", () => {
    const collected = new Set(["學", "生"]);
    const owned = new Set(["학생"]);
    const r = discoverWords(collected, owned).find((x) => x.hangul === "학생");
    expect(r?.alreadyOwned).toBe(true);
  });
});

describe("checkWordExists / isRealWord", () => {
  it("実在する漢字列は語を返す", () => {
    expect(checkWordExists(["學", "生"])?.hangul).toBe("학생");
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

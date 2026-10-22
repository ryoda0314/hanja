import { describe, expect, it } from "vitest";
import { compareSyllables, isSameReading, pickToRead, readingNotes } from "./reading";

describe("compareSyllables / isSameReading", () => {
  it("音節ごとに合っているかを、答えの長さで返す", () => {
    expect(compareSyllables("대학고", "대학교")).toEqual([true, true, false]);
    expect(compareSyllables("대학", "대학교")).toEqual([true, true, false]);
  });

  it("空白は無視する", () => {
    expect(compareSyllables("대 학 교", "대학교")).toEqual([true, true, true]);
    expect(isSameReading(" 대학 교 ", "대학교")).toBe(true);
    expect(isSameReading("대학고", "대학교")).toBe(false);
  });
});

describe("readingNotes", () => {
  it("字のふだんの音と、この語での音が違う字を返す", () => {
    // 力 はふだん 력（手作業データ）。この語では 녁 と読んだことにする
    expect(readingNotes("녁학", "力學")).toEqual([{ char: "力", usual: "력", here: "녁" }]);
  });

  it("ふだんの音どおりなら空", () => {
    expect(readingNotes("대학생", "大學生")).toEqual([]);
  });

  it("ハングルと漢字の字数が違えば空", () => {
    expect(readingNotes("대학교", "大學")).toEqual([]);
  });
});

describe("pickToRead", () => {
  const pool = Array.from({ length: 30 }, (_, i) => i);

  it("出していない語のうち、上から20語の中から選ぶ", () => {
    expect(pickToRead(pool, () => false, () => 0)).toBe(0);
    expect(pickToRead(pool, () => false, () => 0.999)).toBe(19);
    expect(pickToRead(pool, (n) => n < 5, () => 0)).toBe(5);
  });

  it("出す語が無ければ null", () => {
    expect(pickToRead(pool, () => true)).toBeNull();
    expect(pickToRead([], () => false)).toBeNull();
  });
});

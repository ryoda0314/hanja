import { describe, expect, it } from "vitest";
import { compareSyllables, initialForm, isSameReading, pickToRead, readingNotes, usualReading, variantRule } from "./reading";

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
  it("字のふだんの音と、この語での音が違う字を、わけと一緒に返す", () => {
    // 力 はふだん 력（手作業データ）。力學 は語のはじめなので 역학
    expect(readingNotes("역학", "力學")).toEqual([{ char: "力", usual: "력", here: "역", rule: "initial" }]);
  });

  it("ふだんの音どおりなら空", () => {
    expect(readingNotes("대학생", "大學生")).toEqual([]);
    expect(readingNotes("능력", "能力")).toEqual([]);
  });

  it("ハングルと漢字の字数が違えば空", () => {
    expect(readingNotes("대학교", "大學")).toEqual([]);
  });

  it("字のふだんの音をつなげた読み", () => {
    expect(usualReading("力學")).toBe("력학");
  });
});

describe("initialForm（頭音法則）", () => {
  it("語のはじめの ㄹ は ㄴ に、ㅣ・ㅑ・ㅕ・ㅛ・ㅠ の前では落ちる", () => {
    expect(initialForm("래")).toBe("내");
    expect(initialForm("로")).toBe("노");
    expect(initialForm("력")).toBe("역");
    expect(initialForm("리")).toBe("이");
    expect(initialForm("률")).toBe("율");
  });

  it("語のはじめの ㄴ は ㅣ・ㅑ・ㅕ・ㅛ・ㅠ の前で落ちる。ほかは変わらない", () => {
    expect(initialForm("녀")).toBe("여");
    expect(initialForm("년")).toBe("연");
    expect(initialForm("난")).toBeNull();
    expect(initialForm("학")).toBeNull();
  });
});

describe("variantRule", () => {
  const rule = (usual: string, word: string, i: number) => variantRule(usual, Array.from(word), i);

  it("語のはじめ：來日 내일・女子 여자（도래 の 래 はふだんどおり）", () => {
    expect(rule("래", "내일", 0)).toBe("initial");
    expect(rule("녀", "여자", 0)).toBe("initial");
  });

  it("語の中でも語のはじめと同じ形：不利益 불이익", () => {
    expect(rule("리", "불이익", 1)).toBe("inside");
  });

  it("母音や ㄴ のあとの 률・렬：比率 비율・旋律 선율・陳列 진열（確率 확률 はふだんどおり）", () => {
    expect(rule("률", "비율", 1)).toBe("afterVowel");
    expect(rule("률", "선율", 1)).toBe("afterVowel");
    expect(rule("렬", "진열", 1)).toBe("afterVowel");
  });

  it("ㄷ・ㅈ の前で ㄹ が落ちる：不足 부족・不動産 부동산", () => {
    expect(rule("불", "부족", 0)).toBe("beforeDJ");
    expect(rule("불", "부동산", 0)).toBe("beforeDJ");
  });

  it("ㅅ を書き足す：數字 숫자・回數 횟수", () => {
    expect(rule("수", "숫자", 0)).toBe("saisiot");
    expect(rule("회", "횟수", 0)).toBe("saisiot");
  });

  it("ほかは、語によって読みが変わる字：音樂 음악・自轉車 자전거", () => {
    expect(rule("락", "음악", 1)).toBe("other");
    expect(rule("차", "자전거", 2)).toBe("other");
  });
});

describe("pickToRead", () => {
  const pool = Array.from({ length: 30 }, (_, i) => i);

  it("出していない語のうち、上から20語の中から選ぶ", () => {
    expect(pickToRead(pool, () => false, () => 0)).toBe(0);
    expect(pickToRead(pool, () => false, () => 0.999)).toBe(19);
    expect(pickToRead(pool, (n) => n < 5, () => 0)).toBe(5);
  });

  it("段階に合う語があれば、その中から（無くなれば、ほかの語も）", () => {
    const even = (n: number) => n % 2 === 0;
    // 偶数（段階に合う語）15語の中から
    expect(pickToRead(pool, () => false, () => 0.999, even)).toBe(28);
    // 偶数はもう出した → ほかの語から
    expect(pickToRead(pool, even, () => 0, even)).toBe(1);
  });

  it("出す語が無ければ null", () => {
    expect(pickToRead(pool, () => true)).toBeNull();
    expect(pickToRead([], () => false)).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import { jpForm } from "./dataset";
import {
  commonRank,
  enrich,
  guessHanja,
  isHanjaInput,
  isRare,
  resolveByHanja,
  resolveLocal,
  resolveManual,
  resolveStem,
} from "./resolver";

describe("resolveLocal", () => {
  it("種語彙の語を漢字・構成漢字つきで解決する", () => {
    const w = resolveLocal("학생");
    expect(w).not.toBeNull();
    expect(w!.hanja).toBe("學生");
    expect(w!.chars).toEqual(["學", "生"]);
    expect(w!.source).toBe("seed");
    // 各構成漢字の読みが付与される
    expect(w!.charData.map((c) => c.char)).toEqual(["學", "生"]);
    expect(w!.charData[0].readings[0].eum).toBe("학");
  });

  it("前後の空白を無視する", () => {
    expect(resolveLocal("  대학  ")?.hanja).toBe("大學");
  });

  it("辞書に無い語は null", () => {
    expect(resolveLocal("존재하지않는단어")).toBeNull();
  });

  it("3文字語も全構成漢字に分解する", () => {
    const w = resolveLocal("대학생");
    expect(w!.chars).toEqual(["大", "學", "生"]);
  });
});

describe("enrich / resolveManual", () => {
  it("手入力の漢字表記から構成漢字を抽出する", () => {
    const w = resolveManual("학생", "學生", "学生");
    expect(w.chars).toEqual(["學", "生"]);
    expect(w.source).toBe("manual");
  });

  it("辞書未収録の漢字は charData に含めないが chars には残す", () => {
    // 嗯(U+55EF) は種データに無い漢字
    const w = enrich({ hangul: "테스트", hanja: "嗯生", gloss: "テスト" }, "manual");
    expect(w.chars).toEqual(["嗯", "生"]);
    expect(w.charData.map((c) => c.char)).toEqual(["生"]);
  });
});

describe("resolveByHanja / isHanjaInput", () => {
  it("韓国の字で打った漢字語を引く", () => {
    expect(resolveByHanja("學生").map((w) => w.hangul)).toEqual(["학생"]);
  });

  it("日本の字（新字体）で打っても韓国の字の語が見つかる", () => {
    expect(resolveByHanja("学生").map((w) => w.hanja)).toEqual(["學生"]);
    expect(resolveByHanja("韓国語").map((w) => w.hangul)).toEqual(["한국어"]);
  });

  it("ハングルや混ざった入力は漢字入力として扱わない", () => {
    expect(isHanjaInput("학생")).toBe(false);
    expect(isHanjaInput("學생")).toBe(false);
    expect(isHanjaInput(" 學生 ")).toBe(true);
    expect(resolveByHanja("학생")).toEqual([]);
  });
});

describe("jpForm", () => {
  it("韓国の字を日本の字にする（同じ字はそのまま）", () => {
    expect(jpForm("大學")).toBe("大学");
    expect(jpForm("人生")).toBe("人生");
  });
});

describe("guessHanja", () => {
  it("辞書に無い語の漢字を、集めた字の音から組み立てる", () => {
    expect(guessHanja("한국인", ["韓", "國", "人"])).toEqual(["韓國人"]);
  });

  it("同じ音の字が複数あれば、集めた字の並び順で組み合わせる", () => {
    // 文（문）と 問（문）の両方を集めている
    expect(guessHanja("문학", ["問", "文", "學"])).toEqual(["問學", "文學"]);
  });

  it("どこかの音節を読む字を集めていなければ空", () => {
    expect(guessHanja("한국인", ["韓", "國"])).toEqual([]);
    expect(guessHanja("abc", ["韓"])).toEqual([]);
  });
});

describe("resolveStem", () => {
  it("語尾や助詞を外すと漢字語になるなら、その語を返す", () => {
    expect(resolveStem("학생이에요")?.stem).toBe("학생");
    expect(resolveStem("운동했어요")?.words[0].hanja).toBe("運動");
    expect(resolveStem("시간에")?.stem).toBe("시간");
  });

  it("辞書にそのままある語や、外しても語にならない語は null", () => {
    expect(resolveStem("학생")).toBeNull();
    expect(resolveStem("사랑")).toBeNull();
    expect(resolveStem("學生")).toBeNull();
  });
});

describe("commonRank / isRare", () => {
  it("한국어기초사전 の等級があればそれ（초급 が先）", () => {
    expect(commonRank({ lv: 1 })).toBeLessThan(commonRank({ lv: 3 }));
    expect(commonRank({ lv: 2, fq: 0 })).toBe(2);
  });

  it("等級が無ければ字幕での頻度から。よく使っても 고급 と同じ段まで", () => {
    expect(commonRank({ lv: 4, fq: 300 })).toBe(3);
    expect(commonRank({ fq: 1.5 })).toBe(4);
    expect(commonRank({ fq: 0.3 })).toBe(5);
    // 頻度の分からない語（手で入れた語など）は勧めないほどではない
    expect(commonRank({})).toBe(4);
  });

  it("ほとんど使わない語と、人をののしる語は勧めない", () => {
    expect(isRare({ hangul: "하지", hanja: "夏至", lv: 4, fq: 0 })).toBe(true);
    expect(isRare({ hangul: "하자", hanja: "瑕疵", lv: 3, fq: 0 })).toBe(false);
    expect(isRare({ hangul: "병신", hanja: "病身", fq: 27 })).toBe(true);
    expect(isRare({ hangul: "학생", hanja: "學生" })).toBe(false);
  });
});

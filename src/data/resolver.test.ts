import { describe, expect, it } from "vitest";
import { enrich, resolveLocal, resolveManual } from "./resolver";

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

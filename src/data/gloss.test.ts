import { describe, expect, it } from "vitest";
import { glossText, maskedGlossText } from "./gloss";

describe("glossText", () => {
  it("よみ【表記】を表記にする。英語や手で書いた意味はそのまま", () => {
    expect(glossText("じどう【児童】、せいと【生徒】、がくせい【学生】")).toBe("児童、生徒、学生");
    expect(glossText("かかく【価格】、プライス")).toBe("価格、プライス");
    expect(glossText("a student")).toBe("a student");
  });
});

describe("maskedGlossText", () => {
  it("語の字（日本の字も）が入った対訳だけ よみ で出す", () => {
    expect(maskedGlossText("じどう【児童】、せいと【生徒】、がくせい【学生】", "學生")).toBe("児童、せいと、がくせい");
    expect(maskedGlossText("べんきょう【勉強】、がくしゅう【学習】", "工夫")).toBe("勉強、学習");
  });

  it("よみの無い意味に字が見えてしまうなら出さない", () => {
    expect(maskedGlossText("学生", "學生")).toBeNull();
    expect(maskedGlossText("a student", "學生")).toBe("a student");
  });
});

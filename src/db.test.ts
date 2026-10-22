import { describe, expect, it } from "vitest";
import { parseBackup, tallyChars } from "./db";

describe("tallyChars", () => {
  it("字ごとに、その字が入った語の数と最初・最後の日時をまとめる", () => {
    const list = tallyChars([
      { chars: ["學", "生"], addedAt: 200 },
      { chars: ["大", "學"], addedAt: 100 },
      { chars: ["大", "學", "生"], addedAt: 300 },
    ]);
    const hak = list.find((c) => c.char === "學");
    expect(hak).toEqual({ char: "學", count: 3, firstAddedAt: 100, lastAddedAt: 300 });
    expect(list.find((c) => c.char === "生")?.count).toBe(2);
  });

  it("1語に同じ字が2回あっても1回と数える", () => {
    expect(tallyChars([{ chars: ["家", "家"], addedAt: 1 }])[0].count).toBe(1);
  });
});

describe("parseBackup", () => {
  it("書き出した形を読む", () => {
    const text = JSON.stringify({
      app: "kotonone",
      version: 1,
      words: [{ hangul: "학생", hanja: "學生", gloss: "学生", source: "seed", addedAt: 5 }],
    });
    expect(parseBackup(text)).toEqual([{ hangul: "학생", hanja: "學生", gloss: "学生", source: "seed", addedAt: 5 }]);
  });

  it("足りない項目は無難な値で補う", () => {
    const text = JSON.stringify({ app: "kotonone", words: [{ hangul: "학생", hanja: "學生" }] });
    const [w] = parseBackup(text)!;
    expect(w.gloss).toBe("");
    expect(w.source).toBe("manual");
    expect(typeof w.addedAt).toBe("number");
  });

  it("ほかのファイルや壊れた中身は null", () => {
    expect(parseBackup("not json")).toBeNull();
    expect(parseBackup(JSON.stringify({ app: "other", words: [] }))).toBeNull();
    expect(parseBackup(JSON.stringify({ app: "kotonone", words: [{ hangul: "", hanja: "學" }] }))).toBeNull();
  });
});

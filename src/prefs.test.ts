import { describe, expect, it } from "vitest";
import { displayHanja, initialScript } from "./prefs";

describe("initialScript", () => {
  const from = (saved: Record<string, string>) => (key: string) => saved[key] ?? null;

  it("まだ選んでいなければ日本の字", () => {
    expect(initialScript(from({}))).toBe("ja");
  });

  it("選んだ字形はそのまま", () => {
    expect(initialScript(from({ "hanjaatume.kanji": "both" }))).toBe("both");
    expect(initialScript(from({ "hanjaatume.kanji": "ko", "hanjaatume.script": "both" }))).toBe("ko");
  });

  it("前の版の値は 韓国の字 だけ引き継ぐ（両方 は前の既定が書き込まれていただけのことが多い）", () => {
    expect(initialScript(from({ "hanjaatume.script": "ko" }))).toBe("ko");
    expect(initialScript(from({ "hanjaatume.script": "both" }))).toBe("ja");
  });
});

describe("displayHanja", () => {
  it("ko 設定では韓国漢字を返す", () => {
    expect(displayHanja("ko", "會社", "会社")).toBe("會社");
  });

  it("ja 設定では日本漢字を返す", () => {
    expect(displayHanja("ja", "會社", "会社")).toBe("会社");
  });

  it("both 設定では両方を併記する", () => {
    expect(displayHanja("both", "會社", "会社")).toBe("會社 / 会社");
  });

  it("字形が同じ語はどの設定でも単一表示", () => {
    expect(displayHanja("both", "生活", "生活")).toBe("生活");
    expect(displayHanja("ja", "生活", "生活")).toBe("生活");
  });

  it("jp 未指定なら ko をそのまま返す", () => {
    expect(displayHanja("both", "社會")).toBe("社會");
  });
});

import { describe, expect, it } from "vitest";
import { displayHanja } from "./prefs";

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

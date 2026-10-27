import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// 送り先は本物でない番地にして、fetch も差し替える（テストから本番に数えが飛ばないように）。
const SITE = "https://kotonone.example/";
let fetchMock: ReturnType<typeof vi.fn>;
let store: Map<string, string>;

async function load(prod: boolean, origin: string) {
  vi.stubEnv("PROD", prod);
  vi.stubEnv("VITE_SITE_URL", SITE);
  vi.stubEnv("VITE_SUPABASE_URL", "https://supabase.example");
  vi.stubEnv("VITE_SUPABASE_ANON_KEY", "anon");
  vi.stubGlobal("location", { origin });
  vi.resetModules();
  return import("./usage");
}

beforeEach(() => {
  store = new Map();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
  });
  fetchMock = vi.fn(() => Promise.resolve(new Response(null, { status: 204 })));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("countUsage", () => {
  it("公開先で開いたときは kn_ping に送る", async () => {
    const { countUsage } = await load(true, "https://kotonone.example");
    countUsage("open");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://supabase.example/rest/v1/rpc/kn_ping");
    expect(JSON.parse(init.body as string)).toMatchObject({ p_kind: "open", p_standalone: false });
  });

  it("同じ端末は同じ番号で送る", async () => {
    const { countUsage } = await load(true, "https://kotonone.example");
    countUsage("open");
    countUsage("collect");
    const [a, b] = fetchMock.mock.calls.map(([, init]) => JSON.parse((init as RequestInit).body as string).p_device);
    expect(a).toBe(b);
  });

  it("ほかの場所（手元の preview・Vercel の試しの公開）では送らない", async () => {
    const { countUsage } = await load(true, "http://localhost:4173");
    countUsage("open");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("npm run dev（本番のビルドでない）では送らない", async () => {
    const { countUsage } = await load(false, "https://kotonone.example");
    countUsage("open");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("自分 で止めたら送らない", async () => {
    const { countUsage, SEND_PREF } = await load(true, "https://kotonone.example");
    store.set(`hanjaatume.${SEND_PREF}`, "0");
    countUsage("open");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

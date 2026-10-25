// 使われ方の数（何人が使っているか）。端末ごとの番号（この端末で作った乱数。人とは結びつかない）と、開いた・あつめた・
// 読めた の回数と、ホーム画面から開いたかだけを、姉妹アプリ ことのあめ の Supabase（kn_ping、supabase/usage.sql）に送る。
// 集めた語・文は送らない。自分 で止められる。送れなくても（オフライン・送り先が無い）何も起きない。
import { isStandalone } from "./install";

export type UsageKind = "open" | "collect" | "read";

const URL_ = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
const DEVICE = "hanjaatume.device";
/** 自分 の「使われ方の数を送る」（util/local の usePref と同じ形：1 か 0）。 */
export const SEND_PREF = "sendUsage";

function deviceId(): string | null {
  try {
    let id = localStorage.getItem(DEVICE);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(DEVICE, id);
    }
    return id;
  } catch {
    return null;
  }
}

function allowed(): boolean {
  try {
    return localStorage.getItem(`hanjaatume.${SEND_PREF}`) !== "0";
  } catch {
    return true;
  }
}

/** 一つ数える（待たない）。 */
export function countUsage(kind: UsageKind): void {
  if (!URL_ || !KEY || import.meta.env.MODE === "test" || !allowed()) return;
  const device = deviceId();
  if (!device) return;
  void fetch(`${URL_}/rest/v1/rpc/kn_ping`, {
    method: "POST",
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ p_device: device, p_kind: kind, p_standalone: isStandalone() }),
    keepalive: true,
  }).catch(() => {
    /* 数えられなかっただけ */
  });
}

import { useState } from "react";
import { t } from "../copy";
import { RATES, usePrefs } from "../prefs";
import { speak, useKoreanVoice } from "../util/speech";
import { Icon } from "./Icon";
import styles from "./SpeakButton.module.css";

/** 語を読み上げるボタン。読んでいる間は、雨粒の波紋のように輪が広がる（ことのあめ と同じ）。 */
export function SpeakButton({ text, size = "md" }: { text: string; size?: "md" | "lg" }) {
  const voice = useKoreanVoice();
  const { rate } = usePrefs();
  const [state, setState] = useState<"idle" | "playing" | "error">("idle");
  if (!voice) return null;

  async function play() {
    if (!voice) return;
    setState("playing");
    const ok = await speak(text, voice, RATES[rate]);
    setState(ok ? "idle" : "error");
  }

  const className = [styles.button, size === "lg" ? styles.lg : "", styles[state]].filter(Boolean).join(" ");
  return (
    <button
      type="button"
      className={className}
      onClick={play}
      aria-label={state === "error" ? t.common.playFailed : t.common.play}
      title={state === "error" ? t.common.playFailed : undefined}
    >
      <Icon name="speaker" size={size === "lg" ? 26 : 20} />
    </button>
  );
}

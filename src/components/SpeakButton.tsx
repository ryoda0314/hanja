import { useState } from "react";
import { t } from "../copy";
import { RATES, usePrefs } from "../prefs";
import { speak, useKoreanVoice } from "../util/speech";
import { Icon } from "./Icon";
import styles from "./SpeakButton.module.css";

/**
 * 読み上げるボタン。読んでいる間は、雨粒の波紋のように輪が広がる（ことのあめ と同じ）。
 * src があれば録音（ことのあめ の例文の音声）を先に鳴らし、鳴らなければ端末の韓国語の声で読む。
 */
export function SpeakButton({
  text,
  size = "md",
  src,
}: {
  text: string;
  size?: "md" | "lg";
  /** 録音の場所を求める（押したときに一度）。 */
  src?: () => Promise<string | null>;
}) {
  const voice = useKoreanVoice();
  const { rate } = usePrefs();
  const [state, setState] = useState<"idle" | "playing" | "error">("idle");
  if (!voice && !src) return null;

  async function playRecording(): Promise<boolean> {
    const url = src ? await src() : null;
    if (!url) return false;
    return new Promise((resolve) => {
      const audio = new Audio(url);
      audio.playbackRate = RATES[rate] / RATES.normal;
      audio.onended = () => resolve(true);
      audio.onerror = () => resolve(false);
      audio.play().catch(() => resolve(false));
    });
  }

  async function play() {
    setState("playing");
    const ok = (await playRecording()) || (voice ? await speak(text, voice, RATES[rate]) : false);
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

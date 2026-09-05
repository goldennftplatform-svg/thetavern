/** Original catch punctuation; the continuous score lives in soundtrack.ts. */
import { audioContext, audioOutput, canPlayAudio } from "./soundtrack";

export async function playCatchFanfare(): Promise<boolean> {
  const ac = audioContext();
  if (!ac || !canPlayAudio()) return false;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  const now = ac.currentTime;
  osc.type = "triangle";
  osc.frequency.setValueAtTime(146.83, now);
  osc.frequency.setValueAtTime(220, now + 0.12);
  gain.gain.setValueAtTime(0.16, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
  osc.connect(gain);
  gain.connect(audioOutput());
  osc.onended = () => { osc.disconnect(); gain.disconnect(); };
  osc.start();
  osc.stop(now + 0.42);
  return true;
}

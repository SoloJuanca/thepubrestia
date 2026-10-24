let audio: AudioContext | null = null;

function context() {
  if (typeof window === "undefined" || !window.AudioContext) return null;
  if (!audio) audio = new window.AudioContext();
  return audio;
}

export async function unlockKitchenSound() {
  const ctx = context();
  if (!ctx) return false;
  if (ctx.state === "suspended") await ctx.resume();
  return ctx.state === "running";
}

/** Two-note bell so the kitchen hears a new ticket without looking at the screen. */
export function playKitchenChime() {
  const ctx = context();
  if (!ctx || ctx.state !== "running") return false;
  const now = ctx.currentTime;
  [784, 1046].forEach((freq, index) => {
    const start = now + index * 0.16;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.22, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.45);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + 0.46);
  });
  return true;
}

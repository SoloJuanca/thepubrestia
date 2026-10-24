let audio: AudioContext | null = null;

/** Survives router.refresh() so a new ticket still rings after the screen updates. */
const seenTicketIds = new Set<string>();
let seenTicketsReady = false;

function context() {
  if (typeof window === "undefined") return null;
  const Ctx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctx) return null;
  if (!audio) audio = new Ctx();
  return audio;
}

export function isKitchenSoundRunning() {
  return audio?.state === "running";
}

export function kitchenSoundWanted() {
  try {
    return window.localStorage.getItem("kitchen-sound") === "1";
  } catch {
    return false;
  }
}

function rememberKitchenSound() {
  try {
    window.localStorage.setItem("kitchen-sound", "1");
  } catch {
    // Private mode can block storage. The chime still works this visit.
  }
}

/** Two-note bell. Call resume() in the same click before this on the first tap. */
export function playKitchenChime() {
  const ctx = context();
  if (!ctx) return false;
  const now = ctx.currentTime;
  [784, 1175].forEach((freq, index) => {
    const start = now + index * 0.18;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.45, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.55);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + 0.56);
  });
  return true;
}

/** Must run inside the tap that turns sound on. */
export async function enableKitchenSound() {
  const ctx = context();
  if (!ctx) return false;
  rememberKitchenSound();
  if (ctx.state === "suspended") {
    try {
      await ctx.resume();
    } catch {
      return false;
    }
  }
  if (ctx.state !== "running") return false;
  playKitchenChime();
  return true;
}

export function noteKitchenTickets(ids: string[]) {
  if (!seenTicketsReady) {
    for (const id of ids) seenTicketIds.add(id);
    seenTicketsReady = true;
    return false;
  }
  const arrived = ids.some((id) => !seenTicketIds.has(id));
  for (const id of ids) seenTicketIds.add(id);
  return arrived;
}

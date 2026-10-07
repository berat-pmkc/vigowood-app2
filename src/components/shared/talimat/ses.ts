/**
 * Tablet uyarı sesi (Web Audio). Tarayıcılar kullanıcı etkileşimi olmadan ses çaldırmaz;
 * bu yüzden ilk dokunuşta AudioContext "hazırlanır" (sesHazirla). Hazır değilse bipDizisi sessiz kalır.
 */
let ctx: AudioContext | null = null;
let kuruldu = false;

type AudioCtor = typeof AudioContext;

function ctxOlustur(): AudioContext | null {
  if (ctx) return ctx;
  if (typeof window === "undefined") return null;
  const C: AudioCtor | undefined =
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioCtor }).webkitAudioContext;
  if (!C) return null;
  try {
    ctx = new C();
  } catch {
    ctx = null;
  }
  return ctx;
}

/** İlk dokunuş/tuşta sesi aç. Birden çok kez çağrılabilir. */
export function sesHazirla(): void {
  if (kuruldu || typeof window === "undefined") return;
  kuruldu = true;
  const ac = () => {
    const c = ctxOlustur();
    if (c && c.state === "suspended") void c.resume();
    if (c && c.state === "running") {
      window.removeEventListener("pointerdown", ac);
      window.removeEventListener("keydown", ac);
      window.removeEventListener("touchstart", ac);
    }
  };
  window.addEventListener("pointerdown", ac);
  window.addEventListener("keydown", ac);
  window.addEventListener("touchstart", ac);
}

/** Kısa-kısa-uzun bip dizisi. Ses hazır değilse (etkileşim yok) sessizce çıkar. */
export function bipDizisi(): boolean {
  const c = ctxOlustur();
  if (!c) return false;
  if (c.state === "suspended") void c.resume();
  if (c.state !== "running") return false;
  const notalar: Array<{ f: number; sure: number }> = [
    { f: 880, sure: 0.18 },
    { f: 880, sure: 0.18 },
    { f: 1175, sure: 0.4 },
  ];
  let t = c.currentTime + 0.02;
  for (const n of notalar) {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = "sine";
    osc.frequency.value = n.f;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.35, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + n.sure);
    osc.connect(gain).connect(c.destination);
    osc.start(t);
    osc.stop(t + n.sure + 0.02);
    t += n.sure + 0.1;
  }
  return true;
}

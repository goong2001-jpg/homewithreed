const ctx = (() => {
  try { return new (window.AudioContext || (window as any).webkitAudioContext)(); } catch { return null; }
})();

function beep(freq: number, dur: number, type: OscillatorType = 'sine', vol = 0.3) {
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.type = type;
  osc.frequency.setValueAtTime(freq, ctx.currentTime);
  gain.gain.setValueAtTime(vol, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + dur);
}

export function playCorrect() {
  beep(523, 0.12);
  setTimeout(() => beep(659, 0.12), 100);
  setTimeout(() => beep(784, 0.25), 200);
}

export function playWrong() {
  beep(300, 0.15, 'sawtooth', 0.2);
  setTimeout(() => beep(220, 0.25, 'sawtooth', 0.15), 150);
}

export function playClick() {
  beep(800, 0.06, 'sine', 0.15);
}

export function playPurchase() {
  [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => beep(f, 0.15), i * 90));
}

export function playStreak() {
  [523, 659, 784, 1047, 1319].forEach((f, i) => setTimeout(() => beep(f, 0.12), i * 70));
}

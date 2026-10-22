const ctx = (() => {
  try { return new (window.AudioContext || (window as any).webkitAudioContext)(); } catch { return null; }
})();

/**
 * 브라우저는 사용자가 화면을 한 번 만지기 전까지 소리를 잠가 둔다(autoplay 정책).
 * 잠겨 있으면 깨워 본다 — 실패해도 조용히 넘어간다.
 */
function unlock() {
  if (!ctx || ctx.state !== 'suspended') return;
  try { ctx.resume().catch(() => {}); } catch {}
}

// 첫 터치/클릭/키 입력 때 한 번만 깨운다
if (typeof document !== 'undefined') {
  const events = ['pointerdown', 'touchstart', 'keydown'] as const;
  const once = () => {
    unlock();
    events.forEach(e => document.removeEventListener(e, once));
  };
  events.forEach(e => document.addEventListener(e, once, { passive: true }));
}

function beep(freq: number, dur: number, type: OscillatorType = 'sine', vol = 0.3) {
  if (!ctx) return;
  unlock(); // 잠겨 있던 소리는 이번 입력으로 풀린다
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

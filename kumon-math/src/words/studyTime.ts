import { logDay } from './log';

/**
 * 앱에서 공부한 시간 재기.
 *
 * 화면이 켜져 있어도 아이가 딴짓을 하면 세지 않는다.
 * 마지막으로 화면을 만지거나(또는 요정이 읽어 주는 소리가 난 뒤) IDLE_MS 안일 때만
 * TICK_MS 마다 그만큼을 오늘 기록(appSec)에 더한다.
 */
const TICK_MS = 5000;
export const IDLE_MS = 90_000;

let last = 0;
let timer: ReturnType<typeof setInterval> | null = null;

/** 지금 공부하는 중이라고 알린다 — 화면을 만질 때, 책을 읽어 줄 때, 녹음할 때 */
export function touchActivity(now: number = Date.now()): void {
  last = now;
}

/** 지금 이 순간을 공부 시간으로 셀지 */
export function isActive(now: number, lastActivity: number, visible: boolean): boolean {
  return visible && lastActivity > 0 && now - lastActivity < IDLE_MS;
}

/** 앱을 열 때 한 번 부른다 (두 번 불러도 하나만 돈다) */
export function startStudyTimer(): () => void {
  if (timer || typeof window === 'undefined') return () => {};
  const onInput = () => touchActivity();
  window.addEventListener('pointerdown', onInput, { passive: true });
  window.addEventListener('keydown', onInput);
  timer = setInterval(() => {
    const visible = typeof document === 'undefined' || document.visibilityState !== 'hidden';
    if (isActive(Date.now(), last, visible)) logDay('appSec', TICK_MS / 1000);
  }, TICK_MS);
  return () => {
    window.removeEventListener('pointerdown', onInput);
    window.removeEventListener('keydown', onInput);
    if (timer) clearInterval(timer);
    timer = null;
  };
}

import { useEffect, useState } from 'react';

/**
 * 흘러가는 '지금'.
 *
 * 이 앱의 화면은 대부분 '지금'에 기대고 있다 —
 * 돌아가는 타이머의 경과 시간, 아직 안 적힌 시간, 오늘의 합계까지.
 * 그래서 '지금'을 한 군데서만 만들고 필요한 곳에 인자로 흘려보낸다.
 *
 * 폰을 껐다 켜면 setInterval은 그동안 안 돌았을 수 있으므로
 * 화면이 다시 보일 때 한 번 더 읽는다 — 안 그러면 타이머가 멈춰 보인다.
 */
export function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const tick = () => setNow(Date.now());
    const id = setInterval(tick, intervalMs);

    const onVisible = () => { if (!document.hidden) tick(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', tick);

    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', tick);
    };
  }, [intervalMs]);

  return now;
}

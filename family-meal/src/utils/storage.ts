/** localStorage 래퍼. couple-budget/src/utils/storage.ts 와 같은 관용구를 쓴다. */

export const KEYS = {
  plan: 'family_meal_plan',
  settings: 'family_meal_settings',
  /** 장바구니에서 이미 담은 항목 키 목록 */
  checked: 'family_meal_checked',
} as const;

export function load<T>(key: string, fallback: T): T {
  try {
    const saved = localStorage.getItem(key);
    if (saved) return JSON.parse(saved) as T;
  } catch {}
  return fallback;
}

export function save(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    // 사파리 프라이빗 모드 등에서 저장이 막힐 수 있다. 앱을 죽이지는 않는다.
    console.warn('저장 실패:', e);
  }
}

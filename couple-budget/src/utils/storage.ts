/**
 * localStorage 래퍼.
 * receipt-tracker/src/hooks/useTransactions.ts 의 관용구를 타입 하나로 일반화한 것.
 */

export const KEYS = {
  persons: 'couple_budget_persons',
  incomes: 'couple_budget_incomes',
  fixedExpenses: 'couple_budget_fixed',
  expenses: 'couple_budget_expenses',
  settings: 'couple_budget_settings',
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

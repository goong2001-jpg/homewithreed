import { DateKey } from '../types';

/**
 * 날짜 계산. 전부 순수 함수이고 '오늘'은 인자로 받는다 —
 * couple-budget/src/utils/budget.ts 의 관행 그대로, 테스트가 시계에 의존하지 않게.
 */

/** 오늘 'YYYY-MM-DD'. 일부러 지역시각을 쓴다 (UTC로 하면 한국 새벽에 하루 어긋난다) */
export function todayKey(d = new Date()): DateKey {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseDate(key: DateKey): { y: number; m: number; d: number } {
  const [y, m, d] = key.split('-').map(Number);
  return { y, m, d };
}

export function daysInMonth(y: number, m: number): number {
  return new Date(y, m, 0).getDate();   // m월 0일 = (m-1)월의 마지막 날
}

/**
 * 두 날짜 사이의 일수 (to − from).
 * UTC 자정 기준으로 빼서 서머타임/시간대 때문에 하루가 어긋나는 일을 막는다.
 */
export function daysBetween(from: DateKey, to: DateKey): number {
  const a = parseDate(from);
  const b = parseDate(to);
  const ms = Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d);
  return Math.round(ms / 86_400_000);
}

/**
 * from 이후 '완전히 지난' 개월 수.
 * 3월 10일 시작 → 4월 9일이면 0, 4월 10일이면 1.
 * 대출을 몇 회차까지 갚았는지 세는 데 쓴다.
 */
export function monthsBetween(from: DateKey, to: DateKey): number {
  const a = parseDate(from);
  const b = parseDate(to);
  let months = (b.y - a.y) * 12 + (b.m - a.m);
  if (b.d < a.d) months -= 1;
  return months;
}

/**
 * n개월 뒤 날짜. 말일은 그 달의 마지막 날로 당긴다
 * (1월 31일 + 1개월 = 2월 28일. 자바스크립트 기본 동작인 3월 3일은 대출 만기로 쓰면 곤란하다)
 */
export function addMonths(key: DateKey, n: number): DateKey {
  const { y, m, d } = parseDate(key);
  const total = (y * 12 + (m - 1)) + n;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  const nd = Math.min(d, daysInMonth(ny, nm));
  return `${ny}-${String(nm).padStart(2, '0')}-${String(nd).padStart(2, '0')}`;
}

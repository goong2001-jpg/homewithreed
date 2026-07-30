import { DateKey, MonthKey } from '../types';

/** 12,345원 */
export function won(n: number): string {
  return `${Math.round(n).toLocaleString('ko-KR')}원`;
}

/** 부호를 항상 붙인다 — 여유돈처럼 음수가 의미 있는 값에 쓴다 */
export function signedWon(n: number): string {
  const r = Math.round(n);
  if (r === 0) return '0원';
  return `${r < 0 ? '−' : '+'}${Math.abs(r).toLocaleString('ko-KR')}원`;
}

/** 큰 금액을 짧게: 3,200,000 → 320만원 */
export function shortWon(n: number): string {
  const abs = Math.abs(Math.round(n));
  const sign = n < 0 ? '−' : '';
  if (abs >= 100_000_000) {
    const eok = abs / 100_000_000;
    return `${sign}${trimZero(eok)}억원`;
  }
  if (abs >= 10_000) {
    const man = abs / 10_000;
    return `${sign}${trimZero(man)}만원`;
  }
  return `${sign}${abs.toLocaleString('ko-KR')}원`;
}

function trimZero(n: number): string {
  return String(Math.round(n * 10) / 10);
}

/** '2026-07' → '2026년 7월' */
export function monthLabel(month: MonthKey): string {
  const [y, m] = month.split('-');
  return `${y}년 ${Number(m)}월`;
}

/** '2026-07' → '7월' */
export function shortMonthLabel(month: MonthKey): string {
  return `${Number(month.split('-')[1])}월`;
}

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];

/** '2026-07-10' → '7월 10일 (금)' */
export function dateLabel(date: DateKey): string {
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return `${m}월 ${d}일 (${DAY_NAMES[dt.getDay()]})`;
}

/** 입력창용: 숫자만 남기고 천 단위 콤마를 붙인다 */
export function formatAmountInput(raw: string): string {
  const digits = raw.replace(/[^0-9]/g, '');
  if (!digits) return '';
  return Number(digits).toLocaleString('ko-KR');
}

export function parseAmountInput(raw: string): number {
  const digits = raw.replace(/[^0-9]/g, '');
  return digits ? Number(digits) : 0;
}

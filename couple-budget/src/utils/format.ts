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

/**
 * 큰 금액을 짧게: 3,200,000 → 320만원, 12,000 → 1.2만원
 *
 * ⚠️ **절대 반올림하지 않는다.** 짧게 써도 값이 그대로일 때만 줄이고, 아니면 원 단위까지 다 쓴다.
 *    (v21 까지는 23,500 을 "2.4만원"으로 보여줘서 올려 저장된 것처럼 보였다 — 저장값은 맞았지만 화면이 틀렸다)
 *  · 천 원 단위로 떨어지지 않으면 → 23,500원
 *  · 억: 천만 원 단위로 떨어질 때만 → 1.5억원, 아니면 만 단위 → 12,345만원
 */
export function shortWon(n: number): string {
  const abs = Math.abs(Math.round(n));
  const sign = n < 0 ? '−' : '';
  if (abs % 1_000 !== 0 || abs < 10_000) {
    return `${sign}${abs.toLocaleString('ko-KR')}원`;
  }
  if (abs >= 100_000_000 && abs % 10_000_000 === 0) {
    return `${sign}${(abs / 100_000_000).toLocaleString('ko-KR')}억원`;
  }
  // 천 원 단위로 떨어지므로 만으로 나누면 소수 한 자리까지만 나온다 — 버리는 값이 없다
  return `${sign}${(abs / 10_000).toLocaleString('ko-KR')}만원`;
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

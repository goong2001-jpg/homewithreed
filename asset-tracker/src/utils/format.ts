import { DateKey } from '../types';
import { daysBetween, monthsBetween } from './date';

/** 12,345원 */
export function won(n: number): string {
  return `${Math.round(n).toLocaleString('ko-KR')}원`;
}

/** 부호를 항상 붙인다 — 수익/손실처럼 음수가 의미 있는 값에 쓴다 */
export function signedWon(n: number): string {
  const r = Math.round(n);
  if (r === 0) return '0원';
  return `${r < 0 ? '−' : '+'}${Math.abs(r).toLocaleString('ko-KR')}원`;
}

/** 큰 금액을 짧게: 320,000,000 → 3.2억원 */
export function shortWon(n: number): string {
  const abs = Math.abs(Math.round(n));
  const sign = n < 0 ? '−' : '';
  if (abs >= 100_000_000) {
    return `${sign}${round(abs / 100_000_000, 2)}억원`;
  }
  if (abs >= 10_000) {
    // 100만원이 넘으면 소수점을 떼야 읽힌다 ('5231.35만원'은 아무도 못 읽는다)
    return `${sign}${round(abs / 10_000, abs >= 1_000_000 ? 0 : 1)}만원`;
  }
  return `${sign}${abs.toLocaleString('ko-KR')}원`;
}

/** 소수점을 자르고 천 단위 콤마를 붙인다 — 6000만원이 아니라 6,000만원 */
function round(n: number, digits: number): string {
  return n.toLocaleString('ko-KR', { maximumFractionDigits: digits });
}

/** +12.3% / −4.5% */
export function signedPercent(ratio: number): string {
  const pct = Math.round(ratio * 1000) / 10;
  if (pct === 0) return '0%';
  return `${pct < 0 ? '−' : '+'}${Math.abs(pct)}%`;
}

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];

/** '2026-07-10' → '2026년 7월 10일 (금)' */
export function dateLabel(date: DateKey): string {
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return `${y}년 ${m}월 ${d}일 (${DAY_NAMES[dt.getDay()]})`;
}

/** '2026-07-10' → '2026.07.10' — 목록에 촘촘히 넣을 때 */
export function shortDate(date: DateKey): string {
  return date.replace(/-/g, '.');
}

/**
 * 만기까지 남은 기간: 'D-234' / 'D-DAY' / '234일 지남'.
 * 1년이 넘게 남았으면 'D-3653' 대신 '10년 남음'으로 바꾼다 — 자릿수를 세게 하면 안 된다.
 */
export function ddayLabel(date: DateKey, today: DateKey): string {
  const left = daysBetween(today, date);
  if (left === 0) return 'D-DAY';
  if (left < 0) return `${-left}일 지남`;
  if (left > 400) return `${monthsLabel(monthsBetween(today, date))} 남음`;
  return `D-${left}`;
}

/** 개월 수를 사람 말로: 126 → '10년 6개월' */
export function monthsLabel(months: number): string {
  if (months <= 0) return '0개월';
  const y = Math.floor(months / 12);
  const m = months % 12;
  if (y && m) return `${y}년 ${m}개월`;
  if (y) return `${y}년`;
  return `${m}개월`;
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

/** 금리 입력창: 숫자와 소수점 하나만 허용 ('3.5') */
export function formatRateInput(raw: string): string {
  const cleaned = raw.replace(/[^0-9.]/g, '');
  const parts = cleaned.split('.');
  if (parts.length <= 1) return cleaned;
  return `${parts[0]}.${parts.slice(1).join('')}`;
}

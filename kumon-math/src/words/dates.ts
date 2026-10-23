/**
 * 날짜 키 다루기.
 *
 * 앱 곳곳에서 날짜를 'YYYY-M-D'(todayKey) 또는 'YYYY-MM-DD' 문자열로 저장한다.
 * 여기 함수들은 두 모양을 모두 읽을 수 있고, 새로 만드는 키는 'YYYY-MM-DD' 로 쓴다.
 * 시간대 문제를 피하려고 날짜를 "1970-01-01 부터 며칠째" 숫자로 바꿔서 비교한다.
 */

/** 'YYYY-M-D' / 'YYYY-MM-DD' → 1970-01-01 부터 며칠째. 읽을 수 없으면 NaN */
export function dayNum(key: string): number {
  const [y, m, d] = (key ?? '').split('-').map(Number);
  if (!y || !m || !d) return NaN;
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
}

const pad = (n: number) => String(n).padStart(2, '0');

/** 며칠째 숫자 → 'YYYY-MM-DD' */
export function keyOfDayNum(n: number): string {
  const d = new Date(n * 86400000);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** 날짜 키에 n 일을 더한다 ('YYYY-MM-DD' 로 돌려준다) */
export function addDays(key: string, n: number): string {
  return keyOfDayNum(dayNum(key) + n);
}

/** b - a (며칠 차이). 둘 중 하나라도 읽을 수 없으면 NaN */
export function daysBetween(a: string, b: string): number {
  return dayNum(b) - dayNum(a);
}

/** 같은 날인지 (표기가 달라도 같은 날이면 true) */
export function sameDay(a: string, b: string): boolean {
  return dayNum(a) === dayNum(b);
}

/**
 * 월요일에 시작하는 주의 번호 (1970-01-01 은 목요일이라 3을 더한다).
 * 같은 주면 같은 번호가 나온다 — 주마다 한 번 주는 보상에 쓴다.
 */
export function weekIndex(key: string): number {
  return Math.floor((dayNum(key) + 3) / 7);
}

/** 기기 시간 기준 오늘 'YYYY-MM-DD' */
export function isoToday(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

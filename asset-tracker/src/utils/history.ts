import { DateKey, ValuePoint } from '../types';

/**
 * 자산 평가액 이력.
 *
 * 시트에서 '지금 얼마'를 고칠 때마다 한 줄씩 쌓인다. 전부 순수 함수.
 */

/** 이력은 이 개수까지만 — 매일 적어도 넉 달치, 매달 적으면 10년치 */
export const HISTORY_CAP = 120;

/**
 * 이력에 한 줄 더한다. 같은 날짜가 이미 있으면 그 줄을 바꾼다 (하루에 한 값).
 * 날짜 오름차순으로 돌려주고, HISTORY_CAP 을 넘으면 가장 오래된 것부터 버린다.
 */
export function appendHistory(
  history: ValuePoint[] | undefined, date: DateKey, value: number,
): ValuePoint[] {
  const rest = (history ?? []).filter(p => p.date !== date);
  const next = [...rest, { date, value }].sort((a, b) => a.date.localeCompare(b.date));
  return next.length > HISTORY_CAP ? next.slice(next.length - HISTORY_CAP) : next;
}

export interface ReturnSince {
  /** 기준이 된 줄 */
  from: ValuePoint;
  change: number;
  /** from.value 가 0 이면 null */
  ratio: number | null;
}

/**
 * fromDate 시점의 평가액 대비 지금 얼마나 올랐나.
 *
 * 기준 줄은 fromDate 당일 또는 **그 이전의 가장 최근 줄**이다 —
 * '한 달 전'에 딱 그 날 기록이 없어도 그때 알고 있던 값이 기준이 되는 게 맞다.
 * 그보다 앞선 줄이 하나도 없으면 null (그때는 아직 기록이 없었다).
 */
export function returnSince(
  history: ValuePoint[] | undefined, fromDate: DateKey, currentValue: number,
): ReturnSince | null {
  if (!history || history.length === 0) return null;
  let from: ValuePoint | null = null;
  for (const p of history) {
    if (p.date <= fromDate && (!from || p.date >= from.date)) from = p;
  }
  if (!from) return null;
  const change = currentValue - from.value;
  return { from, change, ratio: from.value !== 0 ? change / from.value : null };
}

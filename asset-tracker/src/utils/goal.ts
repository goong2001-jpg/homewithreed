import { Asset, AssetEquity, DateKey, Goal, GoalProgress } from '../types';
import { daysBetween, monthsBetween, todayKey } from './date';
import { alive } from './merge';
import { assetLiquidity } from './summary';

/**
 * 목표 계산.
 *
 * 핵심은 한 줄이다 — **실제 계약금 + 부대비용 − 예상대출 = 내가 현금으로 마련할 돈.**
 * 분양가만 보고 있으면 취득세·이사비를 빼먹어서 입주 직전에 돈이 모자란다.
 *
 * 다른 계산 모듈처럼 전부 순수 함수이고 '오늘'을 인자로 받는다.
 */

/** 이 목표에 쓸 수 있다고 보는 돈. 자산의 '내 몫'(대출 뺀 금액)으로 센다 */
export function readyAmount(
  goal: Goal,
  assets: Asset[],
  equityByAsset: Record<string, AssetEquity>,
): number {
  const live = alive(assets);
  const equity = (a: Asset) => equityByAsset[a.id]?.equity ?? a.value;

  if (goal.source === 'picked') {
    const picked = new Set(goal.assetIds);
    return live.filter(a => picked.has(a.id)).reduce((s, a) => s + equity(a), 0);
  }
  if (goal.source === 'all') {
    return live.reduce((s, a) => s + equity(a), 0);
  }
  // 'liquid' — 묶여 있는 자산은 빼고 실제로 굴릴 수 있는 것만
  return live
    .filter(a => assetLiquidity(a) !== '묶임')
    .reduce((s, a) => s + equity(a), 0);
}

export function goalProgress(
  goal: Goal,
  ready: number,
  today: DateKey = todayKey(),
): GoalProgress {
  // netPrice를 적었으면 그게 진짜 낼 돈이다 (옵션 제외 등)
  const price = Math.max(0, goal.netPrice ?? goal.totalPrice);
  const extra = Math.max(0, goal.extraCost);
  const totalNeeded = price + extra;
  const expectedLoan = Math.max(0, goal.expectedLoan);

  // 대출이 필요액보다 클 수는 없다 (그만큼은 안 빌린다)
  const cashNeeded = Math.max(0, totalNeeded - expectedLoan);

  const readyClamped = Math.max(0, ready);
  const shortfall = Math.max(0, cashNeeded - readyClamped);
  const rate = cashNeeded > 0 ? readyClamped / cashNeeded : 1;
  const done = !!goal.achievedAt || shortfall <= 0;

  const daysLeft = goal.targetDate ? daysBetween(today, goal.targetDate) : null;
  const monthsLeft = goal.targetDate ? monthsBetween(today, goal.targetDate) : null;

  const overdue = daysLeft !== null && daysLeft < 0 && shortfall > 0;

  // 목표일이 지났거나 오늘이면 '앞으로 매달 얼마'가 성립하지 않는다
  const perMonth = shortfall > 0 && monthsLeft !== null && monthsLeft > 0
    ? shortfall / monthsLeft
    : null;
  const perDay = shortfall > 0 && daysLeft !== null && daysLeft > 0
    ? shortfall / daysLeft
    : null;

  return {
    price,
    totalNeeded,
    expectedLoan,
    cashNeeded,
    ready: readyClamped,
    shortfall,
    rate,
    done,
    daysLeft,
    monthsLeft,
    perMonth,
    perDay,
    overdue,
  };
}

/** 화면이 쓰는 형태 — 목표 id로 바로 꺼내 쓴다 */
export function goalProgressAll(
  goals: Goal[],
  assets: Asset[],
  equityByAsset: Record<string, AssetEquity>,
  today: DateKey = todayKey(),
): Record<string, GoalProgress> {
  const out: Record<string, GoalProgress> = {};
  for (const g of alive(goals)) {
    out[g.id] = goalProgress(g, readyAmount(g, assets, equityByAsset), today);
  }
  return out;
}

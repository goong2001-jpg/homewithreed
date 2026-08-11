import {
  Asset, AssetKind, DateKey, ETC_KIND_ID, KindSlice, Loan, Recurring, Summary, Upcoming,
} from '../types';
import { daysBetween, todayKey } from './date';
import { loanStatus } from './loan';
import { alive } from './merge';

/**
 * 홈 화면이 쓰는 숫자를 한 번에 만든다.
 *
 * App.tsx의 useMemo 하나가 이 함수를 돌리고 결과를 자식에게 내려준다.
 * 자식 컴포넌트는 절대 다시 계산하지 않는다 (couple-budget과 같은 구조).
 */

export interface SummaryInput {
  kinds: AssetKind[];
  assets: Asset[];
  loans: Loan[];
  recurrings: Recurring[];
}

/** 홈에 띄울 만기 카드 개수 */
export const UPCOMING_LIMIT = 4;

const FALLBACK_KIND = { name: '기타', color: '#95a5a6', emoji: '📌' };

export function summarize(input: SummaryInput, today: DateKey = todayKey()): Summary {
  const kinds = alive(input.kinds).slice().sort((a, b) => a.order - b.order);
  const assets = alive(input.assets);
  const loans = alive(input.loans);
  const recurrings = alive(input.recurrings);

  const kindById = new Map(kinds.map(k => [k.id, k]));

  // ---------- 자산 ----------
  const totalAsset = assets.reduce((s, a) => s + a.value, 0);

  // 분류가 지워진 자산은 '기타'로 흘려보낸다 — 총합에서 조용히 빠지면 안 된다
  const bucket = new Map<string, { amount: number; count: number }>();
  for (const a of assets) {
    const key = kindById.has(a.kindId) ? a.kindId : ETC_KIND_ID;
    const cur = bucket.get(key) ?? { amount: 0, count: 0 };
    cur.amount += a.value;
    cur.count += 1;
    bucket.set(key, cur);
  }

  const byKind: KindSlice[] = Array.from(bucket.entries())
    .map(([kindId, v]) => {
      const k = kindById.get(kindId);
      return {
        kindId,
        name: k?.name ?? FALLBACK_KIND.name,
        color: k?.color ?? FALLBACK_KIND.color,
        emoji: k?.emoji ?? FALLBACK_KIND.emoji,
        amount: v.amount,
        ratio: totalAsset > 0 ? v.amount / totalAsset : 0,
        count: v.count,
      };
    })
    .sort((a, b) => b.amount - a.amount);

  // 원금을 적어둔 자산만 수익률에 넣는다.
  // 안 적은 자산까지 원금 0으로 세면 수익률이 터무니없이 부풀려진다.
  const priced = assets.filter(a => a.principal !== null && a.principal > 0);
  const totalPrincipal = priced.reduce((s, a) => s + (a.principal ?? 0), 0);
  const totalValueOfPriced = priced.reduce((s, a) => s + a.value, 0);
  const totalProfit = totalValueOfPriced - totalPrincipal;

  // ---------- 부채 ----------
  const statuses = loans.map(l => ({ loan: l, st: loanStatus(l, today) }));
  const totalDebt = statuses.reduce((s, x) => s + x.st.remainingPrincipal, 0);
  const monthlyLoanPayment = statuses.reduce((s, x) => s + x.st.monthlyPayment, 0);

  // ---------- 고정비 ----------
  const monthlyFixed = recurrings.reduce((s, r) => s + r.amount, 0);

  // ---------- 다가오는 만기 ----------
  const upcoming: Upcoming[] = [];

  for (const a of assets) {
    if (!a.maturity) continue;
    const dday = daysBetween(today, a.maturity);
    if (dday < 0) continue;                       // 이미 지난 건 띄우지 않는다
    const k = kindById.get(a.kindId);
    upcoming.push({
      id: `a:${a.id}`,
      label: a.name,
      date: a.maturity,
      dday,
      kind: '자산만기',
      amount: a.value,
      color: k?.color ?? FALLBACK_KIND.color,
    });
  }

  for (const { loan, st } of statuses) {
    if (st.done) continue;
    const dday = daysBetween(today, st.endDate);
    if (dday < 0) continue;
    upcoming.push({
      id: `l:${loan.id}`,
      label: loan.name,
      date: st.endDate,
      dday,
      kind: '대출만기',
      amount: st.remainingPrincipal,
      color: '#e74c3c',
    });
  }

  upcoming.sort((a, b) => a.dday - b.dday || a.label.localeCompare(b.label, 'ko'));

  return {
    totalAsset,
    totalDebt,
    netWorth: totalAsset - totalDebt,
    byKind,
    monthlyLoanPayment,
    monthlyFixed,
    monthlyOutflow: monthlyLoanPayment + monthlyFixed,
    totalPrincipal,
    totalValueOfPriced,
    totalProfit,
    profitRatio: totalPrincipal > 0 ? totalProfit / totalPrincipal : 0,
    upcoming,
  };
}

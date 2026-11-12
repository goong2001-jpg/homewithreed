import { computeMonthBudget, monthExpenses, recurringCandidates } from './budget';
import { GIFT_EXPENSE_PREFIX, giftsAsExpenses } from './gifts';
import { Expense, GiftEntry, Person } from '../types';

const NOW = new Date(2026, 10, 12, 21, 0, 0);
const PERSONS: Person[] = [
  { id: 'p1', name: '나', color: '#3498db', order: 0, createdAt: 0, updatedAt: 0 },
];

function gift(over: Partial<GiftEntry> = {}): GiftEntry {
  return {
    id: 'g1', date: '2026-11-07', month: '2026-11', direction: 'out', amount: 100000,
    kind: '축의금', counterparty: '김철수 결혼', personId: 'p1', memo: '',
    createdAt: 5, updatedAt: 9, ...over,
  };
}
const exp: Expense = {
  id: 'e1', date: '2026-11-03', month: '2026-11', amount: 8000, category: '식비',
  content: '점심', personId: 'p1', createdAt: 1, updatedAt: 1,
};

describe('giftsAsExpenses — 낸 경조사비는 쓴 돈이다', () => {
  it('낸 돈을 지출 줄로 바꾼다 (기타 · 종류와 상대 이름)', () => {
    expect(giftsAsExpenses([gift()])).toEqual([{
      id: `${GIFT_EXPENSE_PREFIX}g1`, giftId: 'g1', date: '2026-11-07', month: '2026-11',
      amount: 100000, category: '기타', content: '축의금 · 김철수 결혼', personId: 'p1',
      createdAt: 5, updatedAt: 9,
    }]);
  });

  it('받은 돈은 넣지 않는다 — 아이가 받은 용돈은 우리가 쓸 돈이 아니다', () => {
    expect(giftsAsExpenses([gift({ direction: 'in', kind: '용돈' })])).toEqual([]);
  });

  it('지운 기록·0원·깨진 금액은 넣지 않는다', () => {
    expect(giftsAsExpenses([gift({ deleted: true })])).toEqual([]);
    expect(giftsAsExpenses([gift({ amount: 0 })])).toEqual([]);
    expect(giftsAsExpenses([gift({ amount: NaN })])).toEqual([]);
  });

  it('달 필드가 없는 옛 기록은 날짜에서 달을 만든다', () => {
    const old = gift({ month: undefined as unknown as string });
    expect(giftsAsExpenses([old])[0].month).toBe('2026-11');
  });

  it('저금통의 이달 누적 지출·여유돈에 반영된다', () => {
    const base = { month: '2026-11', incomes: [], fixed: [], persons: PERSONS, now: NOW };
    const without = computeMonthBudget({ ...base, expenses: [exp] });
    const withGift = computeMonthBudget({ ...base, expenses: [exp, ...giftsAsExpenses([gift()])] });
    expect(without.variableSpent).toBe(8000);
    expect(withGift.variableSpent).toBe(108000);
    expect(withGift.freeCash).toBe(without.freeCash - 100000);
    expect(withGift.perPerson[0].expense).toBe(108000);
  });

  it('다른 달의 경조사는 이 달 지출이 아니다', () => {
    const rows = giftsAsExpenses([gift({ date: '2026-10-30', month: '2026-10' })]);
    expect(monthExpenses(rows, '2026-11')).toHaveLength(0);
    expect(monthExpenses(rows, '2026-10')).toHaveLength(1);
  });

  it('진짜 지출 id 와 겹치지 않는다', () => {
    expect(giftsAsExpenses([gift({ id: 'e1' })])[0].id).not.toBe('e1');
  });

  it('반복 지출 후보는 저장된 지출만 본다 (경조사 줄을 넘기지 않으면 후보가 안 생긴다)', () => {
    expect(recurringCandidates([exp], [], NOW)).toEqual([]);
  });
});

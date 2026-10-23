import {
  deltaLabel, diffLabel, isReportDay, reportAnchor, weekBounds, weekRangeLabel,
  weeklyReport, weeklyReportText,
} from './weekly';
import { Expense, ExpenseCategory, FixedExpense, IncomeEntry } from '../types';

// 2026-10-18 은 일요일, 10-19 는 월요일. 날짜는 전부 주입한다.
const SUNDAY = new Date(2026, 9, 18, 20, 0);
const MONDAY = new Date(2026, 9, 19, 8, 0);
const WEDNESDAY = new Date(2026, 9, 14, 12, 0);

const income = (month: string, amount: number): IncomeEntry =>
  ({ id: `i-${month}-${amount}`, month, personId: 'p1', amount, memo: '급여', createdAt: 0, updatedAt: 0 });

const fixedExp = (amount: number): FixedExpense =>
  ({ id: 'f', name: '월세', amount, startMonth: '2026-01', endMonth: null, personId: null, createdAt: 0, updatedAt: 0 });

const exp = (date: string, amount: number, category: ExpenseCategory = '식비', content = '메모', createdAt = 0): Expense =>
  ({
    id: `${date}-${category}-${content}-${amount}`, date, month: date.slice(0, 7),
    amount, category, content, personId: 'p1', createdAt, updatedAt: 0,
  });

// 이번 주(10/12 월 ~ 10/18 일) + 지난주(10/5 ~ 10/11) + 범위 밖
const EXPENSES: Expense[] = [
  exp('2026-10-12', 80_000, '생활', '마트 장보기'),
  exp('2026-10-13', 12_000, '식비', '점심'),
  exp('2026-10-15', 150_000, '쇼핑', '운동화'),
  exp('2026-10-17', 30_000, '식비', '외식'),
  exp('2026-10-18', 8_000, '교통', '택시'),
  exp('2026-10-18', 20_000, '식비', '배달'),
  // 지난주
  exp('2026-10-05', 100_000, '식비', '지난주1'),
  exp('2026-10-11', 100_000, '생활', '지난주2'),
  // 범위 밖 — 다다음주 / 2주 전
  exp('2026-10-19', 999_999, '기타', '다음주'),
  exp('2026-10-04', 999_999, '기타', '2주전'),
  // 툼스톤
  { ...exp('2026-10-14', 500_000, '기타', '지움'), deleted: true },
];

// 10월 31일, 310만 − 월세 100만 = 210만 → 하루 67,741.9…
const STATE = { incomes: [income('2026-10', 3_100_000)], fixed: [fixedExp(1_000_000)], expenses: EXPENSES };

describe('weekBounds — 월~일', () => {
  it('일요일이면 그 주 월요일부터 자기 자신까지', () => {
    expect(weekBounds(SUNDAY)).toEqual({ start: '2026-10-12', end: '2026-10-18' });
  });
  it('수요일이면 같은 주', () => {
    expect(weekBounds(WEDNESDAY)).toEqual({ start: '2026-10-12', end: '2026-10-18' });
  });
  it('월요일이면 그날부터 다음 일요일까지', () => {
    expect(weekBounds(MONDAY)).toEqual({ start: '2026-10-19', end: '2026-10-25' });
  });
  it('달을 넘어가는 주도 맞는다', () => {
    expect(weekBounds(new Date(2026, 10, 1))).toEqual({ start: '2026-10-26', end: '2026-11-01' });
  });
});

describe('리포트를 보여주는 날', () => {
  it('일요일과 월요일만', () => {
    expect(isReportDay(SUNDAY)).toBe(true);
    expect(isReportDay(MONDAY)).toBe(true);
    expect(isReportDay(WEDNESDAY)).toBe(false);
  });
  it('월요일에는 지난주(어제)를 가리킨다', () => {
    expect(weekBounds(reportAnchor(MONDAY))).toEqual({ start: '2026-10-12', end: '2026-10-18' });
    expect(weekBounds(reportAnchor(SUNDAY))).toEqual({ start: '2026-10-12', end: '2026-10-18' });
  });
});

describe('weeklyReport — 고정 데이터', () => {
  const r = weeklyReport(STATE, SUNDAY);

  it('이번 주 합계와 건수 (툼스톤·범위 밖 제외)', () => {
    expect(r.weekStart).toBe('2026-10-12');
    expect(r.weekEnd).toBe('2026-10-18');
    expect(r.totalSpent).toBe(300_000);
    expect(r.count).toBe(6);
  });

  it('하루 수입은 budget.ts 와 같은 식: (수입 − 고정지출) ÷ 일수', () => {
    expect(r.hasIncome).toBe(true);
    expect(r.dailyIncome).toBe(67_741);           // 2,100,000 ÷ 31 내림
    expect(r.weeklyBudget).toBe(474_187);         // × 7
    expect(r.diff).toBe(174_187);                 // − 300,000
  });

  it('많이 쓴 카테고리 3개, 금액 순', () => {
    expect(r.topCategories).toEqual([
      { category: '쇼핑', amount: 150_000 },
      { category: '생활', amount: 80_000 },
      { category: '식비', amount: 62_000 },
    ]);
  });

  it('큰 지출 3건, 금액 순', () => {
    expect(r.topExpenses.map(e => e.content)).toEqual(['운동화', '마트 장보기', '외식']);
  });

  it('지난주와 비교', () => {
    expect(r.prevTotal).toBe(200_000);
    expect(r.deltaRatio).toBeCloseTo(0.5);
  });

  it('지난주 지출이 0이면 비율은 null', () => {
    const only = { ...STATE, expenses: EXPENSES.filter(e => e.date >= '2026-10-12') };
    expect(weeklyReport(only, SUNDAY).deltaRatio).toBeNull();
  });

  it('수입이 없으면 예산 비교를 하지 않는다', () => {
    const none = weeklyReport({ ...STATE, incomes: [], fixed: [] }, SUNDAY);
    expect(none.hasIncome).toBe(false);
    expect(none.dailyIncome).toBe(0);
    expect(none.totalSpent).toBe(300_000);
    // 고정지출만 있으면 budget.ts 처럼 음수가 되지만, hasIncome 이 false 라 화면엔 안 나간다
    expect(weeklyReport({ ...STATE, incomes: [] }, SUNDAY).hasIncome).toBe(false);
  });

  it('지출이 하나도 없는 주', () => {
    const empty = weeklyReport({ ...STATE, expenses: [] }, SUNDAY);
    expect(empty.totalSpent).toBe(0);
    expect(empty.topCategories).toEqual([]);
    expect(empty.topExpenses).toEqual([]);
    expect(empty.deltaRatio).toBeNull();
  });
});

describe('문구', () => {
  it('기간 라벨', () => {
    expect(weekRangeLabel({ weekStart: '2026-10-12', weekEnd: '2026-10-18' })).toBe('10월 12일 ~ 10월 18일');
  });

  it('예산 대비', () => {
    expect(diffLabel({ diff: 12_345, hasIncome: true })).toBe('12,345원 남겼어요');
    expect(diffLabel({ diff: -50_000, hasIncome: true })).toBe('예산보다 50,000원 더 썼어요');
    expect(diffLabel({ diff: 0, hasIncome: false })).toContain('수입이 없어');
  });

  it('지난주 대비', () => {
    expect(deltaLabel({ deltaRatio: 0.5, prevTotal: 200_000, totalSpent: 300_000 })).toBe('지난주보다 50% 더 썼어요');
    expect(deltaLabel({ deltaRatio: -0.25, prevTotal: 400_000, totalSpent: 300_000 })).toBe('지난주보다 25% 덜 썼어요');
    expect(deltaLabel({ deltaRatio: 0.001, prevTotal: 1, totalSpent: 1 })).toBe('지난주와 비슷하게 썼어요');
    expect(deltaLabel({ deltaRatio: null, prevTotal: 0, totalSpent: 10 })).toBe('지난주엔 지출이 없었어요');
    expect(deltaLabel({ deltaRatio: null, prevTotal: 0, totalSpent: 0 })).toBe('지난주도 이번 주도 지출이 없어요');
  });
});

describe('weeklyReportText — 카톡 글자 요약', () => {
  it('숫자가 전부 들어간다', () => {
    const t = weeklyReportText(weeklyReport(STATE, SUNDAY));
    expect(t).toBe([
      '📊 주간 리포트 (10월 12일 ~ 10월 18일)',
      '이번 주 지출: 300,000원 (6건)',
      '쓸 수 있던 돈: 하루 67,741원 × 7일 = 474,187원',
      '→ 174,187원 남겼어요',
      '많이 쓴 곳: 쇼핑 15만원 · 생활 8만원 · 식비 6.2만원',
      '큰 지출:',
      '  10/15 운동화 150,000원',
      '  10/12 마트 장보기 80,000원',
      '  10/17 외식 30,000원',
      '지난주보다 50% 더 썼어요',
    ].join('\n'));
  });

  it('수입·지출이 없어도 깨지지 않는다', () => {
    const t = weeklyReportText(weeklyReport({ incomes: [], fixed: [], expenses: [] }, SUNDAY));
    expect(t).toContain('이번 주 지출: 0원 (0건)');
    expect(t).toContain('수입이 없어');
    expect(t).not.toContain('많이 쓴 곳');
    expect(t).not.toContain('큰 지출');
    expect(t).toContain('지난주도 이번 주도 지출이 없어요');
  });
});

import {
  computeMonthBudget, missingDays, monthExpenses, noSpendMarks, recurringCandidates,
  categoryTotals, topExpenses,
} from './budget';
import { weeklyReport } from './weekly';
import { DEVICE_KEY, defaultPersonId, loadDevice, saveDevice } from './device';
import { KEYS } from './storage';
import { Expense, FixedExpense, NO_SPEND_CONTENT, Person } from '../types';

// 2026-11-12 (목)
const NOW = new Date(2026, 10, 12, 21, 0, 0);

const PERSONS: Person[] = [
  { id: 'p1', name: '나', color: '#3498db', order: 0, createdAt: 0, updatedAt: 0 },
  { id: 'p2', name: '와이프', color: '#e8748f', order: 1, createdAt: 0, updatedAt: 0 },
];

let seq = 0;
function exp(date: string, amount: number, content = '점심', over: Partial<Expense> = {}): Expense {
  seq += 1;
  return {
    id: `e${seq}`, date, month: date.slice(0, 7), amount, category: '식비', content,
    personId: 'p1', createdAt: seq, updatedAt: seq, ...over,
  };
}
const mark = (date: string): Expense =>
  exp(date, 0, NO_SPEND_CONTENT, { category: '기타', noSpend: true });

describe("'안 썼어요' 표시 — 지출로 세지 않는다", () => {
  const rows = [exp('2026-11-03', 8000), mark('2026-11-04'), exp('2026-11-05', 5000)];

  it('그 달 지출 목록·건수·TOP 에 안 나온다', () => {
    expect(monthExpenses(rows, '2026-11')).toHaveLength(2);
    expect(noSpendMarks(rows, '2026-11').map(e => e.date)).toEqual(['2026-11-04']);
    expect(topExpenses(rows, '2026-11', 5)).toHaveLength(2);
    expect(categoryTotals(rows, '2026-11').find(c => c.category === '기타')).toBeUndefined();
  });

  it('저금통 숫자는 표시가 있든 없든 같다', () => {
    const base = { month: '2026-11', incomes: [], fixed: [], persons: PERSONS, now: NOW };
    const a = computeMonthBudget({ ...base, expenses: rows });
    const b = computeMonthBudget({ ...base, expenses: rows.filter(e => !e.noSpend) });
    expect(a.variableSpent).toBe(13000);
    expect(a).toEqual(b);
  });

  it('주간 리포트 건수에도 안 들어간다', () => {
    const r = weeklyReport({ incomes: [], fixed: [], expenses: rows }, new Date(2026, 10, 8));
    expect(r.count).toBe(2);
    expect(r.totalSpent).toBe(13000);
  });

  it('지운 표시(툼스톤)는 표시가 아니다', () => {
    expect(noSpendMarks([{ ...mark('2026-11-04'), deleted: true }], '2026-11')).toHaveLength(0);
  });
});

describe('missingDays — 입력이 빠진 날', () => {
  it('어제부터 거꾸로 연달아 빈 날만, 오래된 날부터 돌려준다', () => {
    const rows = [exp('2026-11-02', 1000), exp('2026-11-08', 1000)];
    expect(missingDays(rows, NOW)).toEqual(['2026-11-09', '2026-11-10', '2026-11-11']);
  });

  it('오늘은 세지 않는다 — 오늘만 안 적었으면 빈 날이 없다', () => {
    expect(missingDays([exp('2026-11-11', 1000)], NOW)).toEqual([]);
  });

  it('어제 적었으면 그 앞에 빈 날이 있어도 조용하다', () => {
    expect(missingDays([exp('2026-11-01', 1000), exp('2026-11-11', 1000)], NOW)).toEqual([]);
  });

  it("'안 썼어요' 표시가 있는 날은 적은 날이다", () => {
    const rows = [exp('2026-11-08', 1000), mark('2026-11-10'), mark('2026-11-11')];
    expect(missingDays(rows, NOW)).toEqual([]);
    expect(missingDays([exp('2026-11-08', 1000), mark('2026-11-10')], NOW)).toEqual(['2026-11-11']);
  });

  it('이번 달 1일보다 앞으로는 거슬러 가지 않는다', () => {
    const rows = [exp('2026-10-20', 1000)];
    expect(missingDays(rows, NOW)[0]).toBe('2026-11-01');
    expect(missingDays(rows, NOW)).toHaveLength(11);
  });

  it('매달 1일에는 빈 날이 없다 (어제는 지난달)', () => {
    expect(missingDays([exp('2026-10-20', 1000)], new Date(2026, 10, 1, 9))).toEqual([]);
  });

  it('기록이 하나도 없으면 다그치지 않는다', () => {
    expect(missingDays([], NOW)).toEqual([]);
    expect(missingDays([{ ...exp('2026-11-01', 1000), deleted: true }], NOW)).toEqual([]);
  });

  it('첫 기록을 남긴 날보다 앞은 세지 않는다', () => {
    expect(missingDays([exp('2026-11-10', 1000)], NOW)).toEqual(['2026-11-11']);
    expect(missingDays([exp('2026-11-12', 1000)], NOW)).toEqual([]);
  });
});

describe('recurringCandidates — 고정지출로 옮길 후보', () => {
  const netflix = [
    exp('2026-08-05', 17000, '넷플릭스', { category: '여가' }),
    exp('2026-09-05', 17000, '넷플릭스', { category: '여가' }),
    exp('2026-10-05', 17000, '넷플릭스', { category: '여가', personId: 'p2' }),
  ];

  it('지난달까지 석 달 연속 한 번씩이면 후보 — 다음 적용은 이번 달부터', () => {
    const [c] = recurringCandidates(netflix, [], NOW);
    expect(c).toMatchObject({
      content: '넷플릭스', amount: 17000, category: '여가', personId: 'p2',
      months: ['2026-08', '2026-09', '2026-10'], startMonth: '2026-11',
    });
  });

  it('이번 달 치를 이미 적었으면 다음 달부터 — 두 번 빠지지 않는다', () => {
    const rows = [...netflix, exp('2026-11-05', 17000, '넷플릭스', { category: '여가' })];
    const [c] = recurringCandidates(rows, [], NOW);
    expect(c.months).toEqual(['2026-09', '2026-10', '2026-11']);
    expect(c.startMonth).toBe('2026-12');
  });

  it('두 달만 나왔거나 중간이 비면 후보가 아니다', () => {
    expect(recurringCandidates(netflix.slice(1), [], NOW)).toEqual([]);
    expect(recurringCandidates([netflix[0], netflix[2]], [], NOW)).toEqual([]);
  });

  it('한 달에 두 번 이상 나오면 뺀다 (자주 사는 것)', () => {
    const rows = [...netflix, exp('2026-09-20', 17000, '넷플릭스', { category: '여가' })];
    expect(recurringCandidates(rows, [], NOW)).toEqual([]);
  });

  it('금액이 다르면 다른 지출이다', () => {
    const rows = [netflix[0], netflix[1], exp('2026-10-05', 17500, '넷플릭스')];
    expect(recurringCandidates(rows, [], NOW)).toEqual([]);
  });

  it('내용을 안 적은 지출(내용 = 카테고리)은 뺀다', () => {
    const rows = ['2026-08-01', '2026-09-01', '2026-10-01'].map(d => exp(d, 5000, '식비'));
    expect(recurringCandidates(rows, [], NOW)).toEqual([]);
  });

  it('같은 이름·금액의 고정지출이 이미 있으면 뺀다 (끝난 것은 예외)', () => {
    const fx = (endMonth: string | null): FixedExpense => ({
      id: 'f1', name: '넷플릭스', amount: 17000, startMonth: '2026-01', endMonth,
      personId: null, createdAt: 0, updatedAt: 0,
    });
    expect(recurringCandidates(netflix, [fx(null)], NOW)).toEqual([]);
    expect(recurringCandidates(netflix, [fx('2026-06')], NOW)).toHaveLength(1);
    expect(recurringCandidates(netflix, [{ ...fx(null), deleted: true }], NOW)).toHaveLength(1);
  });

  it("지운 지출·'안 썼어요' 표시는 세지 않는다", () => {
    const rows = [netflix[0], netflix[1], { ...netflix[2], deleted: true }];
    expect(recurringCandidates(rows, [], NOW)).toEqual([]);
  });

  it('금액 큰 순으로 limit 건', () => {
    const rent = ['2026-08-25', '2026-09-25', '2026-10-25'].map(d => exp(d, 300000, '주차비'));
    const out = recurringCandidates([...netflix, ...rent], [], NOW, 1);
    expect(out.map(c => c.content)).toEqual(['주차비']);
  });
});

describe('이 폰에만 두는 설정 (동기화 안 함)', () => {
  beforeEach(() => localStorage.clear());

  it('주인이 정해져 있으면 그 사람, 없거나 지워졌으면 첫 번째 사람', () => {
    expect(defaultPersonId(PERSONS, undefined)).toBe('p1');
    expect(defaultPersonId(PERSONS, 'p2')).toBe('p2');
    expect(defaultPersonId(PERSONS, 'gone')).toBe('p1');
    expect(defaultPersonId([{ id: 'b', order: 1 }, { id: 'a', order: 0 }], undefined)).toBe('a');
    expect(defaultPersonId([], undefined)).toBe('p1');
  });

  it('저장하면 다시 읽히고, 다른 값은 지워지지 않는다', () => {
    saveDevice({ ownerId: 'p2' });
    saveDevice({ dismissedRecurring: ['a'] });
    expect(loadDevice()).toEqual({ ownerId: 'p2', dismissedRecurring: ['a'] });
  });

  it('기존 저장 키와 겹치지 않고, 동기화·백업 대상 키 목록에도 없다', () => {
    expect(Object.values(KEYS)).not.toContain(DEVICE_KEY);
    saveDevice({ ownerId: 'p2' });
    expect(Object.keys(localStorage)).toEqual([DEVICE_KEY]);
  });

  it('깨진 값이 들어 있어도 죽지 않는다', () => {
    localStorage.setItem(DEVICE_KEY, '"oops"');
    expect(loadDevice()).toEqual({});
  });
});

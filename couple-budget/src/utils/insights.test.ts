import { computeMonthBudget } from './budget';
import { computeInsights } from './insights';
import { Expense, ExpenseCategory, FixedExpense, IncomeEntry, Person } from '../types';

// 2026-11-15 (일) — 11월은 30일, 딱 절반
const NOW = new Date(2026, 10, 15, 12, 0, 0);
const PERSONS: Person[] = [{ id: 'p1', name: '나', color: '#3498db', order: 0, createdAt: 0, updatedAt: 0 }];
const INCOME: IncomeEntry[] = [
  { id: 'i', month: '2026-11', personId: 'p1', amount: 3_000_000, memo: '급여', createdAt: 0, updatedAt: 0 },
];

let seq = 0;
function exp(
  date: string, amount: number, category: ExpenseCategory = '식비', content = '장보기',
  over: Partial<Expense> = {},
): Expense {
  seq += 1;
  return {
    id: `e${seq}`, date, month: date.slice(0, 7), amount, category, content,
    personId: 'p1', createdAt: seq, updatedAt: seq, ...over,
  };
}
function fx(name: string, amount: number): FixedExpense {
  return { id: `f-${name}`, name, amount, startMonth: '2026-01', endMonth: null, personId: null, createdAt: 0, updatedAt: 0 };
}
function run(expenses: Expense[], fixed: FixedExpense[] = [], month = '2026-11', incomes = INCOME) {
  const budget = computeMonthBudget({ month, incomes, fixed, expenses, persons: PERSONS, now: NOW });
  return computeInsights({ budget, expenses, fixed });
}
const kind = (list: ReturnType<typeof run>, k: string) => list.filter(i => i.kind === k);

describe('① 이 속도면 월말에', () => {
  it('지금 속도로 모자라면 얼마 모자라는지와 남은 날 하루 한도를 알려준다', () => {
    // 15일 동안 180만 → 하루 12만 → 30일이면 360만, 쓸 돈 300만 → 60만 모자람
    const [p] = kind(run([exp('2026-11-10', 1_800_000)]), 'pace');
    expect(p.tone).toBe('warn');
    expect(p.title).toBe('지금처럼 쓰면 월말에 60만원쯤 모자라요');
    // 남은 예산 120만 ÷ 남은 15일 = 8만
    expect(p.detail).toContain('남은 15일 동안 하루 8만원 안으로');
    expect(p.detail).toContain('하루 평균 12만원');
  });

  it('남을 것 같으면 좋은 소식으로', () => {
    // 15일 동안 90만 → 30일이면 180만 → 120만 남음
    const [p] = kind(run([exp('2026-11-10', 900_000)]), 'pace');
    expect(p).toMatchObject({ tone: 'good', title: '지금처럼 쓰면 월말에 120만원쯤 남아요' });
  });

  it('이미 넘었으면 넘은 금액을 말한다', () => {
    const [p] = kind(run([exp('2026-11-10', 3_200_000)]), 'pace');
    expect(p).toMatchObject({ tone: 'warn', title: '이번 달 쓸 돈을 이미 20만원 넘었어요' });
  });

  it('월초(3일 전)·지출 0원·수입 없음·지난달에는 말하지 않는다', () => {
    const early = computeMonthBudget({
      month: '2026-11', incomes: INCOME, fixed: [], expenses: [exp('2026-11-01', 500_000)],
      persons: PERSONS, now: new Date(2026, 10, 2, 9),
    });
    expect(computeInsights({ budget: early, expenses: [], fixed: [] }).some(i => i.kind === 'pace')).toBe(false);
    expect(kind(run([]), 'pace')).toEqual([]);
    expect(kind(run([exp('2026-11-10', 1000)], [], '2026-11', []), 'pace')).toEqual([]);
    expect(kind(run([exp('2026-10-10', 1000)], [], '2026-10'), 'pace')).toEqual([]);
  });
});

describe('② 평소보다 많이 쓴 카테고리', () => {
  const history = [
    exp('2026-08-05', 200_000), exp('2026-08-25', 300_000),   // 15일까지 20만
    exp('2026-09-05', 200_000),
    exp('2026-10-05', 200_000),
  ];

  it('지난 석 달 "이맘때까지" 평균보다 많으면 알려준다 — 16일 이후 지출은 견주지 않는다', () => {
    const [c] = kind(run([...history, exp('2026-11-05', 350_000)]), 'category');
    expect(c.title).toBe('식비가 평소보다 15만원 많아요');
    expect(c.detail).toBe('지난 3달은 이맘때까지 평균 20만원, 이번 달은 35만원.');
  });

  it('조금 넘은 건 말하지 않는다 (20% · 2만원 미만)', () => {
    expect(kind(run([...history, exp('2026-11-05', 215_000)]), 'category')).toEqual([]);
    expect(kind(run([...history, exp('2026-11-05', 200_000)]), 'category')).toEqual([]);
  });

  it('많이 넘은 순으로 2개까지', () => {
    const rows = [
      ...history,
      exp('2026-09-06', 50_000, '교통', '주유'), exp('2026-10-06', 50_000, '교통', '주유'),
      exp('2026-09-07', 50_000, '쇼핑', '옷'), exp('2026-10-07', 50_000, '쇼핑', '옷'),
      exp('2026-11-05', 300_000), exp('2026-11-06', 400_000, '교통', '주유'), exp('2026-11-07', 150_000, '쇼핑', '옷'),
    ];
    expect(kind(run(rows), 'category').map(i => i.key)).toEqual(['category-교통', 'category-쇼핑']);
  });

  it('전에 없던 카테고리는 "거의 없던 지출"로', () => {
    const [c] = kind(run([...history, exp('2026-11-05', 200_000), exp('2026-11-06', 90_000, '의료', '병원')]), 'category');
    expect(c.key).toBe('category-의료');
    expect(c.detail).toContain('거의 없던 지출');
  });

  it('견줄 달이 두 달이 안 되면 틀린 말을 하지 않고 한 줄로 알린다', () => {
    const list = run([exp('2026-10-05', 100_000), exp('2026-11-05', 900_000)]);
    expect(kind(list, 'category')).toEqual([]);
    expect(kind(list, 'needHistory')).toHaveLength(1);
    // 이번 달 기록도 없으면 그 한 줄도 없다
    expect(kind(run([exp('2026-10-05', 100_000)]), 'needHistory')).toEqual([]);
  });

  it('끝난 달은 그 달 전체와 견준다', () => {
    const rows = [
      exp('2026-07-28', 100_000), exp('2026-08-28', 100_000), exp('2026-09-28', 100_000),
      exp('2026-10-28', 300_000),
    ];
    const [c] = kind(run(rows, [], '2026-10', []), 'category');
    expect(c.detail).toBe('지난 3달은 평균 10만원, 이번 달은 30만원.');
  });

  it("지운 지출·'안 쓴 날' 표시는 세지 않는다", () => {
    const rows = [...history, { ...exp('2026-11-05', 900_000), deleted: true }, exp('2026-11-06', 0, '기타', '안 쓴 날', { noSpend: true })];
    expect(kind(run(rows), 'category')).toEqual([]);
  });
});

describe('③ 자잘하게 자주 쓴 것', () => {
  it('같은 내용으로 5번 넘게 쓰면 합쳐서 얼마인지', () => {
    const rows = [1, 2, 3, 4, 5, 6].map(d => exp(`2026-11-0${d}`, 4_500, '식비', '커피'));
    const [s] = kind(run(rows), 'small');
    expect(s.title).toBe('"커피"에 6번, 합쳐서 2.7만원');
    expect(s.detail).toContain('한 번은 평균 4,500원');
  });

  it('내용을 안 적었어도 한 카테고리에서 1만원 이하가 10번 넘으면', () => {
    const rows = Array.from({ length: 10 }, (_, i) => exp(`2026-11-${String(i + 1).padStart(2, '0')}`, 3_000, '교통', '교통'));
    expect(kind(run(rows), 'small')[0].title).toBe('교통에서 1만원 이하로 10번, 합쳐서 3만원');
  });

  it('4번은 말하지 않고, 낸 경조사비는 세지 않는다', () => {
    const four = [1, 2, 3, 4].map(d => exp(`2026-11-0${d}`, 4_500, '식비', '커피'));
    expect(kind(run(four), 'small')).toEqual([]);
    const gifts = [1, 2, 3, 4, 5, 6].map(d => exp(`2026-11-0${d}`, 50_000, '기타', '축의금 · 김철수', { giftId: `g${d}` }));
    expect(kind(run(gifts), 'small')).toEqual([]);
  });
});

describe('④ 고정지출 비중', () => {
  it('수입에서 차지하는 비율과 큰 것 세 개', () => {
    const fixed = [fx('통신비', 150_000), fx('월세', 800_000), fx('보험', 200_000), fx('구독', 17_000)];
    const [f] = kind(run([], fixed), 'fixed');
    expect(f.tone).toBe('info');
    expect(f.title).toBe('고정지출이 수입의 39%예요');
    expect(f.detail).toContain('큰 순서: 월세 80만원, 보험 20만원, 통신비 15만원.');
    expect(f.detail).not.toContain('구독');
    expect(f.detail).toContain('1만원을 줄이면 하루 쓸 돈이 333원쯤 늘어요');
  });

  it('절반을 넘으면 살펴볼 것으로 올리고 맨 위에 둔다', () => {
    const list = run([exp('2026-11-10', 100_000)], [fx('월세', 1_600_000)]);
    const f = kind(list, 'fixed')[0];
    expect(f.tone).toBe('warn');
    expect(f.detail).toContain('절반을 넘어요');
    expect(list[0].kind).toBe('fixed');      // 좋은 소식(pace good)보다 위
  });

  it('고정지출이 없거나 수입이 없으면 말하지 않는다', () => {
    expect(kind(run([]), 'fixed')).toEqual([]);
    expect(kind(run([], [fx('월세', 800_000)], '2026-11', []), 'fixed')).toEqual([]);
  });
});

describe('전체', () => {
  it('기록이 하나도 없으면 아무것도 없다', () => {
    expect(run([], [], '2026-11', [])).toEqual([]);
  });

  it('오지 않은 달에는 고정지출 비중만', () => {
    const incomes = [{ ...INCOME[0], month: '2026-12' }];
    const list = run([], [fx('월세', 800_000)], '2026-12', incomes);
    expect(list.map(i => i.kind)).toEqual(['fixed']);
  });
});

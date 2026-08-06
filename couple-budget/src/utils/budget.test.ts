import {
  addMonths, computeMonthBudget, dailyBudgetOf, daysInMonth, elapsedDays,
  categoryTotals, isFixedActive, monthPhase, todayKey,
} from './budget';
import { Expense, FixedExpense, IncomeEntry, Person } from '../types';

// 모든 테스트는 날짜를 명시적으로 주입한다 — 시스템 시계에 의존하면 안 된다.
const NOW = new Date(2026, 6, 10, 15, 0, 0);   // 2026-07-10 (7월은 31일)

const PERSONS: Person[] = [
  { id: 'p1', name: '나', color: '#3498db', order: 0, createdAt: 0, updatedAt: 0 },
  { id: 'p2', name: '와이프', color: '#e8748f', order: 1, createdAt: 0, updatedAt: 0 },
];

function income(month: string, amount: number, personId = 'p1'): IncomeEntry {
  return { id: `i-${month}-${personId}-${amount}`, month, personId, amount, memo: '급여', createdAt: 0, updatedAt: 0 };
}

function fixedExp(name: string, amount: number, startMonth: string, endMonth: string | null = null): FixedExpense {
  return { id: `f-${name}`, name, amount, startMonth, endMonth, personId: null, createdAt: 0, updatedAt: 0 };
}

function expense(date: string, amount: number, personId = 'p1'): Expense {
  return {
    id: `e-${date}-${amount}-${personId}`, date, month: date.slice(0, 7), amount,
    category: '식비', content: '테스트', personId, createdAt: 0, updatedAt: 0,
  };
}

function build(over: Partial<Parameters<typeof computeMonthBudget>[0]> = {}) {
  return computeMonthBudget({
    month: '2026-07', incomes: [], fixed: [], expenses: [], persons: PERSONS, now: NOW, ...over,
  });
}

describe('daysInMonth — 달력 기준 일수', () => {
  it('30일 달과 31일 달을 구분한다', () => {
    expect(daysInMonth('2026-06')).toBe(30);
    expect(daysInMonth('2026-07')).toBe(31);
    expect(daysInMonth('2026-09')).toBe(30);
    expect(daysInMonth('2026-12')).toBe(31);
  });

  it('윤년 2월을 처리한다', () => {
    expect(daysInMonth('2026-02')).toBe(28);
    expect(daysInMonth('2028-02')).toBe(29);
  });

  it('값이 깨졌으면 30으로 방어한다', () => {
    expect(daysInMonth('쓰레기')).toBe(30);
    expect(daysInMonth('2026-13')).toBe(30);
  });
});

describe('todayKey — 시간대 버그 방지', () => {
  it('새벽 시간에도 로컬 날짜를 준다 (UTC로 밀리지 않는다)', () => {
    // KST 새벽 2시는 UTC로는 전날 17시다. toISOString()을 쓰면 어제가 나온다.
    expect(todayKey(new Date(2026, 6, 10, 2, 30))).toBe('2026-07-10');
    expect(todayKey(new Date(2026, 0, 1, 0, 5))).toBe('2026-01-01');
  });
});

describe('하루 수입 — 사용자가 든 예시', () => {
  it('320만원 / 7월(31일) = 하루 103,225원', () => {
    const b = build({ incomes: [income('2026-07', 3_200_000)] });
    expect(b.daysInMonth).toBe(31);
    expect(Math.floor(b.dailyBudget)).toBe(103_225);
  });

  it('같은 320만원이 6월(30일)에는 하루 106,666원', () => {
    const b = build({ month: '2026-06', incomes: [income('2026-06', 3_200_000)] });
    expect(b.daysInMonth).toBe(30);
    expect(Math.floor(b.dailyBudget)).toBe(106_666);
  });

  it('부부 두 사람의 수입을 합산한다', () => {
    const b = build({
      incomes: [income('2026-07', 3_200_000, 'p1'), income('2026-07', 2_000_000, 'p2')],
    });
    expect(b.totalIncome).toBe(5_200_000);
    expect(b.perPerson.find(p => p.personId === 'p2')!.income).toBe(2_000_000);
  });

  it('다른 달의 수입은 섞이지 않는다', () => {
    const b = build({ incomes: [income('2026-06', 9_000_000), income('2026-07', 3_200_000)] });
    expect(b.totalIncome).toBe(3_200_000);
  });
});

describe('고정지출 차감', () => {
  it('하루수입을 나누기 전에 먼저 빠진다', () => {
    const b = build({
      incomes: [income('2026-07', 3_200_000)],
      fixed: [fixedExp('월세', 1_000_000, '2026-01')],
    });
    expect(b.totalFixed).toBe(1_000_000);
    expect(b.spendable).toBe(2_200_000);
    expect(Math.floor(b.dailyBudget)).toBe(70_967);   // 2,200,000 / 31
  });

  it('매달 반복된다 (시작월 이후 모든 달)', () => {
    const rent = fixedExp('월세', 1_000_000, '2026-01');
    expect(isFixedActive(rent, '2026-01')).toBe(true);
    expect(isFixedActive(rent, '2026-07')).toBe(true);
    expect(isFixedActive(rent, '2030-12')).toBe(true);
    expect(isFixedActive(rent, '2025-12')).toBe(false);   // 시작 전
  });

  it('종료월까지만 계상한다 (종료월 포함)', () => {
    const phone = fixedExp('통신비', 50_000, '2026-01', '2026-07');
    expect(isFixedActive(phone, '2026-07')).toBe(true);
    expect(isFixedActive(phone, '2026-08')).toBe(false);
  });

  it('삭제된 고정지출은 무시한다', () => {
    const gone = { ...fixedExp('해지', 50_000, '2026-01'), deleted: true };
    expect(isFixedActive(gone, '2026-07')).toBe(false);
  });

  it('고정지출이 수입보다 많으면 경고 플래그를 세운다', () => {
    const b = build({
      incomes: [income('2026-07', 1_000_000)],
      fixed: [fixedExp('월세', 1_500_000, '2026-01')],
    });
    expect(b.fixedOverIncome).toBe(true);
    expect(b.spendable).toBe(-500_000);
    expect(b.dailyBudget).toBeLessThan(0);
    expect(b.fillRatio).toBe(0);        // 0으로 잘려서 NaN이 새지 않는다
    expect(b.paceRatio).toBe(0);
  });
});

describe('누적 방식 잔액', () => {
  const incomes = [income('2026-07', 3_100_000)];   // 3,100,000 / 31 = 하루 정확히 100,000원

  it('경과일수 × 하루수입이 지금까지 들어온 돈', () => {
    const b = build({ incomes });
    expect(b.dailyBudget).toBe(100_000);
    expect(b.elapsedDays).toBe(10);            // 7월 10일
    expect(b.accrued).toBe(1_000_000);
  });

  it('아껴 쓰면 여유돈이 남는다', () => {
    const b = build({ incomes, expenses: [expense('2026-07-05', 400_000)] });
    expect(b.variableSpent).toBe(400_000);
    expect(b.freeCash).toBe(600_000);          // 1,000,000 - 400,000
    expect(b.level).toBe('여유');
    expect(b.overspend).toBe(0);
  });

  it('많이 쓰면 마이너스가 된다', () => {
    const b = build({ incomes, expenses: [expense('2026-07-05', 1_500_000)] });
    expect(b.freeCash).toBe(-500_000);
    expect(b.overspend).toBe(500_000);
    expect(b.level).toBe('초과');
  });

  it('여유돈이 하루치보다 적으면 주의 단계', () => {
    const b = build({ incomes, expenses: [expense('2026-07-05', 950_000)] });
    expect(b.freeCash).toBe(50_000);           // 하루치 100,000 미만
    expect(b.level).toBe('주의');
  });

  it('오늘 쓴 돈을 따로 집계한다', () => {
    const b = build({
      incomes,
      expenses: [expense('2026-07-10', 30_000), expense('2026-07-09', 70_000)],
    });
    expect(b.spentToday).toBe(30_000);
    expect(b.variableSpent).toBe(100_000);
  });

  it('삭제된 지출은 빠진다', () => {
    const b = build({
      incomes,
      expenses: [expense('2026-07-05', 400_000), { ...expense('2026-07-06', 999_999), deleted: true }],
    });
    expect(b.variableSpent).toBe(400_000);
  });
});

describe('저금통 채움 비율과 목표선', () => {
  const incomes = [income('2026-07', 3_100_000)];   // 하루 100,000원

  it('한 푼도 안 썼으면 가득 찬다', () => {
    expect(build({ incomes }).fillRatio).toBe(1);
  });

  it('쓴 만큼 줄어든다', () => {
    const b = build({ incomes, expenses: [expense('2026-07-05', 1_550_000)] });
    expect(b.fillRatio).toBeCloseTo(0.5, 5);   // 절반 씀
  });

  it('예산을 다 쓰면 0이 되고 그 아래로는 안 내려간다', () => {
    const b = build({ incomes, expenses: [expense('2026-07-05', 5_000_000)] });
    expect(b.fillRatio).toBe(0);
    expect(b.remainingBudget).toBe(-1_900_000);
  });

  it('목표선은 경과일수만큼 내려와 있다', () => {
    // 7월 10일 = 31일 중 10일 경과 → 목표선은 21/31 높이
    expect(build({ incomes }).paceRatio).toBeCloseTo(21 / 31, 5);
  });

  it('예산대로 딱 맞게 쓰면 채움과 목표선이 일치한다', () => {
    const b = build({ incomes, expenses: [expense('2026-07-05', 1_000_000)] });
    expect(b.fillRatio).toBeCloseTo(b.paceRatio, 5);
    expect(b.freeCash).toBe(0);
    expect(b.level).toBe('주의');   // 여유돈 0 < 하루치
  });
});

describe('수입 미입력', () => {
  it('0으로 나누지 않고 안내용 상태를 만든다', () => {
    const b = build();
    expect(b.hasIncome).toBe(false);
    expect(b.level).toBe('noIncome');
    expect(b.dailyBudget).toBe(0);
    expect(b.fillRatio).toBe(0);
    expect(Number.isNaN(b.fillRatio)).toBe(false);
    expect(Number.isNaN(b.freeCash)).toBe(false);
  });

  it('수입이 없는데 지출만 있어도 NaN이 안 생긴다', () => {
    const b = build({ expenses: [expense('2026-07-05', 50_000)] });
    expect(b.freeCash).toBe(-50_000);
    expect(b.fillRatio).toBe(0);
  });
});

describe('월 단계 (지난달 / 이번달 / 다음달)', () => {
  it('단계를 구분한다', () => {
    expect(monthPhase('2026-06', NOW)).toBe('past');
    expect(monthPhase('2026-07', NOW)).toBe('current');
    expect(monthPhase('2026-08', NOW)).toBe('future');
  });

  it('이번 달 경과일수는 오늘 날짜다 (1일에도 1일치)', () => {
    expect(elapsedDays('2026-07', NOW)).toBe(10);
    expect(elapsedDays('2026-07', new Date(2026, 6, 1))).toBe(1);
    expect(elapsedDays('2026-07', new Date(2026, 6, 31))).toBe(31);
  });

  it('지난 달은 전체 일수가 경과한 것으로 본다', () => {
    expect(elapsedDays('2026-06', NOW)).toBe(30);
    const b = build({ month: '2026-06', incomes: [income('2026-06', 3_000_000)] });
    expect(b.accrued).toBe(3_000_000);      // 전액 발생
    expect(b.freeCash).toBe(3_000_000);     // 지출이 없으니 전액이 흑자
  });

  it('지난 달에는 주의 단계가 없다', () => {
    const b = build({
      month: '2026-06',
      incomes: [income('2026-06', 3_000_000)],
      expenses: [expense('2026-06-15', 2_999_999)],
    });
    expect(b.freeCash).toBe(1);
    expect(b.level).toBe('여유');   // 흑자로 끝났으면 여유
  });

  it('다음 달은 경과일수 0이고 저금통이 가득이다', () => {
    const b = build({ month: '2026-08', incomes: [income('2026-08', 3_100_000)] });
    expect(b.elapsedDays).toBe(0);
    expect(b.accrued).toBe(0);
    expect(b.freeCash).toBe(0);
    expect(b.fillRatio).toBe(1);        // 아직 안 쓴 다음 달 예산
    expect(b.paceRatio).toBe(1);
    expect(b.spentToday).toBe(0);
    expect(b.remainingDays).toBe(31);
  });
});

describe('사람별 집계', () => {
  it('수입과 지출을 사람별로 나눈다', () => {
    const b = build({
      incomes: [income('2026-07', 3_000_000, 'p1'), income('2026-07', 2_000_000, 'p2')],
      expenses: [expense('2026-07-05', 300_000, 'p1'), expense('2026-07-06', 100_000, 'p2')],
    });
    const me = b.perPerson.find(p => p.personId === 'p1')!;
    const wife = b.perPerson.find(p => p.personId === 'p2')!;
    expect(me.income).toBe(3_000_000);
    expect(me.expense).toBe(300_000);
    expect(me.ratio).toBeCloseTo(0.75, 5);
    expect(wife.expense).toBe(100_000);
    expect(wife.ratio).toBeCloseTo(0.25, 5);
  });

  it('지출이 없으면 비율이 0이다 (0으로 나누지 않는다)', () => {
    const b = build({ incomes: [income('2026-07', 3_000_000)] });
    expect(b.perPerson.every(p => p.ratio === 0)).toBe(true);
  });

  it('order 순서대로 정렬한다', () => {
    const b = build({ persons: [PERSONS[1], PERSONS[0]] });
    expect(b.perPerson.map(p => p.personId)).toEqual(['p1', 'p2']);
  });
});

describe('손상된 데이터 방어', () => {
  it('금액이 숫자가 아니어도 NaN을 만들지 않는다', () => {
    const junk = { ...expense('2026-07-05', 0), amount: 'abc' as unknown as number };
    const b = build({ incomes: [income('2026-07', 3_100_000)], expenses: [junk] });
    expect(b.variableSpent).toBe(0);
    expect(Number.isNaN(b.freeCash)).toBe(false);
  });
});

describe('addMonths', () => {
  it('연도를 넘어간다', () => {
    expect(addMonths('2026-07', 1)).toBe('2026-08');
    expect(addMonths('2026-12', 1)).toBe('2027-01');
    expect(addMonths('2026-01', -1)).toBe('2025-12');
    expect(addMonths('2026-07', -7)).toBe('2025-12');
  });
});

describe('dailyBudgetOf', () => {
  it('일수로 나눈다', () => {
    expect(dailyBudgetOf(3_100_000, '2026-07')).toBe(100_000);
    expect(dailyBudgetOf(0, '2026-07')).toBe(0);
  });
});

describe('카테고리별 지출 집계', () => {
  const catExp = (id: string, amount: number, category: Expense['category'], personId = 'p1'): Expense => ({
    id, date: '2026-07-05', month: '2026-07', amount, category,
    content: '테스트', personId, createdAt: 0, updatedAt: 0,
  });

  const rows: Expense[] = [
    catExp('1', 50_000, '식비', 'p1'),
    catExp('2', 30_000, '식비', 'p2'),
    catExp('3', 100_000, '쇼핑', 'p1'),
    catExp('4', 20_000, '교통', 'p2'),
  ];

  it('금액이 큰 순서로 돌려준다', () => {
    const out = categoryTotals(rows, '2026-07');
    expect(out.map(c => c.category)).toEqual(['쇼핑', '식비', '교통']);
    expect(out[0].amount).toBe(100_000);
    expect(out[1].amount).toBe(80_000);   // 식비 두 건 합산
  });

  it('건수와 비율을 함께 준다', () => {
    const out = categoryTotals(rows, '2026-07');
    const food = out.find(c => c.category === '식비')!;
    expect(food.count).toBe(2);
    expect(food.ratio).toBeCloseTo(80_000 / 200_000, 5);
  });

  it('지출이 없는 카테고리는 빼고 준다', () => {
    const out = categoryTotals(rows, '2026-07');
    expect(out.find(c => c.category === '의료')).toBeUndefined();
  });

  it('사람을 지정하면 그 사람 것만 센다', () => {
    const out = categoryTotals(rows, '2026-07', 'p2');
    expect(out.map(c => c.category)).toEqual(['식비', '교통']);
    expect(out.find(c => c.category === '식비')!.amount).toBe(30_000);
    // 비율은 그 사람 안에서의 비율
    expect(out.find(c => c.category === '식비')!.ratio).toBeCloseTo(30_000 / 50_000, 5);
  });

  it('다른 달은 섞이지 않는다', () => {
    const other = { ...catExp('9', 999_999, '여가'), date: '2026-06-01', month: '2026-06' };
    expect(categoryTotals([...rows, other], '2026-07').find(c => c.category === '여가')).toBeUndefined();
  });

  it('삭제된 지출은 빠진다', () => {
    const gone = { ...catExp('5', 999_999, '의료'), deleted: true };
    expect(categoryTotals([...rows, gone], '2026-07').find(c => c.category === '의료')).toBeUndefined();
  });

  it('기록이 없으면 빈 배열', () => {
    expect(categoryTotals([], '2026-07')).toEqual([]);
    expect(categoryTotals(rows, '2026-07', '없는사람')).toEqual([]);
  });
});

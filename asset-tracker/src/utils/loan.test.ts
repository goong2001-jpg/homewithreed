import { Loan } from '../types';
import { buildSchedule, equalPayment, loanStatus } from './loan';

function makeLoan(over: Partial<Loan> = {}): Loan {
  return {
    id: 'l1',
    name: '테스트대출',
    principal: 240_000_000,
    rate: 3.5,
    method: '원리금균등',
    startDate: '2026-01-10',
    termMonths: 120,
    graceMonths: 0,
    linkedAssetId: null,
    memo: '',
    order: 0,
    createdAt: 0,
    updatedAt: 0,
    ...over,
  };
}

describe('equalPayment (원리금균등 월 상환액)', () => {
  it('2.4억 · 연 3.5% · 120개월이면 약 237만원', () => {
    const a = equalPayment(240_000_000, 0.035 / 12, 120);
    expect(a).toBeGreaterThan(2_370_000);
    expect(a).toBeLessThan(2_376_000);
  });

  it('무이자면 원금을 개월 수로 나눈 값이다 (0으로 나누지 않는다)', () => {
    expect(equalPayment(1_200_000, 0, 12)).toBe(100_000);
  });
});

describe('loanStatus - 원리금균등', () => {
  it('시작 직후엔 원금이 그대로 남아 있다', () => {
    const st = loanStatus(makeLoan(), '2026-01-10');
    expect(st.elapsedMonths).toBe(0);
    expect(st.remainingPrincipal).toBeCloseTo(240_000_000, 0);
    expect(st.paidPrincipal).toBeCloseTo(0, 0);
    expect(st.done).toBe(false);
  });

  it('첫 달 이자는 원금 × 월이율이고, 상환액에서 이자를 뺀 만큼이 원금이다', () => {
    const st = loanStatus(makeLoan(), '2026-01-10');
    expect(st.monthlyInterest).toBeCloseTo(240_000_000 * 0.035 / 12, 0);
    expect(st.monthlyPayment).toBeCloseTo(st.monthlyInterest + st.monthlyPrincipal, 6);
  });

  it('만기에는 남은 원금이 0이 된다', () => {
    const st = loanStatus(makeLoan(), '2036-01-10');
    expect(st.remainingPrincipal).toBeCloseTo(0, 0);
    expect(st.monthlyPayment).toBe(0);
    expect(st.done).toBe(true);
    expect(st.progress).toBe(1);
  });

  it('만기일은 시작일 + 총개월이다', () => {
    expect(loanStatus(makeLoan(), '2026-01-10').endDate).toBe('2036-01-10');
  });

  it('시간이 갈수록 원금은 줄고 이자 비중도 줄어든다', () => {
    const early = loanStatus(makeLoan(), '2027-01-10');
    const late = loanStatus(makeLoan(), '2033-01-10');
    expect(late.remainingPrincipal).toBeLessThan(early.remainingPrincipal);
    expect(late.monthlyInterest).toBeLessThan(early.monthlyInterest);
    // 원리금균등이니 매달 내는 총액은 같다
    expect(late.monthlyPayment).toBeCloseTo(early.monthlyPayment, 0);
  });

  it('총 이자는 (월상환액 × 개월수 − 원금) 이다', () => {
    const st = loanStatus(makeLoan(), '2026-01-10');
    expect(st.totalInterest).toBeCloseTo(st.monthlyPayment * 120 - 240_000_000, 0);
  });
});

describe('loanStatus - 거치기간', () => {
  const graced = makeLoan({ graceMonths: 24 });

  it('거치기간에는 이자만 내고 원금은 그대로다', () => {
    const st = loanStatus(graced, '2027-01-10');   // 12개월 경과
    expect(st.inGrace).toBe(true);
    expect(st.remainingPrincipal).toBe(240_000_000);
    expect(st.monthlyPrincipal).toBe(0);
    expect(st.monthlyPayment).toBeCloseTo(240_000_000 * 0.035 / 12, 0);  // 70만원
  });

  it('거치가 끝나면 원금이 줄기 시작한다', () => {
    const before = loanStatus(graced, '2028-01-10');   // 24개월 = 거치 마지막
    const after = loanStatus(graced, '2029-01-10');    // 36개월
    expect(before.remainingPrincipal).toBe(240_000_000);
    expect(after.remainingPrincipal).toBeLessThan(240_000_000);
    expect(after.inGrace).toBe(false);
  });

  it('거치기간이 있으면 총 이자가 더 많다', () => {
    const a = loanStatus(makeLoan(), '2026-01-10').totalInterest;
    const b = loanStatus(graced, '2026-01-10').totalInterest;
    expect(b).toBeGreaterThan(a);
  });

  it('거치기간이 총 기간보다 길어도 터지지 않는다', () => {
    const st = loanStatus(makeLoan({ graceMonths: 999 }), '2027-01-10');
    expect(Number.isFinite(st.monthlyPayment)).toBe(true);
    expect(st.remainingPrincipal).toBe(240_000_000);
  });
});

describe('loanStatus - 원금균등', () => {
  const loan = makeLoan({ method: '원금균등', principal: 120_000_000, termMonths: 120 });

  it('매달 갚는 원금은 항상 같다', () => {
    const a = loanStatus(loan, '2026-01-10');
    const b = loanStatus(loan, '2031-01-10');
    expect(a.monthlyPrincipal).toBeCloseTo(1_000_000, 6);
    expect(b.monthlyPrincipal).toBeCloseTo(1_000_000, 6);
  });

  it('내는 총액은 갈수록 줄어든다', () => {
    const a = loanStatus(loan, '2026-01-10');
    const b = loanStatus(loan, '2031-01-10');
    expect(b.monthlyPayment).toBeLessThan(a.monthlyPayment);
  });

  it('만기에 원금이 0이 된다', () => {
    expect(loanStatus(loan, '2036-01-10').remainingPrincipal).toBeCloseTo(0, 0);
  });
});

describe('loanStatus - 만기일시', () => {
  const loan = makeLoan({ method: '만기일시', principal: 100_000_000, rate: 4, termMonths: 24 });

  it('만기 전에는 이자만 내고 원금이 그대로다', () => {
    const st = loanStatus(loan, '2027-01-10');
    expect(st.remainingPrincipal).toBe(100_000_000);
    expect(st.monthlyPrincipal).toBe(0);
    expect(st.monthlyPayment).toBeCloseTo(100_000_000 * 0.04 / 12, 6);
    expect(st.progress).toBe(0);
    expect(st.timeProgress).toBeCloseTo(0.5, 6);
  });

  it('만기가 지나면 남은 원금이 0이다', () => {
    const st = loanStatus(loan, '2028-01-10');
    expect(st.remainingPrincipal).toBe(0);
    expect(st.done).toBe(true);
  });

  it('총 이자 = 원금 × 월이율 × 개월수', () => {
    const st = loanStatus(loan, '2026-01-10');
    expect(st.totalInterest).toBeCloseTo(100_000_000 * 0.04 / 12 * 24, 0);
  });

  it('거치기간을 넣어도 무시한다 (원래 원금을 안 갚는 방식이다)', () => {
    const st = loanStatus({ ...loan, graceMonths: 12 }, '2027-01-10');
    expect(st.inGrace).toBe(false);
    expect(st.remainingPrincipal).toBe(100_000_000);
  });
});

describe('loanStatus - 엉뚱한 값', () => {
  it('원금 0이면 전부 0이다', () => {
    const st = loanStatus(makeLoan({ principal: 0 }), '2027-01-10');
    expect(st.monthlyPayment).toBe(0);
    expect(st.remainingPrincipal).toBe(0);
  });

  it('기간 0이면 나누기 사고가 나지 않는다', () => {
    const st = loanStatus(makeLoan({ termMonths: 0 }), '2027-01-10');
    expect(Number.isFinite(st.monthlyPayment)).toBe(true);
    expect(Number.isFinite(st.remainingPrincipal)).toBe(true);
  });

  it('무이자 대출도 원금이 정상적으로 줄어든다', () => {
    const loan = makeLoan({ rate: 0, principal: 12_000_000, termMonths: 12 });
    const st = loanStatus(loan, '2026-07-10');   // 6개월 경과
    expect(st.monthlyInterest).toBe(0);
    expect(st.remainingPrincipal).toBeCloseTo(6_000_000, 0);
  });

  it('시작일 전에 조회해도 경과 개월이 음수가 되지 않는다', () => {
    const st = loanStatus(makeLoan(), '2025-06-01');
    expect(st.elapsedMonths).toBe(0);
    expect(st.remainingPrincipal).toBeCloseTo(240_000_000, 0);
  });
});

describe('buildSchedule', () => {
  it('회차 수가 총 개월 수와 같고 마지막 잔액이 정확히 0이다', () => {
    const rows = buildSchedule(makeLoan());
    expect(rows).toHaveLength(120);
    expect(rows[119].balance).toBe(0);
    expect(rows[119].date).toBe('2036-01-10');
  });

  it('갚은 원금을 다 더하면 대출 원금이 된다', () => {
    const rows = buildSchedule(makeLoan());
    const sum = rows.reduce((s, r) => s + r.principal, 0);
    expect(sum).toBeCloseTo(240_000_000, 0);
  });

  it('거치기간 회차에는 원금 상환이 없다', () => {
    const rows = buildSchedule(makeLoan({ graceMonths: 24 }));
    expect(rows.slice(0, 24).every(r => r.principal === 0)).toBe(true);
    expect(rows[24].principal).toBeGreaterThan(0);
  });

  it('만기일시는 마지막 회차에 원금을 한 번에 갚는다', () => {
    const rows = buildSchedule(makeLoan({ method: '만기일시', termMonths: 12 }));
    expect(rows.slice(0, 11).every(r => r.principal === 0)).toBe(true);
    expect(rows[11].principal).toBeCloseTo(240_000_000, 0);
    expect(rows[11].balance).toBe(0);
  });

  it('스케줄의 잔액과 loanStatus의 남은 원금이 일치한다', () => {
    const loan = makeLoan();
    const rows = buildSchedule(loan);
    // 12회차를 낸 시점 = 시작 후 12개월
    const st = loanStatus(loan, '2027-01-10');
    expect(st.remainingPrincipal).toBeCloseTo(rows[11].balance, 0);
  });
});

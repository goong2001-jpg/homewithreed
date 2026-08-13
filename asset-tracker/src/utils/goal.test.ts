import { Asset, AssetEquity, Goal } from '../types';
import { goalProgress, goalProgressAll, readyAmount } from './goal';

const TODAY = '2026-08-11';

/** 사용자 실제 목표: 진접2지구 A1블록 입주자금 */
function goal(over: Partial<Goal> = {}): Goal {
  return {
    id: 'g1',
    name: '진접2지구 A1블록 입주자금',
    totalPrice: 384_327_000,
    netPrice: 371_970_000,      // 옵션 제외
    extraCost: 0,
    expectedLoan: 263_790_000,
    targetDate: null,
    source: 'liquid',
    assetIds: [],
    achievedAt: null,
    memo: '',
    order: 0,
    createdAt: 0,
    updatedAt: 0,
    ...over,
  };
}

function asset(over: Partial<Asset> = {}): Asset {
  return {
    id: 'a1', kindId: 'k_cash', name: '통장',
    value: 10_000_000, principal: null, maturity: null, liquidity: null,
    memo: '', order: 0, createdAt: 0, updatedAt: 0,
    ...over,
  };
}

const noDebt = (assets: Asset[]): Record<string, AssetEquity> =>
  Object.fromEntries(assets.map(a => [a.id, { debt: 0, equity: a.value }]));

describe('goalProgress — 내가 현금으로 마련할 돈', () => {
  it('실제 계약금 − 예상대출이 필요 현금이다', () => {
    const p = goalProgress(goal(), 0, TODAY);
    expect(p.price).toBe(371_970_000);              // 옵션 제외 금액을 쓴다
    expect(p.cashNeeded).toBe(108_180_000);         // 371,970,000 − 263,790,000
    expect(p.shortfall).toBe(108_180_000);
    expect(p.rate).toBe(0);
  });

  it('netPrice를 안 적으면 총 분양가를 쓴다', () => {
    const p = goalProgress(goal({ netPrice: null }), 0, TODAY);
    expect(p.price).toBe(384_327_000);
    expect(p.cashNeeded).toBe(384_327_000 - 263_790_000);
  });

  it('부대비용은 필요 현금에 더해진다 (분양가엔 안 잡히는 돈)', () => {
    const p = goalProgress(goal({ extraCost: 15_000_000 }), 0, TODAY);
    expect(p.totalNeeded).toBe(371_970_000 + 15_000_000);
    expect(p.cashNeeded).toBe(123_180_000);
  });

  it('준비된 돈만큼 달성률이 오른다', () => {
    const p = goalProgress(goal(), 54_090_000, TODAY);   // 절반
    expect(p.rate).toBeCloseTo(0.5, 10);
    expect(p.shortfall).toBe(54_090_000);
    expect(p.done).toBe(false);
  });

  it('다 모으면 done', () => {
    const p = goalProgress(goal(), 108_180_000, TODAY);
    expect(p.shortfall).toBe(0);
    expect(p.rate).toBe(1);
    expect(p.done).toBe(true);
  });

  it('넘치면 달성률이 1을 넘고 모자란 돈은 0이다', () => {
    const p = goalProgress(goal(), 130_000_000, TODAY);
    expect(p.rate).toBeGreaterThan(1);
    expect(p.shortfall).toBe(0);
    expect(p.done).toBe(true);
  });

  it('달성 처리하면 아직 못 모았어도 done', () => {
    const p = goalProgress(goal({ achievedAt: TODAY }), 0, TODAY);
    expect(p.done).toBe(true);
  });

  it('대출이 필요액보다 커도 필요 현금이 음수가 되지 않는다', () => {
    const p = goalProgress(goal({ expectedLoan: 999_999_999 }), 0, TODAY);
    expect(p.cashNeeded).toBe(0);
    expect(p.rate).toBe(1);
    expect(p.done).toBe(true);
  });

  it('금액이 0이어도 나누기 사고가 없다', () => {
    const p = goalProgress(goal({ totalPrice: 0, netPrice: null, expectedLoan: 0 }), 0, TODAY);
    expect(Number.isFinite(p.rate)).toBe(true);
    expect(p.cashNeeded).toBe(0);
  });
});

describe('goalProgress — 매달 얼마씩 모아야 하나', () => {
  it('목표일이 없으면 계산하지 않는다', () => {
    const p = goalProgress(goal(), 0, TODAY);
    expect(p.perMonth).toBeNull();
    expect(p.perDay).toBeNull();
    expect(p.daysLeft).toBeNull();
  });

  it('남은 개월로 나눈다', () => {
    // 2028-08-11 = 24개월 뒤, 모자란 돈 108,180,000
    const p = goalProgress(goal({ targetDate: '2028-08-11' }), 0, TODAY);
    expect(p.monthsLeft).toBe(24);
    expect(p.perMonth).toBeCloseTo(108_180_000 / 24, 6);   // 약 450만원
  });

  it('이미 모은 만큼 빼고 계산한다', () => {
    const p = goalProgress(goal({ targetDate: '2028-08-11' }), 54_090_000, TODAY);
    expect(p.perMonth).toBeCloseTo(54_090_000 / 24, 6);
  });

  it('하루 단위도 낸다', () => {
    const p = goalProgress(goal({ targetDate: '2027-08-11' }), 0, TODAY);
    expect(p.daysLeft).toBe(365);
    expect(p.perDay).toBeCloseTo(108_180_000 / 365, 6);
  });

  it('다 모았으면 매달 모을 돈이 없다', () => {
    const p = goalProgress(goal({ targetDate: '2028-08-11' }), 108_180_000, TODAY);
    expect(p.perMonth).toBeNull();
    expect(p.overdue).toBe(false);
  });

  it('목표일이 지났는데 못 모았으면 overdue', () => {
    const p = goalProgress(goal({ targetDate: '2026-01-01' }), 0, TODAY);
    expect(p.overdue).toBe(true);
    expect(p.perMonth).toBeNull();      // 남은 기간이 없으니 계산 불가
    expect(p.daysLeft).toBeLessThan(0);
  });

  it('목표일이 오늘이면 매달 계산은 안 한다', () => {
    const p = goalProgress(goal({ targetDate: TODAY }), 0, TODAY);
    expect(p.daysLeft).toBe(0);
    expect(p.perMonth).toBeNull();
    expect(p.overdue).toBe(false);
  });
});

describe('readyAmount — 무엇을 준비된 돈으로 볼까', () => {
  const assets = [
    asset({ id: 'a_cash', kindId: 'k_cash', value: 3_000_000 }),          // 즉시
    asset({ id: 'a_stock', kindId: 'k_invest', value: 5_000_000 }),       // 며칠
    asset({ id: 'a_jeonse', kindId: 'k_jeonse', value: 90_000_000 }),     // 묶임
  ];
  const eq = noDebt(assets);

  it('liquid는 묶인 자산을 뺀다', () => {
    expect(readyAmount(goal({ source: 'liquid' }), assets, eq)).toBe(8_000_000);
  });

  it('all은 묶인 자산까지 센다 (전세금을 입주자금으로 쓸 때)', () => {
    expect(readyAmount(goal({ source: 'all' }), assets, eq)).toBe(98_000_000);
  });

  it('picked는 고른 것만 센다', () => {
    const g = goal({ source: 'picked', assetIds: ['a_cash', 'a_jeonse'] });
    expect(readyAmount(g, assets, eq)).toBe(93_000_000);
  });

  it('고른 게 없으면 0이다', () => {
    expect(readyAmount(goal({ source: 'picked', assetIds: [] }), assets, eq)).toBe(0);
  });

  it('평가액이 아니라 대출을 뺀 내 몫으로 센다', () => {
    const withDebt = { ...eq, a_jeonse: { debt: 66_000_000, equity: 24_000_000 } };
    expect(readyAmount(goal({ source: 'all' }), assets, withDebt)).toBe(32_000_000);
  });

  it('지운 자산은 안 센다', () => {
    const withDeleted = [...assets, asset({ id: 'a_x', kindId: 'k_cash', value: 99_000_000, deleted: true })];
    expect(readyAmount(goal({ source: 'liquid' }), withDeleted, noDebt(withDeleted))).toBe(8_000_000);
  });

  it('지운 자산을 골라놨어도 안 센다', () => {
    const withDeleted = [...assets, asset({ id: 'a_x', kindId: 'k_cash', value: 99_000_000, deleted: true })];
    const g = goal({ source: 'picked', assetIds: ['a_cash', 'a_x'] });
    expect(readyAmount(g, withDeleted, noDebt(withDeleted))).toBe(3_000_000);
  });
});

describe('goalProgressAll', () => {
  it('목표마다 계산해서 id로 꺼내 쓸 수 있다', () => {
    const assets = [asset({ id: 'a_cash', value: 50_000_000 })];
    const out = goalProgressAll(
      [goal(), goal({ id: 'g2', name: '차 바꾸기', totalPrice: 30_000_000, netPrice: null, expectedLoan: 0 })],
      assets, noDebt(assets), TODAY,
    );
    expect(Object.keys(out).sort()).toEqual(['g1', 'g2']);
    expect(out.g1.ready).toBe(50_000_000);
    expect(out.g2.cashNeeded).toBe(30_000_000);
  });

  it('지운 목표는 빠진다', () => {
    const out = goalProgressAll([goal({ deleted: true })], [], {}, TODAY);
    expect(out).toEqual({});
  });
});

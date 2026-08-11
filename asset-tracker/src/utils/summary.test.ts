import { Asset, DEFAULT_KINDS, Loan, Recurring } from '../types';
import { assetLiquidity, summarize } from './summary';

const TODAY = '2026-08-11';

function asset(over: Partial<Asset> = {}): Asset {
  return {
    id: 'a1', kindId: 'k_jeonse', name: '전세보증금',
    value: 300_000_000, principal: null, maturity: null, liquidity: null,
    memo: '', order: 0, createdAt: 0, updatedAt: 0,
    ...over,
  };
}

function loan(over: Partial<Loan> = {}): Loan {
  return {
    id: 'l1', name: '전세자금대출',
    principal: 240_000_000, rate: 3.5, method: '만기일시',
    startDate: '2026-01-10', termMonths: 24, graceMonths: 0,
    linkedAssetId: null, manualRemaining: null, manualPayment: null, manualAsOf: null,
    memo: '', order: 0, createdAt: 0, updatedAt: 0,
    ...over,
  };
}

function recurring(over: Partial<Recurring> = {}): Recurring {
  return {
    id: 'r1', name: '보험료', amount: 150_000, payDay: 25,
    memo: '', order: 0, createdAt: 0, updatedAt: 0,
    ...over,
  };
}

function base(over: Partial<Parameters<typeof summarize>[0]> = {}) {
  return { kinds: DEFAULT_KINDS, assets: [], loans: [], recurrings: [], ...over };
}

describe('순자산', () => {
  it('순자산 = 총자산 − 남은 대출 원금', () => {
    const s = summarize(base({ assets: [asset()], loans: [loan()] }), TODAY);
    expect(s.totalAsset).toBe(300_000_000);
    expect(s.totalDebt).toBe(240_000_000);      // 만기일시라 원금이 그대로 남아 있다
    expect(s.netWorth).toBe(60_000_000);
  });

  it('빚이 자산보다 많으면 순자산이 음수다', () => {
    const s = summarize(base({
      assets: [asset({ value: 10_000_000 })],
      loans: [loan({ principal: 50_000_000 })],
    }), TODAY);
    expect(s.netWorth).toBe(-40_000_000);
  });

  it('아무것도 없으면 전부 0이고 나누기 사고가 없다', () => {
    const s = summarize(base(), TODAY);
    expect(s.netWorth).toBe(0);
    expect(s.profitRatio).toBe(0);
    expect(s.byKind).toEqual([]);
    expect(s.upcoming).toEqual([]);
  });

  it('중도상환해서 직접 적은 남은 원금이 순자산에 반영된다', () => {
    const s = summarize(base({
      assets: [asset({ value: 100_000_000 })],
      loans: [loan({
        name: '자동차 대출', principal: 10_000_000, rate: 5,
        method: '원리금균등', termMonths: 36,
        manualRemaining: 3_000_000, manualAsOf: TODAY,
      })],
    }), TODAY);
    expect(s.totalDebt).toBe(3_000_000);            // 계산값(8백만대)이 아니라 적은 값
    expect(s.netWorth).toBe(97_000_000);
  });

  it('직접 적은 월 상환액이 매달 나가는 돈에 들어간다', () => {
    const s = summarize(base({
      loans: [loan({
        principal: 10_000_000, rate: 5, method: '원리금균등', termMonths: 36,
        manualRemaining: 3_000_000, manualPayment: 60_765, manualAsOf: TODAY,
      })],
    }), TODAY);
    expect(s.monthlyLoanPayment).toBe(60_765);
    expect(s.monthlyOutflow).toBe(60_765);
  });

  it('다 갚았다고 0을 적으면 빚에서 빠진다', () => {
    const s = summarize(base({
      assets: [asset({ value: 100_000_000 })],
      loans: [loan({ manualRemaining: 0, manualAsOf: TODAY })],
    }), TODAY);
    expect(s.totalDebt).toBe(0);
    expect(s.monthlyLoanPayment).toBe(0);
    expect(s.netWorth).toBe(100_000_000);
  });

  it('갚아나가는 대출은 남은 원금만 빚으로 센다', () => {
    const s = summarize(base({
      assets: [asset({ value: 300_000_000 })],
      loans: [loan({ method: '원리금균등', termMonths: 120, startDate: '2021-08-11' })],
    }), TODAY);
    // 5년 갚았으니 원금이 절반 이상 남아 있지만 2.4억보다는 적다
    expect(s.totalDebt).toBeLessThan(240_000_000);
    expect(s.totalDebt).toBeGreaterThan(100_000_000);
    expect(s.netWorth).toBe(300_000_000 - s.totalDebt);
  });
});

describe('내 몫 (자산 − 걸린 대출)', () => {
  // 사용자 실제 상황: 보증금 9,900만원을 대출 6,600만원 + 내 돈 3,300만원으로 마련
  const 보증금 = asset({ id: 'a_jeonse', name: '한양수자인', value: 99_000_000 });
  const 전세대출 = loan({
    id: 'l_jeonse', name: '전세자금대출', principal: 66_000_000,
    method: '만기일시', linkedAssetId: 'a_jeonse',
  });

  it('연결된 대출을 뺀 금액이 내 몫이다', () => {
    const s = summarize(base({ assets: [보증금], loans: [전세대출] }), TODAY);
    expect(s.equityByAsset['a_jeonse'].debt).toBe(66_000_000);
    expect(s.equityByAsset['a_jeonse'].equity).toBe(33_000_000);
    // 순자산은 그대로 총자산 − 총부채
    expect(s.netWorth).toBe(33_000_000);
  });

  it('연결 안 한 대출은 어느 자산의 몫도 깎지 않는다', () => {
    const s = summarize(base({
      assets: [보증금],
      loans: [{ ...전세대출, linkedAssetId: null }],
    }), TODAY);
    expect(s.equityByAsset['a_jeonse'].debt).toBe(0);
    expect(s.equityByAsset['a_jeonse'].equity).toBe(99_000_000);
    expect(s.netWorth).toBe(33_000_000);   // 순자산에서는 그대로 빠진다
  });

  it('한 자산에 대출이 여러 개 걸리면 다 더해서 뺀다', () => {
    const s = summarize(base({
      assets: [보증금],
      loans: [
        전세대출,
        loan({ id: 'l2', principal: 10_000_000, method: '만기일시', linkedAssetId: 'a_jeonse' }),
      ],
    }), TODAY);
    expect(s.equityByAsset['a_jeonse'].debt).toBe(76_000_000);
    expect(s.equityByAsset['a_jeonse'].equity).toBe(23_000_000);
  });

  it('대출이 자산보다 커도 내 몫이 음수가 되지 않는다', () => {
    const s = summarize(base({
      assets: [asset({ id: 'a_jeonse', value: 21_530_000 })],   // 사용자가 잘못 넣었던 상황
      loans: [loan({ id: 'l_jeonse', principal: 77_480_000, method: '만기일시', linkedAssetId: 'a_jeonse' })],
    }), TODAY);
    expect(s.equityByAsset['a_jeonse'].equity).toBe(0);
    expect(s.netWorth).toBe(21_530_000 - 77_480_000);   // 순자산에는 그대로 반영
  });

  it('중도상환으로 직접 적은 남은 원금이 내 몫에 바로 반영된다', () => {
    const s = summarize(base({
      assets: [보증금],
      loans: [{ ...전세대출, manualRemaining: 30_000_000, manualAsOf: TODAY }],
    }), TODAY);
    expect(s.equityByAsset['a_jeonse'].debt).toBe(30_000_000);
    expect(s.equityByAsset['a_jeonse'].equity).toBe(69_000_000);
  });

  it('다 갚은 대출은 내 몫을 깎지 않는다', () => {
    const s = summarize(base({
      assets: [보증금],
      loans: [{ ...전세대출, startDate: '2020-01-10', termMonths: 12 }],
    }), TODAY);
    expect(s.equityByAsset['a_jeonse'].equity).toBe(99_000_000);
  });
});

describe('유동성 · 지금 쓸 수 있는 돈', () => {
  it('분류에서 기본값을 가져온다', () => {
    expect(assetLiquidity(asset({ kindId: 'k_cash' }))).toBe('즉시');
    expect(assetLiquidity(asset({ kindId: 'k_deposit' }))).toBe('며칠');
    expect(assetLiquidity(asset({ kindId: 'k_invest' }))).toBe('며칠');
    expect(assetLiquidity(asset({ kindId: 'k_jeonse' }))).toBe('묶임');
  });

  it('직접 고른 값이 분류 기본값을 이긴다', () => {
    expect(assetLiquidity(asset({ kindId: 'k_jeonse', liquidity: '즉시' }))).toBe('즉시');
  });

  it('사용자가 만든 분류는 묶임으로 떨어진다 (가용자금을 부풀리지 않게)', () => {
    expect(assetLiquidity(asset({ kindId: 'k_내가만든분류' }))).toBe('묶임');
  });

  it('필드가 아예 없는 예전 기록도 기본값으로 떨어진다', () => {
    const legacy = asset({ kindId: 'k_cash' });
    delete (legacy as Partial<Asset>).liquidity;
    expect(assetLiquidity(legacy)).toBe('즉시');
  });

  it('지금 쓸 수 있는 돈은 즉시 자산만 센다', () => {
    const s = summarize(base({
      assets: [
        asset({ id: 'a1', kindId: 'k_cash', value: 3_000_000 }),
        asset({ id: 'a2', kindId: 'k_jeonse', value: 99_000_000 }),
        asset({ id: 'a3', kindId: 'k_invest', value: 5_000_000 }),
      ],
    }), TODAY);
    expect(s.availableNow).toBe(3_000_000);
    expect(s.byLiquidity.map(l => l.level)).toEqual(['즉시', '며칠', '묶임']);
    expect(s.byLiquidity.find(l => l.level === '며칠')!.amount).toBe(5_000_000);
    expect(s.byLiquidity.find(l => l.level === '묶임')!.amount).toBe(99_000_000);
  });

  it('가용자금도 내 몫 기준이다 (주식담보대출 같은 경우)', () => {
    const s = summarize(base({
      assets: [asset({ id: 'a_cash', kindId: 'k_cash', value: 10_000_000 })],
      loans: [loan({ principal: 4_000_000, method: '만기일시', linkedAssetId: 'a_cash' })],
    }), TODAY);
    expect(s.availableNow).toBe(6_000_000);
  });

  it('비중을 다 더하면 1이 된다', () => {
    const s = summarize(base({
      assets: [
        asset({ id: 'a1', kindId: 'k_cash', value: 3_000_000 }),
        asset({ id: 'a2', kindId: 'k_jeonse', value: 99_000_000 }),
      ],
    }), TODAY);
    expect(s.byLiquidity.reduce((t, l) => t + l.ratio, 0)).toBeCloseTo(1, 10);
  });

  it('자산이 없으면 빈 목록이고 가용자금은 0', () => {
    const s = summarize(base(), TODAY);
    expect(s.byLiquidity).toEqual([]);
    expect(s.availableNow).toBe(0);
    expect(s.equityByAsset).toEqual({});
  });

  it('지운 자산은 가용자금에 안 들어간다', () => {
    const s = summarize(base({
      assets: [asset({ id: 'a1', kindId: 'k_cash', value: 3_000_000, deleted: true })],
    }), TODAY);
    expect(s.availableNow).toBe(0);
  });
});

describe('분류별 집계', () => {
  it('비중을 다 더하면 1이 된다', () => {
    const s = summarize(base({
      assets: [
        asset({ id: 'a1', kindId: 'k_jeonse', value: 300_000_000 }),
        asset({ id: 'a2', kindId: 'k_deposit', value: 50_000_000 }),
        asset({ id: 'a3', kindId: 'k_invest', value: 50_000_000 }),
      ],
    }), TODAY);
    expect(s.byKind.reduce((t, k) => t + k.ratio, 0)).toBeCloseTo(1, 10);
    expect(s.totalAsset).toBe(400_000_000);
  });

  it('금액이 큰 분류가 먼저 온다', () => {
    const s = summarize(base({
      assets: [
        asset({ id: 'a1', kindId: 'k_deposit', value: 10_000_000 }),
        asset({ id: 'a2', kindId: 'k_jeonse', value: 300_000_000 }),
      ],
    }), TODAY);
    expect(s.byKind[0].kindId).toBe('k_jeonse');
  });

  it('같은 분류의 자산 여러 개를 합치고 개수를 센다', () => {
    const s = summarize(base({
      assets: [
        asset({ id: 'a1', kindId: 'k_invest', value: 3_000_000 }),
        asset({ id: 'a2', kindId: 'k_invest', value: 7_000_000 }),
      ],
    }), TODAY);
    expect(s.byKind).toHaveLength(1);
    expect(s.byKind[0].amount).toBe(10_000_000);
    expect(s.byKind[0].count).toBe(2);
  });

  it('분류를 지워버린 자산도 금액이 사라지지 않고 기타로 간다', () => {
    const s = summarize(base({
      assets: [asset({ kindId: 'k_없어진분류', value: 5_000_000 })],
    }), TODAY);
    expect(s.totalAsset).toBe(5_000_000);
    expect(s.byKind[0].kindId).toBe('k_etc');
    expect(s.byKind[0].amount).toBe(5_000_000);
  });
});

describe('삭제한 기록 제외', () => {
  it('지운 자산·대출·고정비는 계산에서 빠진다', () => {
    const s = summarize(base({
      assets: [asset({ value: 100_000_000 }), asset({ id: 'a2', value: 999, deleted: true })],
      loans: [loan({ deleted: true })],
      recurrings: [recurring({ deleted: true })],
    }), TODAY);
    expect(s.totalAsset).toBe(100_000_000);
    expect(s.totalDebt).toBe(0);
    expect(s.monthlyFixed).toBe(0);
  });

  it('지운 분류는 목록에서 빠지고, 거기 있던 자산은 기타로 간다', () => {
    const kinds = DEFAULT_KINDS.map(k =>
      k.id === 'k_invest' ? { ...k, deleted: true } : k);
    const s = summarize(base({
      kinds,
      assets: [asset({ kindId: 'k_invest', value: 1_000_000 })],
    }), TODAY);
    expect(s.byKind[0].kindId).toBe('k_etc');
  });
});

describe('매달 나가는 돈', () => {
  it('대출 상환액 + 고정비 = 합계', () => {
    const s = summarize(base({
      loans: [loan()],                       // 만기일시 → 이자만
      recurrings: [recurring({ amount: 150_000 }), recurring({ id: 'r2', amount: 50_000 })],
    }), TODAY);
    expect(s.monthlyLoanPayment).toBeCloseTo(240_000_000 * 0.035 / 12, 0);
    expect(s.monthlyFixed).toBe(200_000);
    expect(s.monthlyOutflow).toBeCloseTo(s.monthlyLoanPayment + s.monthlyFixed, 6);
  });

  it('다 갚은 대출은 나가는 돈에 안 들어간다', () => {
    const s = summarize(base({
      loans: [loan({ startDate: '2020-01-10', termMonths: 12 })],
    }), TODAY);
    expect(s.monthlyLoanPayment).toBe(0);
    expect(s.totalDebt).toBe(0);
  });
});

describe('수익률', () => {
  it('원금을 적은 자산만 수익률에 넣는다', () => {
    const s = summarize(base({
      assets: [
        asset({ id: 'a1', kindId: 'k_invest', value: 12_000_000, principal: 10_000_000 }),
        asset({ id: 'a2', kindId: 'k_jeonse', value: 300_000_000, principal: null }),
      ],
    }), TODAY);
    expect(s.totalPrincipal).toBe(10_000_000);
    expect(s.totalProfit).toBe(2_000_000);
    expect(s.profitRatio).toBeCloseTo(0.2, 10);
  });

  it('손실이면 수익이 음수다', () => {
    const s = summarize(base({
      assets: [asset({ kindId: 'k_invest', value: 8_000_000, principal: 10_000_000 })],
    }), TODAY);
    expect(s.totalProfit).toBe(-2_000_000);
    expect(s.profitRatio).toBeCloseTo(-0.2, 10);
  });

  it('원금을 아무 데도 안 적었으면 수익률은 0이다', () => {
    const s = summarize(base({ assets: [asset()] }), TODAY);
    expect(s.profitRatio).toBe(0);
  });
});

describe('다가오는 만기', () => {
  it('가까운 순으로 정렬한다', () => {
    const s = summarize(base({
      assets: [
        asset({ id: 'a1', name: '전세', maturity: '2027-08-11' }),
        asset({ id: 'a2', name: '적금', maturity: '2026-09-25' }),
      ],
    }), TODAY);
    expect(s.upcoming.map(u => u.label)).toEqual(['적금', '전세']);
    expect(s.upcoming[0].dday).toBe(45);
    expect(s.upcoming[1].dday).toBe(365);
  });

  it('이미 지난 만기는 띄우지 않는다', () => {
    const s = summarize(base({
      assets: [asset({ maturity: '2020-01-01' })],
    }), TODAY);
    expect(s.upcoming).toEqual([]);
  });

  it('오늘이 만기면 D-day 0으로 포함한다', () => {
    const s = summarize(base({ assets: [asset({ maturity: TODAY })] }), TODAY);
    expect(s.upcoming).toHaveLength(1);
    expect(s.upcoming[0].dday).toBe(0);
  });

  it('대출 만기도 같이 들어간다', () => {
    const s = summarize(base({ loans: [loan()] }), TODAY);
    expect(s.upcoming).toHaveLength(1);
    expect(s.upcoming[0].kind).toBe('대출만기');
    expect(s.upcoming[0].date).toBe('2028-01-10');
  });

  it('다 갚은 대출은 만기 목록에 없다', () => {
    const s = summarize(base({
      loans: [loan({ startDate: '2020-01-10', termMonths: 12 })],
    }), TODAY);
    expect(s.upcoming).toEqual([]);
  });

  it('만기가 없는 자산은 목록에 없다', () => {
    const s = summarize(base({ assets: [asset({ maturity: null })] }), TODAY);
    expect(s.upcoming).toEqual([]);
  });
});

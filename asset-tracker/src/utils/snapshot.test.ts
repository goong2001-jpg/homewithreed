import { DEFAULT_KINDS, Snapshot } from '../types';
import {
  lastMonths, monthOverMonth, previousMonthSnapshot, snapshotFields, upsertMonthlySnapshot,
} from './snapshot';
import { summarize } from './summary';

const NOW = 1_700_000_000_000;

function summaryOf(value: number) {
  return summarize({
    kinds: DEFAULT_KINDS,
    assets: [{
      id: 'a1', kindId: 'k_cash', name: '통장', value, principal: null, maturity: null,
      liquidity: null, memo: '', order: 0, createdAt: 0, updatedAt: 0,
    }],
    loans: [],
    recurrings: [],
  }, '2026-08-11');
}

describe('upsertMonthlySnapshot', () => {
  it('이번 달 스냅샷이 없으면 만든다', () => {
    const out = upsertMonthlySnapshot([], summaryOf(1_000_000), '2026-08-11', NOW);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      id: 'snap_2026-08', month: '2026-08', takenAt: NOW, updatedAt: NOW,
      netWorth: 1_000_000, totalAsset: 1_000_000, totalDebt: 0, liquid: 1_000_000,
      byKind: { k_cash: 1_000_000 },
    });
  });

  it('같은 달에 숫자가 바뀌면 그 줄을 덮어쓴다 (줄이 늘지 않는다)', () => {
    const first = upsertMonthlySnapshot([], summaryOf(1_000_000), '2026-08-11', NOW);
    const out = upsertMonthlySnapshot(first, summaryOf(1_500_000), '2026-08-20', NOW + 1);
    expect(out).toHaveLength(1);
    expect(out[0].netWorth).toBe(1_500_000);
    expect(out[0].takenAt).toBe(NOW + 1);
  });

  it('숫자가 그대로면 같은 배열을 돌려준다 — effect 가 헛돌지 않게', () => {
    const first = upsertMonthlySnapshot([], summaryOf(1_000_000), '2026-08-11', NOW);
    const out = upsertMonthlySnapshot(first, summaryOf(1_000_000), '2026-08-25', NOW + 99);
    expect(out).toBe(first);
  });

  it('달이 바뀌면 새 줄을 만들고 지난달 줄은 건드리지 않는다', () => {
    const aug = upsertMonthlySnapshot([], summaryOf(1_000_000), '2026-08-11', NOW);
    const sep = upsertMonthlySnapshot(aug, summaryOf(2_000_000), '2026-09-01', NOW + 1);
    expect(sep).toHaveLength(2);
    expect(sep[0]).toEqual(aug[0]);
    expect(sep[1]).toMatchObject({ month: '2026-09', netWorth: 2_000_000 });
  });

  it('지워진(툼스톤) 이번 달 줄은 되살려 쓴다', () => {
    const dead: Snapshot = {
      ...upsertMonthlySnapshot([], summaryOf(1), '2026-08-11', NOW)[0], deleted: true,
    };
    const out = upsertMonthlySnapshot([dead], summaryOf(1), '2026-08-12', NOW + 1);
    expect(out).toHaveLength(1);
    expect(out[0].deleted).toBe(false);
  });
});

describe('snapshotFields', () => {
  it('summarize 결과에서 필요한 숫자만 뽑는다', () => {
    const f = snapshotFields(summaryOf(500));
    expect(f).toEqual({
      netWorth: 500, totalAsset: 500, totalDebt: 0, liquid: 500, byKind: { k_cash: 500 },
    });
  });
});

describe('lastMonths / previousMonthSnapshot', () => {
  const snaps = [
    upsertMonthlySnapshot([], summaryOf(10), '2026-06-11', NOW)[0],
    upsertMonthlySnapshot([], summaryOf(20), '2026-08-11', NOW)[0],
  ];

  it('최근 n개월 자리를 빈 달까지 채워 돌려준다', () => {
    const out = lastMonths(snaps, '2026-08-11', 4);
    expect(out.map(o => o.month)).toEqual(['2026-05', '2026-06', '2026-07', '2026-08']);
    expect(out.map(o => o.snapshot?.netWorth ?? null)).toEqual([null, 10, null, 20]);
  });

  it('연도가 넘어가도 달 순서가 맞다', () => {
    const out = lastMonths([], '2026-01-15', 3);
    expect(out.map(o => o.month)).toEqual(['2025-11', '2025-12', '2026-01']);
  });

  it('지난달 스냅샷이 없으면 null', () => {
    expect(previousMonthSnapshot(snaps, '2026-08-11')).toBeNull();
    expect(previousMonthSnapshot(snaps, '2026-07-11')?.netWorth).toBe(10);
  });
});

describe('monthOverMonth', () => {
  it('변화액과 비율', () => {
    expect(monthOverMonth(40_820_000, 40_000_000)).toEqual({ change: 820_000, ratio: 0.0205 });
  });
  it('지난달이 0이면 비율은 null', () => {
    expect(monthOverMonth(100, 0)).toEqual({ change: 100, ratio: null });
  });
  it('지난달이 마이너스여도 나아진 쪽이 +로 읽힌다', () => {
    expect(monthOverMonth(-50, -100)).toEqual({ change: 50, ratio: 0.5 });
  });
});

import { addDays } from './date';
import { HISTORY_CAP, appendHistory, returnSince } from './history';

describe('appendHistory', () => {
  it('없던 이력에 첫 줄을 만든다', () => {
    expect(appendHistory(undefined, '2026-08-11', 100)).toEqual([{ date: '2026-08-11', value: 100 }]);
  });

  it('다른 날이면 뒤에 붙고 날짜순으로 정렬된다', () => {
    const h = appendHistory([{ date: '2026-08-11', value: 100 }], '2026-08-01', 90);
    expect(h.map(p => p.date)).toEqual(['2026-08-01', '2026-08-11']);
  });

  it('같은 날은 바꿔치기한다 — 하루에 한 값', () => {
    const h = appendHistory([{ date: '2026-08-11', value: 100 }], '2026-08-11', 120);
    expect(h).toEqual([{ date: '2026-08-11', value: 120 }]);
  });

  it('HISTORY_CAP 을 넘으면 가장 오래된 줄부터 버린다', () => {
    let h = appendHistory(undefined, '2000-01-01', 0);
    for (let i = 1; i <= HISTORY_CAP + 5; i++) {
      h = appendHistory(h, addDays('2001-01-01', i), i);
    }
    expect(h).toHaveLength(HISTORY_CAP);
    expect(h[0].date).not.toBe('2000-01-01');
    expect(h[h.length - 1].value).toBe(HISTORY_CAP + 5);
  });
});

describe('returnSince', () => {
  const h = [
    { date: '2026-05-01', value: 1_000_000 },
    { date: '2026-06-15', value: 1_100_000 },
    { date: '2026-08-01', value: 1_300_000 },
  ];

  it('첫 줄부터의 수익', () => {
    expect(returnSince(h, '2026-05-01', 1_250_000)).toEqual({
      from: h[0], change: 250_000, ratio: 0.25,
    });
  });

  it('딱 그 날 기록이 없으면 그 이전 가장 최근 줄을 기준으로 쓴다', () => {
    // 7월 11일 기준 → 6월 15일 줄
    const r = returnSince(h, '2026-07-11', 1_210_000);
    expect(r?.from).toEqual(h[1]);
    expect(r?.ratio).toBeCloseTo(0.1);
  });

  it('그보다 앞선 기록이 없으면 null', () => {
    expect(returnSince(h, '2026-04-30', 1)).toBeNull();
    expect(returnSince([], '2026-08-11', 1)).toBeNull();
    expect(returnSince(undefined, '2026-08-11', 1)).toBeNull();
  });

  it('기준값이 0이면 비율은 null (0 으로 못 나눈다)', () => {
    expect(returnSince([{ date: '2026-01-01', value: 0 }], '2026-02-01', 50)).toEqual({
      from: { date: '2026-01-01', value: 0 }, change: 50, ratio: null,
    });
  });
});

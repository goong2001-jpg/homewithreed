import { Entry } from '../types';
import {
  coveredMinutes, entryMinutes, gapsOf, mergeRanges, normalizeRange, overlapsOf, runningOf,
  segmentsOfDay, splitByDay,
} from './entry';
import { MINUTE, atMinutes, startOfDay } from './time';

const DAY = '2026-08-13';
const PREV = '2026-08-12';

/** '09:30' → 그 날의 epoch ms */
function at(day: string, hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return atMinutes(day, h * 60 + m);
}

function entry(over: Partial<Entry> = {}): Entry {
  return {
    id: 'e1', categoryId: 'c_work',
    startedAt: at(DAY, '09:00'), endedAt: at(DAY, '10:30'),
    memo: '', createdAt: 0, updatedAt: 0,
    ...over,
  };
}

describe('기록 길이', () => {
  it('끝난 기록은 적힌 대로', () => {
    expect(entryMinutes(entry(), at(DAY, '23:00'))).toBe(90);
  });

  it('진행 중인 기록은 지금까지로 센다', () => {
    const e = entry({ endedAt: null });
    expect(entryMinutes(e, at(DAY, '09:40'))).toBe(40);
  });

  it('진행 중인 기록을 찾는다 — 여러 개면 마지막에 시작한 것', () => {
    const a = entry({ id: 'a', endedAt: null, startedAt: at(DAY, '08:00') });
    const b = entry({ id: 'b', endedAt: null, startedAt: at(DAY, '09:00') });
    const done = entry({ id: 'c' });
    expect(runningOf([a, done, b])?.id).toBe('b');
    expect(runningOf([done])).toBeNull();
    expect(runningOf([entry({ endedAt: null, deleted: true })])).toBeNull();
  });
});

describe('자정 넘기기', () => {
  it('하루 안에서 끝나면 조각은 하나', () => {
    const segs = splitByDay(entry(), Date.now());
    expect(segs).toHaveLength(1);
    expect(segs[0]).toMatchObject({ day: DAY, minutes: 90, clippedStart: false, clippedEnd: false });
  });

  it('23:40에 자서 07:00에 깨면 이틀로 쪼개진다', () => {
    const sleep = entry({
      categoryId: 'c_sleep',
      startedAt: at(PREV, '23:40'),
      endedAt: at(DAY, '07:00'),
    });
    const segs = splitByDay(sleep, Date.now());

    expect(segs).toHaveLength(2);
    expect(segs[0]).toMatchObject({ day: PREV, minutes: 20, clippedEnd: true, clippedStart: false });
    expect(segs[1]).toMatchObject({ day: DAY, minutes: 420, clippedStart: true, clippedEnd: false });
    expect(segs[0].minutes + segs[1].minutes).toBe(440);
  });

  it('타이머를 며칠째 안 껐어도 날짜별로 다 쪼갠다', () => {
    const forgot = entry({ startedAt: at('2026-08-10', '22:00'), endedAt: null });
    const segs = splitByDay(forgot, at(DAY, '06:00'));
    expect(segs.map(s => s.day)).toEqual(['2026-08-10', '2026-08-11', '2026-08-12', '2026-08-13']);
    expect(segs[1].minutes).toBe(1440);
  });

  it('길이가 0이면 조각을 만들지 않는다', () => {
    expect(splitByDay(entry({ endedAt: at(DAY, '09:00') }), Date.now())).toEqual([]);
  });

  it('그 날에 걸친 조각만 시작순으로 모은다', () => {
    const entries = [
      entry({ id: 'a', startedAt: at(DAY, '14:00'), endedAt: at(DAY, '15:00') }),
      entry({ id: 'b', startedAt: at(PREV, '23:40'), endedAt: at(DAY, '07:00') }),
      entry({ id: 'c', startedAt: at('2026-08-01', '09:00'), endedAt: at('2026-08-01', '10:00') }),
      entry({ id: 'd', deleted: true, startedAt: at(DAY, '11:00'), endedAt: at(DAY, '12:00') }),
    ];
    const segs = segmentsOfDay(entries, DAY, at(DAY, '20:00'));
    expect(segs.map(s => s.entryId)).toEqual(['b', 'a']);
  });
});

describe('겹침', () => {
  it('겹치는 구간은 하나로 합친다', () => {
    const merged = mergeRanges([
      { start: at(DAY, '09:00'), end: at(DAY, '10:00') },
      { start: at(DAY, '09:30'), end: at(DAY, '11:00') },
      { start: at(DAY, '13:00'), end: at(DAY, '14:00') },
    ]);
    expect(merged).toHaveLength(2);
    expect(merged[0].end).toBe(at(DAY, '11:00'));
  });

  it('겹치게 적어도 실제로 덮인 시간은 두 번 세지 않는다', () => {
    const covered = coveredMinutes([
      { start: at(DAY, '09:00'), end: at(DAY, '10:00') },
      { start: at(DAY, '09:30'), end: at(DAY, '10:30') },
    ]);
    expect(covered).toBe(90);
  });

  it('같은 시간대에 이미 적어둔 기록을 찾아준다', () => {
    const entries = [
      entry({ id: 'a', startedAt: at(DAY, '09:00'), endedAt: at(DAY, '10:00') }),
      entry({ id: 'b', startedAt: at(DAY, '11:00'), endedAt: at(DAY, '12:00') }),
    ];
    const hit = overlapsOf(entries, at(DAY, '09:30'), at(DAY, '10:30'), null, Date.now());
    expect(hit.map(e => e.id)).toEqual(['a']);

    // 딱 붙는 건 겹치는 게 아니다 (10:00 끝 → 10:00 시작)
    expect(overlapsOf(entries, at(DAY, '10:00'), at(DAY, '11:00'), null, Date.now())).toEqual([]);

    // 자기 자신은 뺀다 (편집할 때)
    expect(overlapsOf(entries, at(DAY, '09:30'), at(DAY, '10:30'), 'a', Date.now())).toEqual([]);
  });
});

describe('빈 시간 찾기', () => {
  const now = at(DAY, '12:00');

  it('기록 사이의 빈 구간을 돌려준다', () => {
    const entries = [
      entry({ id: 'a', startedAt: at(DAY, '07:00'), endedAt: at(DAY, '09:00') }),
      entry({ id: 'b', startedAt: at(DAY, '10:00'), endedAt: at(DAY, '11:00') }),
    ];
    const gaps = gapsOf(segmentsOfDay(entries, DAY, now), DAY, now);

    expect(gaps).toHaveLength(3);
    expect(gaps[0]).toMatchObject({ minutes: 7 * 60 });                    // 00:00~07:00
    expect(gaps[1]).toMatchObject({ start: at(DAY, '09:00'), minutes: 60 });
    expect(gaps[2]).toMatchObject({ start: at(DAY, '11:00'), minutes: 60 });
  });

  it('아직 안 온 시간은 빈 게 아니라 안 산 시간이다', () => {
    const gaps = gapsOf([], DAY, now);
    expect(gaps).toHaveLength(1);
    expect(gaps[0].end).toBe(now);          // 24:00이 아니라 지금까지
    expect(gaps[0].minutes).toBe(720);
  });

  it('지나간 날은 하루 끝까지 본다', () => {
    const gaps = gapsOf([], PREV, now);
    expect(gaps[0].minutes).toBe(1440);
  });

  it('부스러기 시간은 걸러낸다', () => {
    const entries = [
      entry({ id: 'a', startedAt: startOfDay(DAY), endedAt: at(DAY, '09:00') }),
      entry({ id: 'b', startedAt: at(DAY, '09:03'), endedAt: now }),
    ];
    expect(gapsOf(segmentsOfDay(entries, DAY, now), DAY, now)).toEqual([]);
    expect(gapsOf(segmentsOfDay(entries, DAY, now), DAY, now, 1)).toHaveLength(1);
  });
});

describe('손으로 적은 시작–끝', () => {
  it('보통은 같은 날 안에서 끝난다', () => {
    const r = normalizeRange(DAY, 9 * 60, 10 * 60);
    expect(r.crossesMidnight).toBe(false);
    expect((r.end - r.start) / MINUTE).toBe(60);
  });

  it('끝이 시작보다 이르면 다음날로 본다 — 야근과 수면을 적을 수 있게', () => {
    const r = normalizeRange(DAY, 23 * 60 + 30, 60);
    expect(r.crossesMidnight).toBe(true);
    expect((r.end - r.start) / MINUTE).toBe(90);
    expect(r.start).toBe(at(DAY, '23:30'));
    expect(r.end).toBe(at('2026-08-14', '01:00'));
  });

  it('시작과 끝이 같으면 24시간으로 본다 (0분짜리 기록은 쓸모가 없다)', () => {
    const r = normalizeRange(DAY, 600, 600);
    expect((r.end - r.start) / MINUTE).toBe(1440);
  });
});

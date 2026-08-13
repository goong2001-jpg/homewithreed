import { BlockPlan, DEFAULT_BLOCKS, DEFAULT_CATEGORIES, Entry, TimeBlock } from '../types';
import {
  blockAtMinutes, blockRanges, blockReports, blockRollups, blocksLeft, guardCategoryIds,
  missedBlocks, scriptLines,
} from './block';
import { segmentsOfDay } from './entry';
import { atMinutes } from './time';

const DAY = '2026-08-13';
const PREV = '2026-08-12';

function at(day: string, hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return atMinutes(day, h * 60 + m);
}

function entry(over: Partial<Entry> = {}): Entry {
  return {
    id: 'e1', categoryId: 'c_work',
    startedAt: at(DAY, '09:00'), endedAt: at(DAY, '11:00'),
    memo: '', createdAt: 0, updatedAt: 0,
    ...over,
  };
}

function plan(over: Partial<BlockPlan> = {}): BlockPlan {
  return {
    id: 'p1', day: DAY, blockId: 'b_forenoon', categoryId: 'c_work',
    memo: '', createdAt: 0, updatedAt: 0,
    ...over,
  };
}

function reports(entries: Entry[], plans: BlockPlan[], now: number, day = DAY) {
  return blockReports({
    blocks: DEFAULT_BLOCKS,
    plans,
    segments: segmentsOfDay(entries, day, now),
    day,
    now,
  });
}

describe('블록 경계', () => {
  it('시작 시각만 저장하고 끝은 다음 블록에서 얻는다', () => {
    const ranges = blockRanges(DEFAULT_BLOCKS);
    expect(ranges).toHaveLength(6);
    expect(ranges[0]).toMatchObject({ startMinutes: 0, endMinutes: 360 });
    expect(ranges[5]).toMatchObject({ startMinutes: 1260, endMinutes: 1440 });
  });

  it('하루를 빈틈없이 덮는다 — 아무 블록에도 안 속한 시간이 없어야 한다', () => {
    const ranges = blockRanges(DEFAULT_BLOCKS);
    let cursor = 0;
    for (const r of ranges) {
      expect(r.startMinutes).toBe(cursor);
      cursor = r.endMinutes;
    }
    expect(cursor).toBe(1440);
  });

  it('첫 블록의 시작은 무조건 자정이다 (자정을 넘나드는 블록을 만들지 않으려고)', () => {
    const moved: TimeBlock[] = DEFAULT_BLOCKS.map(
      b => (b.id === 'b_dawn' ? { ...b, startMinutes: 5 * 60 } : b),
    );
    expect(blockRanges(moved)[0]).toMatchObject({ startMinutes: 0, endMinutes: 360 });
  });

  it('지운 블록은 빼고, 남은 블록이 그 자리를 흡수한다', () => {
    const gone = DEFAULT_BLOCKS.map(b => (b.id === 'b_forenoon' ? { ...b, deleted: true } : b));
    const ranges = blockRanges(gone);
    expect(ranges).toHaveLength(5);
    expect(ranges[1]).toMatchObject({ startMinutes: 360, endMinutes: 720 });   // 아침이 오전까지
  });

  it('지금 어느 블록인지 찾는다', () => {
    const ranges = blockRanges(DEFAULT_BLOCKS);
    expect(blockAtMinutes(ranges, 0)?.block.id).toBe('b_dawn');
    expect(blockAtMinutes(ranges, 10 * 60)?.block.id).toBe('b_forenoon');
    expect(blockAtMinutes(ranges, 1439)?.block.id).toBe('b_night');
    // 경계는 뒤 블록의 것 — 12:00은 오전이 아니라 오후다
    expect(blockAtMinutes(ranges, 12 * 60)?.block.id).toBe('b_afternoon');
  });
});

describe('블록 판정', () => {
  it('계획한 분류로 블록의 절반을 채우면 지킨 것', () => {
    // 오전(09~12, 3시간) 중 2시간을 계획대로 일했다
    const r = reports([entry()], [plan()], at(DAY, '23:00'));
    const forenoon = r.find(x => x.blockId === 'b_forenoon')!;

    expect(forenoon.plannedMinutes).toBe(120);
    expect(forenoon.keepRatio).toBeCloseTo(120 / 180);
    expect(forenoon.state).toBe('kept');
  });

  it('절반을 못 채우면 놓친 것', () => {
    const r = reports(
      [entry({ endedAt: at(DAY, '09:40') })],   // 40분만
      [plan()],
      at(DAY, '23:00'),
    );
    expect(r.find(x => x.blockId === 'b_forenoon')!.state).toBe('missed');
  });

  it('계획을 안 세운 블록은 판정하지 않는다 — 안 세운 걸 실패로 세면 죄책감만 쌓인다', () => {
    const r = reports([entry()], [], at(DAY, '23:00'));
    expect(r.find(x => x.blockId === 'b_forenoon')!.state).toBe('unplanned');
    expect(r.find(x => x.blockId === 'b_dawn')!.state).toBe('unplanned');
  });

  it('진행 중인 블록은 성적이 아니라 현재 상태다', () => {
    const r = reports([entry({ endedAt: null })], [plan()], at(DAY, '10:00'));
    const forenoon = r.find(x => x.blockId === 'b_forenoon')!;

    expect(forenoon.state).toBe('now');
    expect(forenoon.elapsedMinutes).toBe(60);       // 09:00~10:00
    expect(forenoon.keepRatio).toBeCloseTo(1);      // 지나간 만큼은 계획대로 하고 있다
  });

  it('아직 안 온 블록은 비어 있을 뿐이다', () => {
    const r = reports([], [], at(DAY, '10:00'));
    expect(r.find(x => x.blockId === 'b_evening')!.state).toBe('upcoming');
    expect(r.find(x => x.blockId === 'b_evening')!.elapsedMinutes).toBe(0);
  });

  it('블록에 걸친 기록은 걸친 만큼만 나눠 담긴다', () => {
    // 11:00~13:00 → 오전에 1시간, 오후에 1시간
    const r = reports(
      [entry({ startedAt: at(DAY, '11:00'), endedAt: at(DAY, '13:00') })],
      [],
      at(DAY, '23:00'),
    );
    expect(r.find(x => x.blockId === 'b_forenoon')!.totalMinutes).toBe(60);
    expect(r.find(x => x.blockId === 'b_afternoon')!.totalMinutes).toBe(60);
  });

  it('자정을 넘긴 기록도 그 날 몫만 새벽 블록에 담긴다', () => {
    const r = reports(
      [entry({ categoryId: 'c_sleep', startedAt: at(PREV, '23:40'), endedAt: at(DAY, '06:00') })],
      [],
      at(DAY, '23:00'),
    );
    expect(r.find(x => x.blockId === 'b_dawn')!.totalMinutes).toBe(360);
  });

  it('블록에서 가장 오래 한 분류를 뽑는다', () => {
    const r = reports([
      entry({ id: 'a', categoryId: 'c_phone', startedAt: at(DAY, '09:00'), endedAt: at(DAY, '09:40') }),
      entry({ id: 'b', categoryId: 'c_work', startedAt: at(DAY, '10:00'), endedAt: at(DAY, '11:30') }),
    ], [], at(DAY, '23:00'));

    expect(r.find(x => x.blockId === 'b_forenoon')!.topCategoryId).toBe('c_work');
  });
});

describe('자포자기 방지', () => {
  it('놓친 블록이 있어도 남은 블록을 셀 수 있다', () => {
    // 오후 3시. 오전은 계획해놓고 놓쳤다
    const r = reports([], [plan()], at(DAY, '15:00'));

    expect(missedBlocks(r).map(b => b.blockId)).toEqual(['b_forenoon']);
    // 지금 있는 오후 + 저녁 + 밤
    expect(blocksLeft(r).map(b => b.blockId)).toEqual(['b_afternoon', 'b_evening', 'b_night']);
  });

  it('하루가 끝나면 남은 블록도 없다', () => {
    const r = reports([], [plan()], at('2026-08-14', '00:30'));
    expect(blocksLeft(r)).toEqual([]);
  });
});

describe('블록별 접기 — 어느 시간대에 무너지나', () => {
  const days = ['2026-08-10', '2026-08-11', '2026-08-12'];

  it('같은 시간대끼리 모아 달성률을 낸다', () => {
    const entries: Entry[] = [
      // 10일 오전: 계획대로 3시간
      entry({ id: 'a', startedAt: at(days[0], '09:00'), endedAt: at(days[0], '12:00') }),
      // 11일 오전: 30분만
      entry({ id: 'b', startedAt: at(days[1], '09:00'), endedAt: at(days[1], '09:30') }),
      // 12일 오전: 2시간
      entry({ id: 'c', startedAt: at(days[2], '09:00'), endedAt: at(days[2], '11:00') }),
    ];
    const plans = days.map((d, i) => plan({ id: `p${i}`, day: d }));

    const rollup = blockRollups({
      blocks: DEFAULT_BLOCKS, plans, entries, guardIds: [],
      from: days[0], to: days[2], now: at('2026-08-13', '00:00'),
    });
    const forenoon = rollup.find(r => r.blockId === 'b_forenoon')!;

    expect(forenoon.plannedDays).toBe(3);
    expect(forenoon.keptDays).toBe(2);
    expect(forenoon.keepRate).toBeCloseTo(2 / 3);
    expect(forenoon.totalMinutes).toBe(330);
  });

  it('줄이려는 분류가 어느 시간대에 몰리는지 따로 센다', () => {
    const entries: Entry[] = days.map((d, i) => entry({
      id: `x${i}`, categoryId: 'c_phone',
      startedAt: at(d, '22:00'), endedAt: at(d, '23:10'),
    }));

    const rollup = blockRollups({
      blocks: DEFAULT_BLOCKS, plans: [], entries, guardIds: ['c_phone'],
      from: days[0], to: days[2], now: at('2026-08-13', '00:00'),
    });

    expect(rollup.find(r => r.blockId === 'b_night')!.guardMinutes).toBe(210);
    expect(rollup.find(r => r.blockId === 'b_evening')!.guardMinutes).toBe(0);
  });

  it('계획이 하나도 없으면 달성률은 null (0%가 아니다)', () => {
    const rollup = blockRollups({
      blocks: DEFAULT_BLOCKS, plans: [], entries: [], guardIds: [],
      from: days[0], to: days[2], now: at('2026-08-13', '00:00'),
    });
    expect(rollup.every(r => r.keepRate === null)).toBe(true);
  });

  it('아직 안 온 날은 세지 않는다', () => {
    const rollup = blockRollups({
      blocks: DEFAULT_BLOCKS,
      plans: [plan({ day: '2026-08-20' })],
      entries: [], guardIds: [],
      from: '2026-08-17', to: '2026-08-23', now: at('2026-08-18', '12:00'),
    });
    expect(rollup.find(r => r.blockId === 'b_forenoon')!.plannedDays).toBe(0);
  });
});

describe('3단계 대본', () => {
  it('줄이려는 분류를 골라낸다 — guard를 켰거나 이하 목표를 잡았거나', () => {
    const ids = guardCategoryIds([
      ...DEFAULT_CATEGORIES,
      { ...DEFAULT_CATEGORIES[0], id: 'c_late', guard: false, goalKind: '이하', weeklyGoalMinutes: 120 },
    ]);
    expect(ids).toContain('c_phone');   // 기본값에서 guard가 켜져 있다
    expect(ids).toContain('c_late');
    expect(ids).not.toContain('c_work');
  });

  it('여러 줄로 적어둔 대본을 줄 단위로 자르고 빈 줄은 버린다', () => {
    expect(scriptLines(' 폰은 거실에 두기 \n\n 알림 끄기 ')).toEqual(['폰은 거실에 두기', '알림 끄기']);
    expect(scriptLines(undefined)).toEqual([]);
  });
});

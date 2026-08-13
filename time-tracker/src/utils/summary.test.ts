import { Category, DEFAULT_CATEGORIES, Entry } from '../types';
import { compareByCategory, goalCheck, summarize } from './summary';
import { atMinutes } from './time';

const MON = '2026-08-10';
const TUE = '2026-08-11';
const SUN = '2026-08-16';

function at(day: string, hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return atMinutes(day, h * 60 + m);
}

function entry(over: Partial<Entry> = {}): Entry {
  return {
    id: 'e1', categoryId: 'c_work',
    startedAt: at(MON, '09:00'), endedAt: at(MON, '11:00'),
    memo: '', createdAt: 0, updatedAt: 0,
    ...over,
  };
}

function base(entries: Entry[], categories: Category[] = DEFAULT_CATEGORIES) {
  return { entries, categories };
}

/** 그 주가 다 지난 시점 */
const AFTER_WEEK = at('2026-08-17', '00:00');

describe('기간 집계', () => {
  it('분류별로 모으고 비율을 낸다', () => {
    const s = summarize(base([
      entry({ id: 'a', categoryId: 'c_work', startedAt: at(MON, '09:00'), endedAt: at(MON, '12:00') }),
      entry({ id: 'b', categoryId: 'c_kids', startedAt: at(MON, '19:00'), endedAt: at(MON, '20:00') }),
      entry({ id: 'c', categoryId: 'c_work', startedAt: at(TUE, '09:00'), endedAt: at(TUE, '10:00') }),
    ]), MON, SUN, AFTER_WEEK);

    expect(s.totalMinutes).toBe(300);
    expect(s.byCategory[0]).toMatchObject({ categoryId: 'c_work', minutes: 240, count: 2 });
    expect(s.byCategory[0].ratio).toBeCloseTo(0.8);
    expect(s.byCategory[1]).toMatchObject({ categoryId: 'c_kids', minutes: 60 });
    expect(s.days).toBe(7);
  });

  it('지운 기록은 안 세고, 지운 분류의 기록은 이름을 잃지 않는다', () => {
    const s = summarize(base([
      entry({ id: 'a', deleted: true }),
      entry({ id: 'b', categoryId: 'c_gone', startedAt: at(MON, '13:00'), endedAt: at(MON, '14:00') }),
    ]), MON, SUN, AFTER_WEEK);

    expect(s.totalMinutes).toBe(60);
    expect(s.byCategory[0].name).toBe('지운 분류');
  });

  it('기간 밖의 기록은 안 센다', () => {
    const s = summarize(base([
      entry({ startedAt: at('2026-08-09', '09:00'), endedAt: at('2026-08-09', '11:00') }),
    ]), MON, SUN, AFTER_WEEK);
    expect(s.totalMinutes).toBe(0);
    expect(s.byCategory).toEqual([]);
  });

  it('자정을 넘긴 기록은 두 날에 나눠 붙는다', () => {
    const s = summarize(base([
      entry({ categoryId: 'c_sleep', startedAt: at(MON, '23:40'), endedAt: at(TUE, '07:00') }),
    ]), MON, SUN, AFTER_WEEK);

    expect(s.byDay[0]).toMatchObject({ day: MON, minutes: 20 });
    expect(s.byDay[1]).toMatchObject({ day: TUE, minutes: 420 });
    expect(s.totalMinutes).toBe(440);
    expect(s.busiestDay?.day).toBe(TUE);
  });

  it('아무것도 없어도 0으로 나누지 않는다', () => {
    const s = summarize(base([]), MON, SUN, AFTER_WEEK);
    expect(s.totalMinutes).toBe(0);
    expect(s.dailyAverageMinutes).toBe(0);
    expect(s.busiestDay).toBeNull();
    expect(s.byCategory).toEqual([]);
    expect(s.byDay).toHaveLength(7);
  });
});

describe('안 적힌 시간', () => {
  it('흘러간 시간에서 기록을 뺀 만큼', () => {
    const s = summarize(base([
      entry({ startedAt: at(MON, '09:00'), endedAt: at(MON, '17:00') }),
    ]), MON, MON, at(TUE, '00:00'));

    expect(s.elapsedMinutes).toBe(1440);
    expect(s.untrackedMinutes).toBe(1440 - 480);
  });

  it('아직 안 온 시간은 안 적힌 시간이 아니다', () => {
    // 월요일 12시에 보는 이번 주 — 흘러간 건 12시간뿐이다
    const s = summarize(base([]), MON, SUN, at(MON, '12:00'));
    expect(s.elapsedMinutes).toBe(720);
    expect(s.untrackedMinutes).toBe(720);
  });

  it('겹쳐 적어도 안 적힌 시간이 줄어들지 않는다', () => {
    const s = summarize(base([
      entry({ id: 'a', startedAt: at(MON, '09:00'), endedAt: at(MON, '11:00') }),
      entry({ id: 'b', categoryId: 'c_kids', startedAt: at(MON, '10:00'), endedAt: at(MON, '12:00') }),
    ]), MON, MON, at(TUE, '00:00'));

    expect(s.totalMinutes).toBe(240);                 // 적힌 건 4시간
    expect(s.untrackedMinutes).toBe(1440 - 180);      // 실제로 덮인 건 3시간
  });

  it('아직 안 온 시간에 적어둔 기록은 빈 시간을 메우지 못한다', () => {
    // 오늘 밤 잘 시간을 미리 적어둔 상태로 낮에 보는 오늘
    const s = summarize(base([
      entry({ categoryId: 'c_sleep', startedAt: at(MON, '23:00'), endedAt: at(TUE, '00:00') }),
      entry({ id: 'b', startedAt: at(MON, '09:00'), endedAt: at(MON, '12:00') }),
    ]), MON, MON, at(MON, '12:00'));

    expect(s.totalMinutes).toBe(240);          // 적어둔 건 4시간이지만
    expect(s.elapsedMinutes).toBe(720);
    expect(s.untrackedMinutes).toBe(540);      // 흘러간 12시간 중 비어 있는 건 9시간
  });

  it('진행 중인 기록은 지금까지가 세어진다', () => {
    const s = summarize(base([
      entry({ startedAt: at(MON, '09:00'), endedAt: null }),
    ]), MON, MON, at(MON, '09:45'));

    expect(s.totalMinutes).toBe(45);
    expect(s.untrackedMinutes).toBe(540);             // 00:00~09:00
  });
});

describe('하루 평균', () => {
  it('아직 안 온 날로 평균을 깎지 않는다', () => {
    // 월·화 이틀만 지난 시점에서 보는 이번 주
    const s = summarize(base([
      entry({ startedAt: at(MON, '09:00'), endedAt: at(MON, '13:00') }),
      entry({ id: 'b', startedAt: at(TUE, '09:00'), endedAt: at(TUE, '11:00') }),
    ]), MON, SUN, at(TUE, '23:00'));

    expect(s.dailyAverageMinutes).toBe(180);   // 360분 ÷ 2일 (7일이 아니라)
  });
});

describe('주간 목표', () => {
  const gym: Category = {
    ...DEFAULT_CATEGORIES[5], weeklyGoalMinutes: 180, goalKind: '이상',
  };
  const phone: Category = {
    ...DEFAULT_CATEGORIES[7], weeklyGoalMinutes: 300, goalKind: '이하',
  };

  it("'이상'은 채워야 지킨 것", () => {
    expect(goalCheck(gym, 200, 7)?.ok).toBe(true);
    expect(goalCheck(gym, 100, 7)?.ok).toBe(false);
    expect(goalCheck(gym, 100, 7)?.rate).toBeCloseTo(100 / 180);
  });

  it("'이하'는 안 넘겨야 지킨 것 — 같은 숫자라도 반대다", () => {
    expect(goalCheck(phone, 200, 7)?.ok).toBe(true);
    expect(goalCheck(phone, 400, 7)?.ok).toBe(false);
  });

  it('기간이 한 주가 아니면 목표도 그만큼 환산한다', () => {
    expect(goalCheck(gym, 0, 14)?.targetMinutes).toBe(360);
    expect(goalCheck(gym, 0, 1)?.targetMinutes).toBeCloseTo(180 / 7);
  });

  it('목표를 안 잡았으면 null', () => {
    expect(goalCheck(DEFAULT_CATEGORIES[5], 100, 7)).toBeNull();
  });

  it('목표만 잡고 한 번도 안 한 분류는 0시간인 채로 보인다', () => {
    const s = summarize(
      { entries: [], categories: [...DEFAULT_CATEGORIES, gym] },
      MON, SUN, AFTER_WEEK,
    );
    const slice = s.byCategory.find(c => c.categoryId === gym.id);
    expect(slice).toMatchObject({ minutes: 0, ratio: 0 });
    expect(slice?.goal?.ok).toBe(false);
  });
});

describe('지난 기간 대비', () => {
  it('늘고 준 만큼 분으로 준다', () => {
    const now = at('2026-08-24', '00:00');
    const thisWeek = summarize(base([
      entry({ startedAt: at('2026-08-17', '09:00'), endedAt: at('2026-08-17', '12:00') }),
    ]), '2026-08-17', '2026-08-23', now);

    const lastWeek = summarize(base([
      entry({ startedAt: at(MON, '09:00'), endedAt: at(MON, '10:00') }),
      entry({ id: 'x', categoryId: 'c_kids', startedAt: at(TUE, '19:00'), endedAt: at(TUE, '20:00') }),
    ]), MON, SUN, now);

    const delta = compareByCategory(thisWeek, lastWeek);
    expect(delta.c_work).toBe(120);
    expect(delta.c_kids).toBeUndefined();   // 이번 주에 없는 분류는 줄에도 안 나온다
  });
});

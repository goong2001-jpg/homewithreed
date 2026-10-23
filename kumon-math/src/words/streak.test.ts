import { updateStreak, EMPTY_STREAK, MAX_FREEZES, isActiveToday, StreakState } from './streak';

// 2026-03-09 는 월요일
const MON = '2026-03-09', TUE = '2026-03-10', WED = '2026-03-11', THU = '2026-03-12', FRI = '2026-03-13';
const NEXT_MON = '2026-03-16', NEXT_TUE = '2026-03-17';

/** 이번 주 프리즈를 이미 받은 상태로 시작한다 (주간 지급과 분리해서 보기 위해) */
const base = (patch: Partial<StreakState> = {}): StreakState => ({
  ...EMPTY_STREAK, lastFreezeGrant: MON, ...patch,
});

describe('연속 학습 스트릭', () => {
  it('처음 공부하면 1일, 열기만 하면 0일', () => {
    expect(updateStreak(undefined, MON, false).current).toBe(0);
    const s = updateStreak(undefined, MON, true);
    expect(s.current).toBe(1);
    expect(s.best).toBe(1);
    expect(s.lastActiveDate).toBe(MON);
  });

  it('날마다 이어서 하면 하루씩 오르고, 같은 날 또 해도 더 오르지 않는다', () => {
    let s = updateStreak(base(), MON, true);
    s = updateStreak(s, MON, true);
    expect(s.current).toBe(1);
    s = updateStreak(s, TUE, true);
    s = updateStreak(s, WED, true);
    expect(s.current).toBe(3);
    expect(s.best).toBe(3);
    expect(isActiveToday(s, WED)).toBe(true);
    expect(isActiveToday(s, THU)).toBe(false);
    // 다음 날 열기만 하면 아직 살아 있다
    expect(updateStreak(s, THU, false).current).toBe(3);
  });

  it('하루 건너뛰어도 프리즈가 있으면 자동으로 쓰고 이어 간다', () => {
    let s = base({ current: 4, best: 4, lastActiveDate: MON, freezes: 1 });
    // 화요일 쉼, 수요일 열기만 함 — 아직 안 쓴다
    const peek = updateStreak(s, WED, false);
    expect(peek.current).toBe(4);
    expect(peek.freezes).toBe(1);
    // 수요일 공부 — 프리즈 하나 쓰고 5일
    s = updateStreak(s, WED, true);
    expect(s.current).toBe(5);
    expect(s.freezes).toBe(0);
    expect(s.lastActiveDate).toBe(WED);
  });

  it('하루 건너뛰었는데 프리즈가 없으면 끊긴다', () => {
    const s = base({ current: 4, best: 4, lastActiveDate: MON, freezes: 0 });
    expect(updateStreak(s, WED, false).current).toBe(0);
    const again = updateStreak(s, WED, true);
    expect(again.current).toBe(1);
    expect(again.best).toBe(4);
  });

  it('이틀 넘게 쉬면 프리즈가 있어도 끊긴다', () => {
    const s = base({ current: 9, best: 9, lastActiveDate: MON, freezes: 2 });
    const idle = updateStreak(s, THU, false);
    expect(idle.current).toBe(0);
    expect(idle.freezes).toBe(2);
    const active = updateStreak(s, FRI, true);
    expect(active.current).toBe(1);
    expect(active.freezes).toBe(2);
  });

  it('프리즈는 주마다 하나씩, 최대 두 개까지', () => {
    let s = updateStreak(undefined, MON, true);
    expect(s.freezes).toBe(1);
    expect(s.lastFreezeGrant).toBe(MON);
    s = updateStreak(s, FRI, true);          // 같은 주 — 더 안 준다
    expect(s.freezes).toBe(1);
    s = updateStreak(s, NEXT_MON, false);    // 새 주 — 열기만 해도 받는다
    expect(s.freezes).toBe(2);
    s = updateStreak({ ...s, lastFreezeGrant: '2026-02-01' }, NEXT_TUE, false);
    expect(s.freezes).toBe(MAX_FREEZES);     // 둘 넘게는 못 모은다
  });

  it('새 주에 받은 프리즈로 주말에 건너뛴 하루를 메운다', () => {
    // 금요일까지 하고 토요일 쉼, 일요일 공부 — 이번 주 프리즈는 이미 썼지만
    // 지난주와 다른 주라 새로 받은 하나를 바로 쓴다
    const SUN = '2026-03-15';
    let s = base({ current: 5, best: 5, lastActiveDate: FRI, freezes: 0, lastFreezeGrant: '2026-03-02' });
    s = updateStreak(s, SUN, true);
    expect(s.current).toBe(6);
    expect(s.freezes).toBe(0);
    expect(s.lastActiveDate).toBe(SUN);
  });

  it('예전 저장 데이터에 빠진 값이 있어도 기본값으로 채운다', () => {
    const s = updateStreak({ current: 2, lastActiveDate: MON } as any, TUE, true);
    expect(s.current).toBe(3);
    expect(s.best).toBe(3);
    expect(s.freezes).toBe(1);
  });
});

import { isActive, IDLE_MS } from './studyTime';
import { minutesOf, EMPTY_DAY, isStudyDay } from './log';

describe('공부 시간', () => {
  it('화면이 보이고 최근에 만졌을 때만 센다', () => {
    expect(isActive(100_000, 90_000, true)).toBe(true);
    expect(isActive(100_000 + IDLE_MS, 100_000, true)).toBe(false);
    expect(isActive(100_000, 90_000, false)).toBe(false);
    expect(isActive(100_000, 0, true)).toBe(false);
  });

  it('하루 영어 시간 = 앱 시간(분) + 앱 밖 시간', () => {
    expect(minutesOf({ ...EMPTY_DAY, appSec: 125, offMin: 10 })).toBe(12);
    expect(minutesOf(undefined)).toBe(0);
  });

  it('앱 밖 시간만 있어도 공부한 날이다', () => {
    expect(isStudyDay({ ...EMPTY_DAY, offMin: 10 })).toBe(true);
    expect(isStudyDay({ ...EMPTY_DAY, appSec: 30 })).toBe(false);
  });
});

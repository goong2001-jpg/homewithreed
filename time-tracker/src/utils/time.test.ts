import {
  addDays, addMonths, clock, clockOfMinutes, dayKeyOf, dayLabel, daysBetween, deltaText,
  durationText, endOfDay, listDays, minutesOfDay, monthEnd, monthStart, parseClock,
  rangeLabel, shortDuration, startOfDay, stopwatch, todayKey, weekStart, weekdayName,
} from './time';

describe('날짜 키', () => {
  it('지역시각 기준으로 오늘을 읽는다', () => {
    expect(todayKey(new Date(2026, 7, 13, 1, 30))).toBe('2026-08-13');
  });

  it('새벽 1시는 아직 그 전날이 아니라 그 날이다', () => {
    // UTC로 잘랐다면 2026-08-12로 밀렸을 시각
    expect(dayKeyOf(new Date(2026, 7, 13, 0, 10).getTime())).toBe('2026-08-13');
  });

  it('startOfDay는 그 날 00:00, endOfDay는 다음날 00:00', () => {
    expect(startOfDay('2026-08-13')).toBe(new Date(2026, 7, 13).getTime());
    expect(endOfDay('2026-08-13')).toBe(new Date(2026, 7, 14).getTime());
    expect(endOfDay('2026-08-13') - startOfDay('2026-08-13')).toBe(86_400_000);
  });

  it('월·연을 넘겨서 더한다', () => {
    expect(addDays('2026-08-31', 1)).toBe('2026-09-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
    expect(daysBetween('2026-08-01', '2026-08-13')).toBe(12);
    expect(daysBetween('2026-08-13', '2026-08-01')).toBe(-12);
  });

  it('말일은 그 달의 마지막 날로 당긴다', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(monthEnd('2028-02-10')).toBe('2028-02-29');   // 윤년
    expect(monthStart('2026-08-13')).toBe('2026-08-01');
  });
});

describe('주 계산', () => {
  it('한 주는 월요일에 시작한다', () => {
    expect(weekStart('2026-08-13')).toBe('2026-08-10');   // 목 → 월
    expect(weekStart('2026-08-10')).toBe('2026-08-10');   // 월 → 그대로
  });

  it('일요일은 지난 월요일에 붙는다 — 주말이 두 주로 쪼개지지 않게', () => {
    expect(weekdayName('2026-08-16')).toBe('일');
    expect(weekStart('2026-08-16')).toBe('2026-08-10');
  });

  it('listDays는 양끝을 포함한다', () => {
    const days = listDays('2026-08-10', '2026-08-16');
    expect(days).toHaveLength(7);
    expect(days[0]).toBe('2026-08-10');
    expect(days[6]).toBe('2026-08-16');
    expect(listDays('2026-08-16', '2026-08-10')).toEqual([]);
  });
});

describe('시각 읽기', () => {
  it('여러 모양으로 적어도 같은 분으로 읽는다', () => {
    expect(parseClock('9:30')).toBe(570);
    expect(parseClock('09:30')).toBe(570);
    expect(parseClock('0930')).toBe(570);
    expect(parseClock('930')).toBe(570);
    expect(parseClock('9')).toBe(540);
    expect(parseClock(' 23:59 ')).toBe(1439);
  });

  it('시각이 아닌 건 null', () => {
    expect(parseClock('')).toBeNull();
    expect(parseClock('25:00')).toBeNull();
    expect(parseClock('12:60')).toBeNull();
    expect(parseClock('아홉시')).toBeNull();
  });

  it('분 ↔ HH:MM', () => {
    expect(clockOfMinutes(570)).toBe('09:30');
    expect(clockOfMinutes(0)).toBe('00:00');
    expect(clockOfMinutes(1440)).toBe('00:00');   // 자정을 넘겨도 안 깨진다
    expect(clock(new Date(2026, 7, 13, 9, 5).getTime())).toBe('09:05');
    expect(minutesOfDay(new Date(2026, 7, 13, 9, 5).getTime())).toBe(545);
  });
});

describe('길이 표기', () => {
  it('시간과 분을 사람이 읽는 대로', () => {
    expect(durationText(0)).toBe('0분');
    expect(durationText(45)).toBe('45분');
    expect(durationText(120)).toBe('2시간');
    expect(durationText(90)).toBe('1시간 30분');
    expect(durationText(-5)).toBe('0분');       // 음수가 새어나가도 화면은 안 깨진다
  });

  it('좁은 자리에서는 짧게', () => {
    expect(shortDuration(45)).toBe('45m');
    expect(shortDuration(120)).toBe('2h');
    expect(shortDuration(150)).toBe('2h30');
  });

  it('증감은 부호를 붙여서', () => {
    expect(deltaText(80)).toBe('+1시간 20분');
    expect(deltaText(-35)).toBe('−35분');
    expect(deltaText(0)).toBe('그대로');
  });

  it('타이머는 초까지 보여준다', () => {
    expect(stopwatch(0)).toBe('00:00');
    expect(stopwatch(65_000)).toBe('01:05');
    expect(stopwatch(3_661_000)).toBe('1:01:01');
  });
});

describe('이름표', () => {
  it('가까운 날은 이름으로 부른다', () => {
    expect(dayLabel('2026-08-13', '2026-08-13')).toBe('오늘');
    expect(dayLabel('2026-08-12', '2026-08-13')).toBe('어제');
    expect(dayLabel('2026-08-10', '2026-08-13')).toBe('8월 10일 (월)');
  });

  it('기간은 겹치는 부분을 접어서 쓴다', () => {
    expect(rangeLabel('2026-08-10', '2026-08-16')).toBe('8월 10일 ~ 16일');
    expect(rangeLabel('2026-08-31', '2026-09-06')).toBe('8월 31일 ~ 9월 6일');
    expect(rangeLabel('2026-08-01', '2026-08-31')).toBe('2026년 8월');
  });
});

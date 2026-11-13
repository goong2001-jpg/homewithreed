import { logDay, readLog, lastDays, sumDays, weekOf, isStudyDay, logConfusion, readConfusions, topConfusions } from './log';

beforeEach(() => { localStorage.clear(); });

describe('하루 기록', () => {
  it('오늘 칸에 더하고, 오래된 날은 지운다', () => {
    logDay('cards', 3, '2026-01-01');
    logDay('cards', 2, '2026-11-10');
    logDay('right', 1, '2026-11-10');
    const log = readLog();
    expect(log['2026-11-10']).toMatchObject({ cards: 2, right: 1, wrong: 0 });
    expect(log['2026-01-01']).toBeUndefined();
  });

  it('최근 n 일과 합계', () => {
    logDay('cards', 10, '2026-11-09');
    logDay('earned', 2, '2026-11-09');
    logDay('games', 1, '2026-11-11');
    logDay('used', 1, '2026-11-11');
    const days = lastDays(readLog(), 3, '2026-11-11');
    expect(days.map(d => d.date)).toEqual(['2026-11-09', '2026-11-10', '2026-11-11']);
    expect(isStudyDay(days[1].log)).toBe(false);
    expect(sumDays(days.map(d => d.log))).toMatchObject({ cards: 10, earned: 2, used: 1, games: 1, studyDays: 2 });
  });

  it('한 주는 월요일부터 일요일까지', () => {
    // 2026-11-11 은 수요일
    const week = weekOf({}, '2026-11-11');
    expect(week.map(d => d.date)).toEqual([
      '2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14', '2026-11-15',
    ]);
    expect(weekOf({}, '2026-11-15')[0].date).toBe('2026-11-09');
    expect(weekOf({}, '2026-11-16')[0].date).toBe('2026-11-16');
  });
});

describe('헷갈린 짝', () => {
  it('a-b 와 b-a 를 한 짝으로 합쳐 많이 헷갈린 순서로 준다', () => {
    logConfusion('cat', 'cap');
    logConfusion('cap', 'cat');
    logConfusion('sun', 'six');
    logConfusion('dog', 'dog'); // 같은 단어는 적지 않는다
    const top = topConfusions(readConfusions());
    expect(top).toHaveLength(2);
    expect(top[0]).toMatchObject({ count: 2 });
    expect([top[0].a, top[0].b].sort()).toEqual(['cap', 'cat']);
  });
});

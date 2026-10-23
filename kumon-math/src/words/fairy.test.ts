import { fairyLine } from './fairy';
import { StreakState } from './streak';

const T = '2026-03-10';
const streak = (current: number, active = true): StreakState => ({
  current, best: current, lastActiveDate: active ? T : '2026-03-09', freezes: 0, lastFreezeGrant: T,
});

describe('요정의 기억', () => {
  it('말할 거리가 없으면 null (평소 말풍선)', () => {
    expect(fairyLine({ today: T, word: 'cat' })).toBeNull();
  });

  it('미션 3개를 다 하면 그게 먼저', () => {
    expect(fairyLine({ today: T, missionsDone: true, yesterdayMissed: ['cat'], todayCorrect: ['cat'] }))
      .toBe('오늘 미션 다 했어! 최고야 🏆');
  });

  it('어제 틀린 단어를 오늘 맞히면 기억해 준다', () => {
    const line = fairyLine({ today: T, yesterdayMissed: ['dog', 'cat'], todayMissed: ['dog', 'cat'], todayCorrect: ['cat'] });
    expect(line).toBe('어제 틀린 cat, 오늘은 맞췄네! 👏');
  });

  it('더 전에 틀린 단어를 맞히면 "지난번"이라고 한다', () => {
    const line = fairyLine({ today: T, yesterdayMissed: [], todayMissed: ['sun'], todayCorrect: ['sun'] });
    expect(line).toBe('지난번에 틀린 sun, 이번엔 맞췄어! 👏');
    // 아직 못 맞혔으면 말하지 않는다
    expect(fairyLine({ today: T, todayMissed: ['sun'], todayCorrect: [] })).toBeNull();
  });

  it('연속 학습 기념일에는 축하한다 (오늘 공부한 뒤에만)', () => {
    expect(fairyLine({ today: T, streak: streak(5) })).toBe('🔥 5일 연속 공부! 정말 대단해!');
    expect(fairyLine({ today: T, streak: streak(4) })).toBeNull();
    expect(fairyLine({ today: T, streak: streak(5, false) })).toBeNull();
  });

  it('4번 상자에 오른 단어는 완전히 익힌 단어', () => {
    const srs = { dog: { box: 4, nextDue: '2026-03-24', correct: 4, wrong: 0 }, cat: { box: 2, nextDue: T, correct: 2, wrong: 0 } };
    expect(fairyLine({ today: T, word: 'dog', srs })).toBe('dog는 이제 완전 네 거야! 💎');
    expect(fairyLine({ today: T, word: 'cat', srs })).toBeNull();
    // 지금 카드가 아니어도 오늘 단어 중에 있으면 말한다
    expect(fairyLine({ today: T, word: 'cat', todayWords: ['cat', 'dog'], srs })).toBe('dog는 이제 완전 네 거야! 💎');
  });

  it('오늘 첫 인사는 어제 배운 개수를 말한다', () => {
    expect(fairyLine({ today: T, firstVisit: true, yesterdayLearned: 8 })).toBe('어제 8개 배웠지? 오늘도 가보자 💪');
    expect(fairyLine({ today: T, firstVisit: true, yesterdayLearned: 0 })).toBe('오늘도 만나서 반가워! 같이 해보자 🧚');
    expect(fairyLine({ today: T, firstVisit: false, yesterdayLearned: 8 })).toBeNull();
  });

  it('같은 상황이면 늘 같은 말을 한다', () => {
    const ctx = { today: T, yesterdayMissed: ['cat'], todayCorrect: ['cat'], streak: streak(5) };
    expect(fairyLine(ctx)).toBe(fairyLine(ctx));
  });
});

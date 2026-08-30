import { DEFAULT_FRIENDS, DEFAULT_PROFILE } from '../data/defaults';
import {
  detectIntent,
  isNewSession,
  normalize,
  reply,
  ReplyContext,
  SESSION_GAP_MINUTES,
  WIND_DOWN_TURNS,
} from './replyEngine';

const ctx = (over: Partial<ReplyContext> = {}): ReplyContext => ({
  friend: DEFAULT_FRIENDS[0],
  profile: DEFAULT_PROFILE,
  turn: 1,
  seed: 0,
  ...over,
});

describe('normalize', () => {
  it('공백과 문장부호를 걷어낸다', () => {
    expect(normalize('  응!!! 했어요~ ')).toBe('응했어요');
  });

  it('자모는 살린다 — 아이들이 제일 많이 친다', () => {
    expect(normalize('ㅇㅇ')).toBe('ㅇㅇ');
    expect(normalize('ㄴㄴ')).toBe('ㄴㄴ');
  });

  it('늘여 쓴 글자를 줄인다', () => {
    expect(normalize('ㅋㅋㅋㅋㅋㅋ')).toBe('ㅋㅋ');
    expect(normalize('응응응응')).toBe('응응');
  });
});

describe('detectIntent', () => {
  const cases: [string, string][] = [
    ['ㅇㅇ', 'yes'],
    ['응', 'yes'],
    ['네!', 'yes'],
    ['양치했어', 'yes'],
    ['다했어요', 'yes'],
    ['ㄴㄴ', 'no'],
    ['아니', 'no'],
    ['아직 안했어', 'no'],
    ['밥 안먹었어', 'no'],
    ['숙제 못했어', 'no'],
    ['하기싫어', 'no'],
    ['졸려...', 'sleepy'],
    ['배고파', 'hungry'],
    ['심심해', 'bored'],
    ['배아파', 'sick'],
    ['슬퍼', 'sad'],
    ['짜증나', 'angry'],
    ['무서워', 'scared'],
    ['안녕!', 'greeting'],
    ['잘가', 'bye'],
    ['너 누구야?', 'who'],
    ['뭐해?', 'doing'],
    ['오늘 학교에서', 'school'],
    ['고마워', 'thanks'],
    ['사랑해', 'love'],
    ['ㅋㅋㅋ', 'laugh'],
    ['바보', 'rough'],
    ['', 'empty'],
    ['갸울뚱캬', 'unknown'],
  ];

  it.each(cases)('%s → %s', (input, intent) => {
    expect(detectIntent(input)).toBe(intent);
  });
});

describe('reply', () => {
  it('모르는 말에도 반드시 뭔가 답한다', () => {
    const r = reply('갸울뚱캬푸', ctx());
    expect(r.text.length).toBeGreaterThan(0);
    expect(r.closing).toBe(false);
  });

  it('아이 이름을 채워 넣는다', () => {
    const r = reply('칭찬해줘', ctx({ profile: { ...DEFAULT_PROFILE, childName: '구름' }, seed: 1 }));
    expect(r.text).not.toContain('{{');
  });

  it('험한 말은 혼내지 않고 화제를 돌린다', () => {
    const r = reply('바보야', ctx());
    expect(r.intent).toBe('rough');
    expect(r.closing).toBe(false);
  });

  it('험한 말은 마무리 차례여도 먼저 받아준다', () => {
    const r = reply('바보야', ctx({ turn: WIND_DOWN_TURNS + 3 }));
    expect(r.intent).toBe('rough');
    expect(r.closing).toBe(false);
  });

  it('대화가 길어지면 "나중에 또 연락하자"로 접는다', () => {
    const r = reply('그래서 있잖아', ctx({ turn: WIND_DOWN_TURNS }));
    expect(r.closing).toBe(true);
    expect(r.text).toMatch(/연락|톡|가/);
  });

  it('아이가 먼저 인사하고 가면 바로 접는다', () => {
    const r = reply('잘가', ctx({ turn: 1 }));
    expect(r.closing).toBe(true);
  });

  it('최근에 쓴 문장은 다시 쓰지 않는다', () => {
    const first = reply('응', ctx({ seed: 0 }));
    const second = reply('응', ctx({ seed: 0, recent: [first.text.replace(/ [✨💛]$/, '')] }));
    expect(second.text).not.toBe(first.text);
  });

  it('빈 입력도 죽지 않는다', () => {
    expect(reply('   ', ctx()).intent).toBe('empty');
  });
});

describe('isNewSession', () => {
  const now = Date.now();
  it('처음이면 새 대화다', () => {
    expect(isNewSession(0, now)).toBe(true);
  });
  it('오래 조용했으면 새 대화다', () => {
    expect(isNewSession(now - (SESSION_GAP_MINUTES + 1) * 60_000, now)).toBe(true);
  });
  it('방금 말했으면 이어지는 대화다', () => {
    expect(isNewSession(now - 60_000, now)).toBe(false);
  });
});

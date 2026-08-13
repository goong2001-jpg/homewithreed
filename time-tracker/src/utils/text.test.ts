import { hasFinalConsonant, object, subject, topic } from './text';

describe('한국어 조사', () => {
  it('받침이 있으면 은/이/을', () => {
    expect(hasFinalConsonant('오전')).toBe(true);
    expect(topic('오전')).toBe('은');
    expect(subject('블록')).toBe('이');
    expect(object('저녁')).toBe('을');
  });

  it('받침이 없으면 는/가/를', () => {
    expect(hasFinalConsonant('오후')).toBe(false);
    expect(topic('오후')).toBe('는');
    expect(subject('아침나절')).toBe('이');
    expect(topic('새벽')).toBe('은');
    expect(object('공부')).toBe('를');
  });

  it('한글이 아니면 받침 없는 쪽으로 (숫자·영문 이름을 써도 안 깨지게)', () => {
    expect(topic('Deep Work')).toBe('는');
    expect(topic('')).toBe('는');
    expect(topic('블록2')).toBe('는');
  });
});

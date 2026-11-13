import { distance, heardWord, normalize } from './hearing';

describe('따라 말하기 채점', () => {
  it('글자만 남긴다', () => {
    expect(normalize('Yo-Yo!')).toBe('yoyo');
    expect(normalize('Ice cream')).toBe('icecream');
  });

  it('편집 거리', () => {
    expect(distance('cat', 'cat')).toBe(0);
    expect(distance('cat', 'cap')).toBe(1);
    expect(distance('apple', 'apply')).toBe(1);
    expect(distance('', 'abc')).toBe(3);
  });

  it('후보 가운데 하나라도 맞으면 맞다', () => {
    expect(heardWord('apple', ['a pull', 'apple'])).toBe(true);
    expect(heardWord('ice cream', ['I scream', 'ice cream'])).toBe(true);
    expect(heardWord('dog', ['I see a dog'])).toBe(true);
  });

  it('긴 단어는 한두 글자 차이를 봐준다', () => {
    expect(heardWord('apple', ['apply'])).toBe(true);
    expect(heardWord('elephant', ['elefant'])).toBe(true);
  });

  it('짧은 단어는 정확해야 하고, 다른 단어는 틀리다', () => {
    expect(heardWord('cat', ['cap'])).toBe(false);
    expect(heardWord('apple', ['banana'])).toBe(false);
    expect(heardWord('apple', [])).toBe(false);
  });
});

import { BOOKS, isDecodable, tokenize, unlockedBooks, lettersUpTo } from './books';
import { UNITS } from './units';

describe('구름이 책장', () => {
  it('소리 단계마다 한 권씩 있다', () => {
    expect(BOOKS.map(b => b.unit)).toEqual(UNITS.map((_, i) => i));
    expect(new Set(BOOKS.map(b => b.id)).size).toBe(BOOKS.length);
  });

  it('모든 낱말은 그 단계까지 배운 소리로 읽을 수 있다 (디코더블)', () => {
    const bad: string[] = [];
    for (const b of BOOKS) {
      for (const p of b.pages) {
        for (const t of tokenize(p.en)) {
          if (!isDecodable(t.clean, b.unit)) bad.push(`${b.id}: ${t.clean}`);
        }
      }
    }
    expect(bad).toEqual([]);
  });

  it('책은 4~6쪽이고 쪽마다 1~2문장, 뜻이 있다', () => {
    for (const b of BOOKS) {
      expect(b.pages.length).toBeGreaterThanOrEqual(4);
      expect(b.pages.length).toBeLessThanOrEqual(6);
      for (const p of b.pages) {
        expect(p.ko.length).toBeGreaterThan(0);
        expect(p.en.split(/[.!?]/).filter(s => s.trim()).length).toBeLessThanOrEqual(2);
      }
    }
  });

  it('1권은 첫 단계에서 다음 단계 소리(t p)까지 쓴다', () => {
    expect(Array.from(lettersUpTo(0)).sort().join('')).toBe('apst');
    expect(isDecodable('pat', 0)).toBe(true);
    expect(isDecodable('pin', 0)).toBe(false);
  });

  it('지금 단계까지의 책만 열린다', () => {
    expect(unlockedBooks(0).map(b => b.id)).toEqual(['spa']);
    expect(unlockedBooks(2)).toHaveLength(3);
  });

  it('문장부호를 떼고 낱말로 나눈다', () => {
    expect(tokenize('Tap, tap, tap!').map(t => t.clean)).toEqual(['tap', 'tap', 'tap']);
  });
});

import { UNITS } from './units';
import { wordsOfSound } from './dailySet';

describe('소리 단계표', () => {
  it('같은 글자가 두 단계에 나오지 않는다', () => {
    const seen = new Map<string, number>();
    UNITS.forEach((pair, i) => {
      pair.forEach(sound => {
        sound.letters.forEach(letter => {
          expect(seen.has(letter) ? `'${letter}' 가 ${seen.get(letter)! + 1}단계와 ${i + 1}단계에 겹친다` : '').toBe('');
          seen.set(letter, i);
        });
      });
    });
  });

  it('모든 소리에 배울 단어가 하나 이상 있다', () => {
    UNITS.flat().forEach(sound => {
      expect(wordsOfSound(sound).length).toBeGreaterThan(0);
    });
  });
});

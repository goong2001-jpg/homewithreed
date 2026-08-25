import { useCallback, useState } from 'react';

const KEY = 'alphabet_progress';

export type LetterCase = 'upper' | 'lower';

export interface AlphabetProgress {
  /** 완성한 글자들 — 'A', 'a' 처럼 대소문자 구분해서 저장 */
  mastered: string[];
  /** 알파벳 놀이에서 모은 별 */
  stars: number;
  /** 마지막으로 보던 글자 번호(0=A) */
  index: number;
  /** 대문자/소문자 모드 */
  letterCase: LetterCase;
}

const DEFAULT: AlphabetProgress = { mastered: [], stars: 0, index: 0, letterCase: 'upper' };

function load(): AlphabetProgress {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULT, ...JSON.parse(raw) };
  } catch {}
  return DEFAULT;
}

export function useAlphabetProgress() {
  const [progress, setProgress] = useState<AlphabetProgress>(load);

  const update = useCallback((patch: Partial<AlphabetProgress>) => {
    setProgress(prev => {
      const next = { ...prev, ...patch };
      try { localStorage.setItem(KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  /** 글자를 완성했을 때 — 처음 완성하면 별 5개, 다시 하면 1개 */
  const completeLetter = useCallback((letter: string): { earned: number; isFirst: boolean } => {
    const isFirst = !progress.mastered.includes(letter);
    const earned = isFirst ? 5 : 1;
    update({
      mastered: isFirst ? [...progress.mastered, letter] : progress.mastered,
      stars: progress.stars + earned,
    });
    return { earned, isFirst };
  }, [progress.mastered, progress.stars, update]);

  const setIndex = useCallback((index: number) => update({ index }), [update]);
  const setLetterCase = useCallback((letterCase: LetterCase) => update({ letterCase }), [update]);

  return { progress, completeLetter, setIndex, setLetterCase };
}

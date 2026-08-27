import { useCallback, useState } from 'react';

const KEY = 'alphabet_progress';

export type LetterCase = 'upper' | 'lower';
/** stroke = 획순대로 쓰기, trace = 자유롭게 따라 그리기 */
export type PracticeMode = 'stroke' | 'trace';

export interface AlphabetProgress {
  /** 완성한 글자들 — 'A', 'a' 처럼 대소문자 구분해서 저장 */
  mastered: string[];
  /** 마지막으로 보던 글자 번호(0=A) */
  index: number;
  /** 대문자/소문자 모드 */
  letterCase: LetterCase;
  /** 연습 방식 */
  mode: PracticeMode;
  /** 지금까지 쓴 글자 총 개수 (같은 글자를 또 써도 늘어난다) */
  totalWritten: number;
}

const DEFAULT: AlphabetProgress = { mastered: [], index: 0, letterCase: 'upper', mode: 'stroke', totalWritten: 0 };

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

  /**
   * 글자를 완성했을 때 — 처음 완성하면 별 5개, 다시 하면 1개.
   * 별 적립 자체는 수학놀이와 공유하는 지갑(useGameState)에서 처리한다.
   */
  const completeLetter = useCallback((letter: string): { earned: number; isFirst: boolean } => {
    const isFirst = !progress.mastered.includes(letter);
    const earned = isFirst ? 5 : 1;
    update({
      mastered: isFirst ? [...progress.mastered, letter] : progress.mastered,
      totalWritten: progress.totalWritten + 1,
    });
    return { earned, isFirst };
  }, [progress.mastered, progress.totalWritten, update]);

  const setIndex = useCallback((index: number) => update({ index }), [update]);
  const setLetterCase = useCallback((letterCase: LetterCase) => update({ letterCase }), [update]);
  const setMode = useCallback((mode: PracticeMode) => update({ mode }), [update]);

  return { progress, completeLetter, setIndex, setLetterCase, setMode };
}

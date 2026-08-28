import { useCallback, useState } from 'react';

const KEY = 'alphabet_progress';

/** mixed = A a B b 처럼 번갈아, upper = 대문자만, lower = 소문자만 */
export type LetterCase = 'mixed' | 'upper' | 'lower';
/** stroke = 획순대로 쓰기, trace = 자유롭게 따라 그리기 */
export type PracticeMode = 'stroke' | 'trace';

export interface AlphabetProgress {
  /** 완성한 글자들 — 'A', 'a' 처럼 대소문자 구분해서 저장 */
  mastered: string[];
  /** 연습 순서에서 지금 몇 번째인지 */
  index: number;
  /** 대문자/소문자 모드 */
  letterCase: LetterCase;
  /** 연습 방식 */
  mode: PracticeMode;
  /** 지금까지 쓴 글자 총 개수 (같은 글자를 또 써도 늘어난다) */
  totalWritten: number;
  /** 대소문자 번갈아 순서로 한 번 옮겼는지 (예전 저장 데이터 호환용) */
  mixedMigrated?: boolean;
}

const DEFAULT: AlphabetProgress = {
  mastered: [], index: 0, letterCase: 'mixed', mode: 'stroke', totalWritten: 0,
  // 새로 시작하는 경우는 이미 번갈아 순서이므로 변환할 필요가 없다.
  // (이 표시가 없으면 앱을 열 때마다 변환이 다시 돌아 위치가 엉킨다)
  mixedMigrated: true,
};

function load(): AlphabetProgress {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const saved: AlphabetProgress = { ...DEFAULT, ...parsed };
      // 예전에는 대문자/소문자를 따로 돌았다. 한 번만 'A a B b' 순서로 옮겨준다.
      if (!parsed.mixedMigrated) {
        const wasLower = saved.letterCase === 'lower';
        saved.index = Math.min(saved.index, 25) * 2 + (wasLower ? 1 : 0);
        saved.letterCase = 'mixed';
        saved.mixedMigrated = true;
      }
      return saved;
    }
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

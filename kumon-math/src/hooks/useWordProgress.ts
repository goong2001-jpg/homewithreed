import { useCallback, useState } from 'react';
import { CouponId } from '../words/coupons';
import { todayKey } from '../words/dailySet';

const KEY = 'word_progress';

export type Phase = 'learn' | 'test' | 'done';

export interface CouponEvent {
  id: CouponId;
  /** 'earn' = 받음, 'use' = 사용함 */
  type: 'earn' | 'use';
  at: string;
}

export interface WordProgress {
  /** 오늘 날짜 — 날이 바뀌면 새 단어로 처음부터 */
  date: string;
  /** 오늘 단어를 몇 개까지 봤는지 */
  learned: number;
  phase: Phase;
  /** 단어 묶음 번호 — 올라가면 완전히 새로운 단어 10개를 받는다 */
  round: number;
  /** 같은 단어 묶음으로 다시 도전한 횟수 — 단어는 그대로, 문제만 바뀐다 */
  attempt: number;
  /** 이번 회차 정답 여부 */
  results: boolean[];
  /** 쿠폰을 받은 날짜 */
  rewardedDate: string;
  /** 그날 쿠폰을 받은 회차들 — 같은 회차로 두 번 받지 못하게 한다 */
  rewardedRounds: number[];
  /** 지금까지 배운 단어 수 (누적) */
  totalLearned: number;
  /** 가진 쿠폰 개수 */
  coupons: Partial<Record<CouponId, number>>;
  /** 받은/쓴 기록 (최근 것부터) */
  history: CouponEvent[];
}

/**
 * 하루에 받을 수 있는 쿠폰 수.
 * 쿠폰 때문에 더 하고 싶어 하는 만큼, 하루 여덟 번까지 열어 둔다.
 * (숫자만 바꾸면 늘리거나 줄일 수 있다)
 */
export const MAX_COUPONS_PER_DAY = 8;

const DEFAULT: WordProgress = {
  date: '', learned: 0, phase: 'learn', round: 0, attempt: 0, results: [],
  rewardedDate: '', rewardedRounds: [], totalLearned: 0, coupons: {}, history: [],
};

function load(): WordProgress {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const saved: WordProgress = { ...DEFAULT, ...JSON.parse(raw) };
      // 날이 바뀌면 오늘 치만 초기화한다 (쿠폰과 누적 기록은 그대로)
      if (saved.date !== todayKey()) {
        return {
          ...saved, date: todayKey(), learned: 0, phase: 'learn',
          round: 0, attempt: 0, results: [], rewardedRounds: [],
        };
      }
      return saved;
    }
  } catch {}
  return { ...DEFAULT, date: todayKey() };
}

export function useWordProgress() {
  const [progress, setProgress] = useState<WordProgress>(load);

  const save = useCallback((next: WordProgress) => {
    setProgress(next);
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch {}
  }, []);

  const update = useCallback((patch: Partial<WordProgress>) => {
    setProgress(prev => {
      const next = { ...prev, ...patch };
      try { localStorage.setItem(KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  /** 단어 하나를 다 봤을 때 */
  const learnNext = useCallback((perDay: number) => {
    setProgress(prev => {
      const learned = Math.min(prev.learned + 1, perDay);
      const next: WordProgress = {
        ...prev,
        learned,
        totalLearned: prev.totalLearned + 1,
        phase: learned >= perDay ? 'test' : 'learn',
      };
      try { localStorage.setItem(KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  /** 문제 하나를 풀었을 때 */
  const answer = useCallback((correct: boolean) => {
    setProgress(prev => {
      const next = { ...prev, results: [...prev.results, correct] };
      try { localStorage.setItem(KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  /**
   * 다시 도전 — 단어는 그대로 두고 10개를 처음부터 다시 보여준다.
   * 틀린 아이에게 본 적 없는 단어를 내밀면 더 어려워지기만 한다.
   */
  const retryTest = useCallback(() => {
    update({ learned: 0, phase: 'learn', attempt: progress.attempt + 1, results: [] });
  }, [progress.attempt, update]);

  /** 쿠폰 받기 — 회차마다 한 장씩, 하루 최대 MAX_COUPONS_PER_DAY 장 */
  const earnCoupon = useCallback((id: CouponId): boolean => {
    const today = todayKey();
    const rounds = progress.rewardedDate === today ? progress.rewardedRounds : [];
    if (rounds.includes(progress.round)) return false;      // 이 회차는 이미 받음
    if (rounds.length >= MAX_COUPONS_PER_DAY) return false;  // 오늘치 다 받음
    const next: WordProgress = {
      ...progress,
      rewardedDate: today,
      rewardedRounds: [...rounds, progress.round],
      // 화면은 그대로 둔다. 여기서 'done'으로 바꾸면 방금 뽑은 쿠폰이
      // 곧바로 사라져서 아이가 무엇을 받았는지 볼 수 없다.
      coupons: { ...progress.coupons, [id]: (progress.coupons[id] ?? 0) + 1 },
      history: [{ id, type: 'earn' as const, at: today }, ...progress.history].slice(0, 60),
    };
    save(next);
    return true;
  }, [progress, save]);

  /** 쿠폰 사용 */
  const useCoupon = useCallback((id: CouponId): boolean => {
    const have = progress.coupons[id] ?? 0;
    if (have <= 0) return false;
    const next: WordProgress = {
      ...progress,
      coupons: { ...progress.coupons, [id]: have - 1 },
      history: [{ id, type: 'use' as const, at: todayKey() }, ...progress.history].slice(0, 60),
    };
    save(next);
    return true;
  }, [progress, save]);

  const finishWithoutCoupon = useCallback(() => update({ phase: 'done' }), [update]);

  /** 오늘 것을 또 연습 (쿠폰은 안 나온다) */
  const practiceAgain = useCallback(() => {
    update({
      learned: 0, phase: 'learn',
      round: progress.round + 1, attempt: 0, results: [],
    });
  }, [progress.round, update]);

  const totalCoupons = Object.values(progress.coupons).reduce<number>((s, n) => s + (n ?? 0), 0);
  const roundsToday = progress.rewardedDate === todayKey() ? progress.rewardedRounds : [];
  /** 이번 회차로 이미 쿠폰을 받았는지 */
  const rewardedThisRound = roundsToday.includes(progress.round);
  /** 오늘 받은 쿠폰 수 / 남은 수 */
  const couponsToday = roundsToday.length;
  const couponsLeftToday = Math.max(0, MAX_COUPONS_PER_DAY - couponsToday);

  return {
    progress, learnNext, answer, retryTest, earnCoupon, useCoupon,
    finishWithoutCoupon, practiceAgain, totalCoupons,
    rewardedThisRound, couponsToday, couponsLeftToday, update,
  };
}

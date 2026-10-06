import { useCallback, useState } from 'react';
import { CouponId } from '../words/coupons';
import { todayKey, TEST_COUNT, MAX_MISSED_PER_DAY, DayPlan } from '../words/dailySet';
import { UNITS, DAYS_PER_UNIT } from '../words/units';

const FRESH_QUEUE = () => Array.from({ length: TEST_COUNT }, (_, i) => i);

const KEY = 'word_progress';

export type Phase = 'learn' | 'test' | 'done';

export interface CouponEvent {
  id: CouponId;
  /** 'earn' = 받음, 'use' = 사용함, 'trade' = 다른 쿠폰 두 장과 바꿔서 받음 */
  type: 'earn' | 'use' | 'trade';
  at: string;
  /** trade 일 때 내준 쿠폰 */
  from?: CouponId;
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
  /**
   * 아직 맞혀야 할 문제 번호들(앞에서부터 낸다).
   * 틀린 문제는 맨 뒤로 다시 넣어서, 다른 문제를 풀고 난 뒤 한 번 더 묻는다.
   */
  queue: number[];
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
  /**
   * 오답 노트 — 틀린 단어와 틀린 날짜.
   * 다음 날부터 오늘의 단어와 문제에 먼저 다시 나오고,
   * 다른 날 한 번에 맞히면 노트에서 빠진다.
   */
  missed: Record<string, string>;
  /**
   * 오늘 다시 볼 오답 단어 — 날이 바뀔 때 한 번만 정한다.
   * (퀴즈 도중 노트가 바뀌어도 오늘 단어가 흔들리지 않게)
   */
  todayMissed: string[];
  /** 지금 배우는 소리 단계 (0부터) */
  unit: number;
  /** 그 단계에서 공부를 마친 날 수 — DAYS_PER_UNIT 이 되면 다음 단계로 */
  unitDays: number;
  /** 단계 진도를 마지막으로 올린 날 (하루에 한 번만 올린다) */
  unitDoneDate: string;
  /** 오늘 배우는 단계 — 날이 바뀔 때 정해져 오늘 하루는 그대로다 */
  todayPlan: DayPlan;
}

/** 오답 노트에 이만큼 오래 남은 단어는 정리한다 */
const MISSED_KEEP_DAYS = 14;

/** 같은 쿠폰 몇 장을 내면 다른 쿠폰 한 장으로 바꿔 주는지 */
export const TRADE_COST = 2;

/**
 * 하루에 받을 수 있는 쿠폰 수.
 * 쿠폰 때문에 더 하고 싶어 하는 만큼, 하루 여덟 번까지 열어 둔다.
 * (숫자만 바꾸면 늘리거나 줄일 수 있다)
 */
export const MAX_COUPONS_PER_DAY = 8;

const DEFAULT: WordProgress = {
  date: '', learned: 0, phase: 'learn', round: 0, attempt: 0, results: [], queue: FRESH_QUEUE(),
  rewardedDate: '', rewardedRounds: [], totalLearned: 0, coupons: {}, history: [],
  missed: {},
  todayMissed: [],
  unit: 0,
  unitDays: 0,
  unitDoneDate: '',
  todayPlan: { unit: 0, unitDay: 0 },
};

function daysAgo(dateKey: string): number {
  const [y, m, d] = dateKey.split('-').map(Number);
  if (!y) return Infinity;
  const then = Date.UTC(y, m - 1, d);
  const n = new Date();
  const now = Date.UTC(n.getFullYear(), n.getMonth(), n.getDate());
  return Math.round((now - then) / 86400000);
}

function load(): WordProgress {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const saved: WordProgress = { ...DEFAULT, ...parsed };
      // 예전 저장 데이터에는 queue 가 없다 — 푼 만큼 빼고 남은 문제로 채운다
      if (!Array.isArray(parsed.queue)) saved.queue = FRESH_QUEUE().slice(saved.results.length);
      // 너무 오래된 오답은 정리한다
      saved.missed = Object.fromEntries(
        Object.entries(saved.missed ?? {}).filter(([, at]) => daysAgo(at) <= MISSED_KEEP_DAYS),
      );
      // 날이 바뀌면 오늘 치만 초기화한다 (쿠폰과 누적 기록은 그대로)
      if (saved.date !== todayKey()) {
        // 가장 최근에 틀린 단어부터 오늘 다시 본다
        const todayMissed = Object.entries(saved.missed)
          .sort((a, b) => daysAgo(a[1]) - daysAgo(b[1]))
          .map(([en]) => en)
          .slice(0, MAX_MISSED_PER_DAY);
        return {
          ...saved, date: todayKey(), learned: 0, phase: 'learn',
          round: 0, attempt: 0, results: [], queue: FRESH_QUEUE(), rewardedRounds: [],
          todayMissed,
          // 오늘 배울 소리 단계를 정해 둔다
          todayPlan: { unit: saved.unit, unitDay: saved.unitDays },
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
  const answer = useCallback((correct: boolean, en: string, firstTry: boolean) => {
    setProgress(prev => {
      const [cur, ...rest] = prev.queue;
      const queue = correct || cur === undefined ? rest : [...rest, cur];
      // 오답 노트: 틀리면 적고, 지난날 틀린 단어를 오늘 한 번에 맞히면 지운다
      const missed = { ...prev.missed };
      const today = todayKey();
      if (!correct) missed[en] = today;
      else if (firstTry && missed[en] && missed[en] !== today) delete missed[en];
      const next = { ...prev, results: [...prev.results, correct], queue, missed };
      try { localStorage.setItem(KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  /**
   * 다시 도전 — 단어는 그대로 두고 10개를 처음부터 다시 보여준다.
   * 틀린 아이에게 본 적 없는 단어를 내밀면 더 어려워지기만 한다.
   */
  const retryTest = useCallback(() => {
    update({ learned: 0, phase: 'learn', attempt: progress.attempt + 1, results: [], queue: FRESH_QUEUE() });
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

  /** 같은 쿠폰 TRADE_COST 장을 내고 다른 쿠폰 한 장을 받는다 */
  const tradeCoupon = useCallback((from: CouponId, to: CouponId): boolean => {
    const have = progress.coupons[from] ?? 0;
    if (from === to || have < TRADE_COST) return false;
    const next: WordProgress = {
      ...progress,
      coupons: {
        ...progress.coupons,
        [from]: have - TRADE_COST,
        [to]: (progress.coupons[to] ?? 0) + 1,
      },
      history: [{ id: to, from, type: 'trade' as const, at: todayKey() }, ...progress.history].slice(0, 60),
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

  /**
   * 오늘의 첫 묶음 퀴즈를 마쳤을 때 — 하루에 한 번만 단계 진도를 올린다.
   * 날짜가 아니라 실제로 공부한 날을 세므로, 하루 쉬어도 진도가 그냥 넘어가지 않는다.
   */
  const completeDay = useCallback(() => {
    setProgress(prev => {
      const today = todayKey();
      if (prev.unitDoneDate === today) return prev;
      let unit = prev.unit, unitDays = prev.unitDays + 1;
      if (unitDays >= DAYS_PER_UNIT) { unit = (unit + 1) % UNITS.length; unitDays = 0; }
      const next = { ...prev, unit, unitDays, unitDoneDate: today };
      try { localStorage.setItem(KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  /** 소리 단계를 직접 고른다 (처음부터 다시 하거나 건너뛸 때) — 오늘 단어도 그 단계로 바뀐다 */
  const chooseUnit = useCallback((unit: number) => {
    update({
      unit, unitDays: 0, unitDoneDate: '',
      todayPlan: { unit, unitDay: 0 },
      learned: 0, phase: 'learn', round: 0, attempt: 0, results: [], queue: FRESH_QUEUE(),
    });
  }, [update]);

  const finishWithoutCoupon = useCallback(() => update({ phase: 'done' }), [update]);

  /** 오늘 것을 또 연습 (쿠폰은 안 나온다) */
  const practiceAgain = useCallback(() => {
    update({
      learned: 0, phase: 'learn',
      round: progress.round + 1, attempt: 0, results: [], queue: FRESH_QUEUE(),
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
    progress, learnNext, answer, retryTest, earnCoupon, useCoupon, tradeCoupon,
    completeDay, chooseUnit,
    finishWithoutCoupon, practiceAgain, totalCoupons,
    rewardedThisRound, couponsToday, couponsLeftToday, update,
  };
}

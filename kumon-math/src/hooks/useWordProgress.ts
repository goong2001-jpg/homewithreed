import { useCallback, useState } from 'react';
import { CouponId } from '../words/coupons';
import { todayKey, TEST_COUNT, MAX_MISSED_PER_DAY, DayPlan, reviewForDay } from '../words/dailySet';
import { UNITS, SETS_PER_UNIT } from '../words/units';
import { SrsMap, applyResult, seenEntry, migrateSrs, MAX_BOX } from '../words/srs';
import { logDay } from '../words/log';

const FRESH_QUEUE = () => Array.from({ length: TEST_COUNT }, (_, i) => i);

const KEY = 'word_progress';

export type Phase = 'learn' | 'test' | 'done';

export interface CouponEvent {
  id: CouponId;
  /**
   * 'earn' = 받음, 'use' = 사용함, 'trade' = 다른 쿠폰과 바꿔서 받음,
   * 'save' = 저금통에 넣음, 'big' = 저금통으로 큰 보상을 받음 (label 에 보상 이름)
   */
  type: 'earn' | 'use' | 'trade' | 'save' | 'big';
  at: string;
  /** trade 일 때 내준 쿠폰 */
  from?: CouponId;
  /** trade 일 때 내준 장수 (예전 기록은 2장이었다), big 일 때 저금통에서 낸 장수 */
  cost?: number;
  /** big 일 때 받은 큰 보상 이름 */
  label?: string;
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
  /** 그 단계에서 끝낸 문제 묶음 수 — SETS_PER_UNIT 이 되면 다음 단계로 */
  unitDays: number;
  /** 진도를 마지막으로 올린 묶음 ("날짜:묶음번호") — 같은 묶음으로 두 번 올리지 않는다 */
  unitDoneDate: string;
  /**
   * 지금 묶음에서 배우는 단계 — 묶음을 시작할 때 정해져 그 묶음 동안은 그대로다.
   * (퀴즈를 끝내 진도가 올라도 방금 푼 단어가 바뀌지 않게)
   */
  todayPlan: DayPlan;
  /** 배운 단어와 본 횟수 — 놀이터와 그림책은 이 단어들로 만든다 */
  seen: Record<string, number>;
  /** 문제에서 한 번에 맞힌 횟수 — 그림책 별(⭐)로 보여준다 */
  known: Record<string, number>;
  /** 간격 반복 상자 — 단어마다 몇 번 상자인지, 언제 다시 볼지 (seen/known/missed 는 호환용으로 남긴다) */
  srs: SrsMap;
  /** 오늘 복습 차례라 오늘 단어에 넣은 단어 — 날이 바뀌거나 새 묶음을 시작할 때 정한다 */
  todayReview: string[];
  /** 오늘 한 번에 맞힌 단어 — 요정이 기억해 뒀다가 말해 준다 */
  todayCorrect: string[];
  /** 어제 틀린 단어 (날이 바뀔 때 정한다) */
  yesterdayMissed: string[];
  /** 어제 본 단어 카드 수 */
  yesterdayLearned: number;
  /** 오늘이 시작될 때의 totalLearned — 하루에 몇 개 봤는지 세는 기준 */
  dayStartLearned: number;
  /** 저금통에 모은 쿠폰 수 — 모아서 큰 보상으로 바꾼다 */
  piggy: number;
  /** 다 배워서 졸업 시험을 볼 수 있는 소리 단계들 */
  pendingGrad: number[];
  /** 졸업 시험에 통과한 단계와 날짜 */
  graduated: Record<number, string>;
}

/** 오답 노트에 이만큼 오래 남은 단어는 정리한다 */
const MISSED_KEEP_DAYS = 14;

/** 쿠폰 몇 장을 내면 다른 쿠폰 한 장으로 바꿔 주는지 (1:1) */
export const TRADE_COST = 1;

/**
 * 하루에 쿠폰을 뽑을 수 있는 횟수 (장수가 아니라 회차 수).
 * 한 번에 다 맞히면 두 장이므로 하루 최대 8번 × 2장 = 16장까지 받을 수 있다.
 * (숫자만 바꾸면 늘리거나 줄일 수 있다)
 */
export const MAX_COUPON_ROUNDS_PER_DAY = 8;

/** 3문제를 틀리지 않고 한 번에 다 맞히면 받는 쿠폰 수 (틀렸다가 다시 맞히면 1장) */
export const COUPONS_FOR_PERFECT = 2;

const DEFAULT: WordProgress = {
  date: '', learned: 0, phase: 'learn', round: 0, attempt: 0, results: [], queue: FRESH_QUEUE(),
  rewardedDate: '', rewardedRounds: [], totalLearned: 0, coupons: {}, history: [],
  missed: {},
  todayMissed: [],
  unit: 0,
  unitDays: 0,
  unitDoneDate: '',
  todayPlan: { unit: 0, unitDay: 0 },
  seen: {},
  known: {},
  srs: {},
  todayReview: [],
  todayCorrect: [],
  yesterdayMissed: [],
  yesterdayLearned: 0,
  dayStartLearned: 0,
  piggy: 0,
  pendingGrad: [],
  graduated: {},
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
      // 예전 저장 데이터에는 간격 반복 상자가 없다 — 본/맞힌/틀린 기록으로 만든다
      if (!parsed.srs) saved.srs = migrateSrs(saved.seen ?? {}, saved.known ?? {}, saved.missed, todayKey());
      // 날이 바뀌면 오늘 치만 초기화한다 (쿠폰과 누적 기록은 그대로)
      if (saved.date !== todayKey()) {
        // 가장 최근에 틀린 단어부터 오늘 다시 본다
        const todayMissed = Object.entries(saved.missed)
          .sort((a, b) => daysAgo(a[1]) - daysAgo(b[1]))
          .map(([en]) => en)
          .slice(0, MAX_MISSED_PER_DAY);
        const todayPlan: DayPlan = { unit: saved.unit, unitDay: saved.unitDays };
        const wasYesterday = daysAgo(saved.date) === 1;
        return {
          ...saved, date: todayKey(), learned: 0, phase: 'learn',
          round: 0, attempt: 0, results: [], queue: FRESH_QUEUE(), rewardedRounds: [],
          todayMissed,
          // 오늘 배울 소리 단계를 정해 둔다
          todayPlan,
          // 간격 반복에서 오늘 복습 차례인 단어
          todayReview: reviewForDay(saved.srs, todayPlan),
          todayCorrect: [],
          yesterdayMissed: Object.entries(saved.missed).filter(([, at]) => daysAgo(at) === 1).map(([en]) => en),
          // 어제 몇 개 봤는지 — 예전 데이터엔 기준값이 없으니 0으로 둔다
          yesterdayLearned: wasYesterday && typeof parsed.dayStartLearned === 'number'
            ? Math.max(0, saved.totalLearned - saved.dayStartLearned) : 0,
          dayStartLearned: saved.totalLearned,
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

  /** 단어 하나를 다 봤을 때 — 처음 보는 단어는 1번 상자에 넣는다 (내일 복습) */
  const learnNext = useCallback((perDay: number, en?: string) => {
    setProgress(prev => {
      const learned = Math.min(prev.learned + 1, perDay);
      logDay('cards');
      if (en && !prev.srs[en]) logDay('newWords');
      const next: WordProgress = {
        ...prev,
        seen: en ? { ...prev.seen, [en]: (prev.seen[en] ?? 0) + 1 } : prev.seen,
        srs: en && !prev.srs[en] ? { ...prev.srs, [en]: seenEntry(todayKey()) } : prev.srs,
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
      const known = correct && firstTry ? { ...prev.known, [en]: (prev.known[en] ?? 0) + 1 } : prev.known;
      // 간격 반복 상자: 처음 푸는 답만 반영한다 (틀린 문제를 바로 다시 맞힌 건 올리지 않는다)
      const srs = firstTry ? { ...prev.srs, [en]: applyResult(prev.srs[en], correct, today) } : prev.srs;
      if (firstTry) {
        logDay(correct ? 'right' : 'wrong');
        if (srs[en].box === MAX_BOX && (prev.srs[en]?.box ?? 0) < MAX_BOX) logDay('mastered');
      }
      const todayCorrect = correct && firstTry && !prev.todayCorrect.includes(en)
        ? [...prev.todayCorrect, en] : prev.todayCorrect;
      const next = { ...prev, results: [...prev.results, correct], queue, missed, known, srs, todayCorrect };
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

  /**
   * 쿠폰 받기 — 회차마다 한 번 (3문제를 한 번에 다 맞히면 두 장).
   * 하루에 MAX_COUPON_ROUNDS_PER_DAY 번까지 뽑을 수 있고, 담은 장수를 돌려준다.
   * rewardedRounds 에는 쿠폰 한 장마다 회차 번호를 하나씩 적는다
   * (길이 = 오늘 받은 장수, 서로 다른 번호의 수 = 오늘 뽑은 횟수).
   */
  const earnCoupon = useCallback((ids: CouponId[]): number => {
    const today = todayKey();
    const rounds = progress.rewardedDate === today ? progress.rewardedRounds : [];
    if (rounds.includes(progress.round)) return 0;      // 이 회차는 이미 받음
    if (new Set(rounds).size >= MAX_COUPON_ROUNDS_PER_DAY) return 0; // 오늘치 다 뽑음
    const given = ids;
    if (!given.length) return 0;
    const coupons = { ...progress.coupons };
    for (const id of given) coupons[id] = (coupons[id] ?? 0) + 1;
    const next: WordProgress = {
      ...progress,
      rewardedDate: today,
      rewardedRounds: [...rounds, ...given.map(() => progress.round)],
      // 화면은 그대로 둔다. 여기서 'done'으로 바꾸면 방금 뽑은 쿠폰이
      // 곧바로 사라져서 아이가 무엇을 받았는지 볼 수 없다.
      coupons,
      history: [
        ...given.map(id => ({ id, type: 'earn' as const, at: today })),
        ...progress.history,
      ].slice(0, 60),
    };
    save(next);
    logDay('earned', given.length);
    return given.length;
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
      history: [{ id: to, from, cost: TRADE_COST, type: 'trade' as const, at: todayKey() }, ...progress.history].slice(0, 60),
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
    logDay('used');
    return true;
  }, [progress, save]);

  /** 쿠폰 한 장을 저금통에 넣는다 (500원 쿠폰은 넣을 수 없다 — 화면에서 막는다) */
  const saveToPiggy = useCallback((id: CouponId): boolean => {
    const have = progress.coupons[id] ?? 0;
    if (have <= 0) return false;
    save({
      ...progress,
      coupons: { ...progress.coupons, [id]: have - 1 },
      piggy: progress.piggy + 1,
      history: [{ id, type: 'save' as const, at: todayKey() }, ...progress.history].slice(0, 60),
    });
    return true;
  }, [progress, save]);

  /** 저금통에서 cost 장을 내고 큰 보상을 받는다 */
  const buyBigReward = useCallback((label: string, cost: number): boolean => {
    if (!(cost > 0) || progress.piggy < cost) return false;
    save({
      ...progress,
      piggy: progress.piggy - cost,
      history: [{ id: 'playground' as CouponId, type: 'big' as const, label, cost, at: todayKey() }, ...progress.history].slice(0, 60),
    });
    logDay('used', cost);
    return true;
  }, [progress, save]);

  /** 졸업 시험 통과 — 그 단계를 졸업 목록에 적는다 */
  const passGrad = useCallback((unit: number) => {
    setProgress(prev => {
      const next = {
        ...prev,
        pendingGrad: prev.pendingGrad.filter(u => u !== unit),
        graduated: { ...prev.graduated, [unit]: todayKey() },
      };
      try { localStorage.setItem(KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  /**
   * 문제 묶음 하나를 끝냈을 때 — 단계 진도를 한 칸 올린다.
   * 묶음마다 한 번만 올린다. 다음 묶음의 단어는 "새 단어로 한 번 더"에서 정한다.
   */
  const completeSet = useCallback(() => {
    setProgress(prev => {
      const done = `${todayKey()}:${prev.round}`;
      if (prev.unitDoneDate === done) return prev;
      let unit = prev.unit, unitDays = prev.unitDays + 1;
      let pendingGrad = prev.pendingGrad;
      if (unitDays >= SETS_PER_UNIT) {
        // 한 단계를 다 배웠다 — 졸업 시험을 볼 수 있게 적어 둔다
        if (!prev.graduated[prev.unit] && !pendingGrad.includes(prev.unit)) pendingGrad = [...pendingGrad, prev.unit];
        unit = (unit + 1) % UNITS.length; unitDays = 0;
      }
      const next = { ...prev, unit, unitDays, unitDoneDate: done, pendingGrad };
      try { localStorage.setItem(KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  /** 소리 단계를 직접 고른다 (처음부터 다시 하거나 건너뛸 때) — 오늘 단어도 그 단계로 바뀐다 */
  const chooseUnit = useCallback((unit: number) => {
    update({
      unit, unitDays: 0, unitDoneDate: '',
      todayPlan: { unit, unitDay: 0 },
      todayReview: reviewForDay(progress.srs, { unit, unitDay: 0 }),
      learned: 0, phase: 'learn', round: 0, attempt: 0, results: [], queue: FRESH_QUEUE(),
    });
  }, [progress.srs, update]);

  const finishWithoutCoupon = useCallback(() => update({ phase: 'done' }), [update]);

  /** 오늘 것을 또 연습 (쿠폰은 안 나온다) */
  const practiceAgain = useCallback(() => {
    const todayPlan: DayPlan = { unit: progress.unit, unitDay: progress.unitDays };
    update({
      learned: 0, phase: 'learn',
      round: progress.round + 1, attempt: 0, results: [], queue: FRESH_QUEUE(),
      // 다음 묶음은 올라간 진도의 단계로 배운다
      todayPlan,
      // 복습 단어도 새로 고른다 (방금 맞힌 단어는 복습 차례가 아니므로 빠진다)
      todayReview: reviewForDay(progress.srs, todayPlan),
    });
  }, [progress.round, progress.unit, progress.unitDays, progress.srs, update]);

  const totalCoupons = Object.values(progress.coupons).reduce<number>((s, n) => s + (n ?? 0), 0);
  const roundsToday = progress.rewardedDate === todayKey() ? progress.rewardedRounds : [];
  /** 이번 회차로 이미 쿠폰을 받았는지 */
  const rewardedThisRound = roundsToday.includes(progress.round);
  /** 오늘 받은 쿠폰 수 / 남은 수 */
  const couponsToday = roundsToday.length;
  /** 오늘 쿠폰을 더 뽑을 수 있는 횟수 */
  const couponsLeftToday = Math.max(0, MAX_COUPON_ROUNDS_PER_DAY - new Set(roundsToday).size);

  return {
    progress, learnNext, answer, retryTest, earnCoupon, useCoupon, tradeCoupon,
    completeSet, chooseUnit, saveToPiggy, buyBigReward, passGrad,
    finishWithoutCoupon, practiceAgain, totalCoupons,
    rewardedThisRound, couponsToday, couponsLeftToday, update,
  };
}

import { useState, useCallback } from 'react';
import { GameState, AvatarItem, CourseProgress } from '../types';
import { getNextCourse } from '../curriculum/math';

const INITIAL_ITEMS: AvatarItem[] = [
  // 🐾 펫 — 요정 옆에 따라다니는 친구
  { id: 'pet_rabbit',  name: '토끼',   emoji: '🐰', category: 'pet', price: 40,  owned: false, equipped: false, unlockAt: 3 },
  { id: 'pet_cat',     name: '고양이', emoji: '🐱', category: 'pet', price: 60,  owned: false, equipped: false, unlockAt: 6 },
  { id: 'pet_fox',     name: '여우',   emoji: '🦊', category: 'pet', price: 90,  owned: false, equipped: false, unlockAt: 12 },
  { id: 'pet_unicorn', name: '유니콘', emoji: '🦄', category: 'pet', price: 120, owned: false, equipped: false, unlockAt: 20 },
  { id: 'pet_dragon',  name: '아기용', emoji: '🐲', category: 'pet', price: 160, owned: false, equipped: false, unlockAt: 30 },

  // 🌈 배경 — 화면 배경 장면이 통째로 바뀜
  { id: 'bg_stars',   name: '별밤 하늘', emoji: '🌙', category: 'background', price: 50,  owned: false, equipped: false, unlockAt: 5 },
  { id: 'bg_flowers', name: '꽃밭',     emoji: '🌷', category: 'background', price: 70,  owned: false, equipped: false, unlockAt: 10 },
  { id: 'bg_ocean',   name: '바닷속',   emoji: '🐠', category: 'background', price: 100, owned: false, equipped: false, unlockAt: 18 },
  { id: 'bg_rainbow', name: '무지개',   emoji: '🌈', category: 'background', price: 130, owned: false, equipped: false, unlockAt: 28 },
  { id: 'bg_space',   name: '우주',     emoji: '🪐', category: 'background', price: 160, owned: false, equipped: false, unlockAt: 40 },

  // ✨ 효과 — 아바타 주위에 반짝이는 마법 효과
  { id: 'fx_sparkle', name: '반짝이',   emoji: '✨', category: 'effect', price: 45,  owned: false, equipped: false, unlockAt: 4 },
  { id: 'fx_hearts',  name: '하트뿅뿅', emoji: '💕', category: 'effect', price: 75,  owned: false, equipped: false, unlockAt: 9 },
  { id: 'fx_stars',   name: '별가루',   emoji: '🌟', category: 'effect', price: 110, owned: false, equipped: false, unlockAt: 16 },
  { id: 'fx_bubbles', name: '비눗방울', emoji: '🫧', category: 'effect', price: 140, owned: false, equipped: false, unlockAt: 26 },

  // 💎 전설의 컬렉션 — 문제를 풀수록 한 조각씩 열려요 (정답 개수로 해금)
  { id: 'diana_crown',    name: '보석 왕관',    emoji: '👑', category: 'special', price: 120, owned: false, equipped: false, unlockAt: 15,  image: 'diana_crown.png',    bgRemoval: 'green' },
  { id: 'diana_necklace', name: '별빛 목걸이', emoji: '📿', category: 'special', price: 150, owned: false, equipped: false, unlockAt: 30,  image: 'diana_necklace.png', bgRemoval: 'green' },
  { id: 'diana_wings',    name: '요정 날개',   emoji: '🪽', category: 'special', price: 180, owned: false, equipped: false, unlockAt: 45,  image: 'diana_wings.png',    bgRemoval: 'green' },
  { id: 'diana_aura',     name: '반짝이 오라', emoji: '💫', category: 'special', price: 210, owned: false, equipped: false, unlockAt: 60,  image: 'diana_aura.png',     bgRemoval: 'black' },
  { id: 'diana_dress',    name: '드림 드레스', emoji: '👗', category: 'special', price: 250, owned: false, equipped: false, unlockAt: 80,  image: 'diana_dress.png',    bgRemoval: 'green' },
  { id: 'diana_full',     name: '✨다이아 요정✨', emoji: '🧚', category: 'special', price: 350, owned: false, equipped: false, unlockAt: 100, image: 'diana_full.png', bgRemoval: 'none', fullImage: true },
];

const STORAGE_KEY = 'kumon_game_state';
const ITEMS_KEY = 'kumon_items';

const DAILY_GOAL = 20;          // 오늘의 미션: 20문제 맞히기
const MISSION_BONUS = 20;       // 미션 완료 보너스 ⭐
const UNLOCK_WINDOW = 20;      // 다음 코스 해금 판정: 최근 20문제
const UNLOCK_MIN_CORRECT = 18; // 그중 18개 이상 정답 (90%)
const UNLOCK_MIN_LEVEL = 10;   // 코스 내 레벨 10 이상일 때만 해금

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function yesterdayStr(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

const DEFAULT_STATE: GameState = {
  points: 0,
  level: 1,
  streak: 0,
  totalCorrect: 0,
  totalWrong: 0,
  equippedItems: [],
  ownedItems: [],
  courseId: 'addsub20',
  dailyGoal: DAILY_GOAL,
  todaySolved: 0,
  lastPlayedDate: '',
  attendanceStreak: 0,
  missionRewardDate: '',
  courseProgress: {},
  unlockedCourseIds: ['add10', 'addsub20'],
  courseLevels: {},
};

function loadState(): GameState {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      // 예전 저장 데이터에 새 필드가 없어도 기본값으로 채워짐
      const merged: GameState = { ...DEFAULT_STATE, ...JSON.parse(saved) };
      merged.dailyGoal = DAILY_GOAL;
      if (merged.lastPlayedDate !== todayStr()) merged.todaySolved = 0;
      // 현재 하고 있는 코스는 항상 해금 목록에 포함 (자동 승급 시절 데이터 호환)
      if (!merged.unlockedCourseIds.includes(merged.courseId)) {
        merged.unlockedCourseIds = [...merged.unlockedCourseIds, merged.courseId];
      }
      return merged;
    }
  } catch {}
  return DEFAULT_STATE;
}

function loadItems(): AvatarItem[] {
  try {
    const saved = localStorage.getItem(ITEMS_KEY);
    if (saved) {
      const parsed: AvatarItem[] = JSON.parse(saved);
      // 새 아이템이 추가된 경우 병합
      return INITIAL_ITEMS.map(init => {
        const found = parsed.find(p => p.id === init.id);
        return found ? { ...init, owned: found.owned, equipped: found.equipped } : init;
      });
    }
  } catch {}
  return INITIAL_ITEMS;
}

/** 출석 처리: 오늘 처음 풀면 스트릭 갱신 */
function applyAttendance(prev: GameState): Pick<GameState, 'lastPlayedDate' | 'attendanceStreak' | 'todaySolved'> {
  const today = todayStr();
  if (prev.lastPlayedDate === today) {
    return { lastPlayedDate: today, attendanceStreak: prev.attendanceStreak, todaySolved: prev.todaySolved };
  }
  const streak = prev.lastPlayedDate === yesterdayStr() ? prev.attendanceStreak + 1 : 1;
  return { lastPlayedDate: today, attendanceStreak: streak, todaySolved: 0 };
}

export interface AnswerResult {
  earned: number;
  missionCompleted: boolean;
  /** 이번 정답으로 새로 열린 코스 (자동 이동하지 않음 — 선택은 아이/부모 몫) */
  unlockedCourse: { id: string; name: string; emoji: string } | null;
  nextLevel: number;
  courseId: string;
}

export function useGameState() {
  const [gameState, setGameState] = useState<GameState>(loadState);
  const [items, setItems] = useState<AvatarItem[]>(loadItems);

  const save = useCallback((state: GameState, itemList: AvatarItem[]) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    localStorage.setItem(ITEMS_KEY, JSON.stringify(itemList));
  }, []);

  const onCorrect = useCallback((): AnswerResult => {
    const prev = gameState;
    const today = todayStr();
    const attendance = applyAttendance(prev);

    const newStreak = prev.streak + 1;
    const streakBonus = newStreak % 5 === 0 ? 2 : 0;
    let earned = 3 + streakBonus;

    // 오늘의 미션
    const todaySolved = attendance.todaySolved + 1;
    let missionCompleted = false;
    let missionRewardDate = prev.missionRewardDate;
    if (todaySolved >= prev.dailyGoal && missionRewardDate !== today) {
      earned += MISSION_BONUS;
      missionCompleted = true;
      missionRewardDate = today;
    }

    // 코스 진행 기록 + 다음 코스 해금 판정 (코스는 바꾸지 않는다 — 선택식)
    const cp: CourseProgress = prev.courseProgress[prev.courseId] ?? { attempted: 0, correct: 0, recent: [] };
    const recent = [...cp.recent, true].slice(-UNLOCK_WINDOW);
    const level = newStreak >= 5 ? Math.min(prev.level + 1, 20) : prev.level;
    let unlockedCourse: AnswerResult['unlockedCourse'] = null;
    let unlockedCourseIds = prev.unlockedCourseIds;

    const correctInRecent = recent.filter(Boolean).length;
    if (
      recent.length >= UNLOCK_WINDOW &&
      correctInRecent >= UNLOCK_MIN_CORRECT &&
      level >= UNLOCK_MIN_LEVEL
    ) {
      const nextCourse = getNextCourse(prev.courseId);
      if (nextCourse && !unlockedCourseIds.includes(nextCourse.id)) {
        unlockedCourse = { id: nextCourse.id, name: nextCourse.name, emoji: nextCourse.emoji };
        unlockedCourseIds = [...unlockedCourseIds, nextCourse.id];
      }
    }

    const next: GameState = {
      ...prev,
      ...attendance,
      points: prev.points + earned,
      streak: newStreak,
      level,
      todaySolved,
      missionRewardDate,
      totalCorrect: prev.totalCorrect + 1,
      unlockedCourseIds,
      courseLevels: { ...prev.courseLevels, [prev.courseId]: level },
      courseProgress: {
        ...prev.courseProgress,
        [prev.courseId]: { attempted: cp.attempted + 1, correct: cp.correct + 1, recent },
      },
    };
    setGameState(next);
    save(next, items);

    return { earned, missionCompleted, unlockedCourse, nextLevel: level, courseId: prev.courseId };
  }, [gameState, items, save]);

  /** 해금된 코스로 이동 — 코스별 레벨은 기억해 두었다가 이어서 */
  const switchCourse = useCallback((courseId: string) => {
    setGameState(prev => {
      if (courseId === prev.courseId || !prev.unlockedCourseIds.includes(courseId)) return prev;
      const next: GameState = {
        ...prev,
        courseLevels: { ...prev.courseLevels, [prev.courseId]: prev.level },
        courseId,
        level: prev.courseLevels[courseId] ?? 1,
        streak: 0,
      };
      save(next, items);
      return next;
    });
  }, [items, save]);

  const onWrong = useCallback((): { nextLevel: number; courseId: string } => {
    const prev = gameState;
    const attendance = applyAttendance(prev);
    const cp: CourseProgress = prev.courseProgress[prev.courseId] ?? { attempted: 0, correct: 0, recent: [] };
    const recent = [...cp.recent, false].slice(-UNLOCK_WINDOW);
    const level = Math.max(prev.level - 1, 1);

    const next: GameState = {
      ...prev,
      ...attendance,
      streak: 0,
      level,
      totalWrong: prev.totalWrong + 1,
      courseProgress: {
        ...prev.courseProgress,
        [prev.courseId]: { attempted: cp.attempted + 1, correct: cp.correct, recent },
      },
    };
    setGameState(next);
    save(next, items);

    return { nextLevel: level, courseId: prev.courseId };
  }, [gameState, items, save]);

  const buyItem = useCallback((itemId: string) => {
    setItems(prev => {
      const item = prev.find(i => i.id === itemId);
      if (!item || item.owned) return prev;
      if (gameState.points < item.price) return prev;
      // 아직 해금되지 않은 아이템은 구매 불가
      if (item.unlockAt && gameState.totalCorrect < item.unlockAt) return prev;
      const updated = prev.map(i => i.id === itemId ? { ...i, owned: true } : i);
      setGameState(gs => {
        const next = { ...gs, points: gs.points - item.price, ownedItems: [...gs.ownedItems, itemId] };
        save(next, updated);
        return next;
      });
      return updated;
    });
  }, [gameState.points, gameState.totalCorrect, save]);

  const equipItem = useCallback((itemId: string) => {
    setItems(prev => {
      const item = prev.find(i => i.id === itemId);
      if (!item || !item.owned) return prev;
      const updated = prev.map(i => {
        if (i.category === item.category) return { ...i, equipped: i.id === itemId ? !i.equipped : false };
        return i;
      });
      const equippedIds = updated.filter(i => i.equipped).map(i => i.id);
      setGameState(gs => {
        const next = { ...gs, equippedItems: equippedIds };
        save(next, updated);
        return next;
      });
      return updated;
    });
  }, [save]);

  return { gameState, items, onCorrect, onWrong, buyItem, equipItem, switchCourse };
}

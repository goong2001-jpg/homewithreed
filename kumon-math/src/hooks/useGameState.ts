import { useState, useCallback } from 'react';
import { GameState, AvatarItem } from '../types';

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

function loadState(): GameState {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  return { points: 0, level: 1, streak: 0, totalCorrect: 0, totalWrong: 0, equippedItems: [], ownedItems: [] };
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

export function useGameState() {
  const [gameState, setGameState] = useState<GameState>(loadState);
  const [items, setItems] = useState<AvatarItem[]>(loadItems);

  const save = useCallback((state: GameState, itemList: AvatarItem[]) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    localStorage.setItem(ITEMS_KEY, JSON.stringify(itemList));
  }, []);

  const onCorrect = useCallback(() => {
    setGameState(prev => {
      const newStreak = prev.streak + 1;
      // 기본 3점, 5연속이면 +2 보너스
      const bonus = newStreak > 0 && newStreak % 5 === 0 ? 2 : 0;
      const pointsEarned = 3 + bonus;
      const newLevel = newStreak >= 5 ? Math.min(prev.level + 1, 20) : prev.level;
      const next = {
        ...prev,
        points: prev.points + pointsEarned,
        streak: newStreak,
        level: newLevel,
        totalCorrect: prev.totalCorrect + 1,
      };
      save(next, items);
      return next;
    });
  }, [items, save]);

  const onWrong = useCallback(() => {
    setGameState(prev => {
      const next = {
        ...prev,
        streak: 0,
        level: Math.max(prev.level - 1, 1),
        totalWrong: prev.totalWrong + 1,
      };
      save(next, items);
      return next;
    });
  }, [items, save]);

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

  return { gameState, items, onCorrect, onWrong, buyItem, equipItem };
}

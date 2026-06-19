import { useState, useCallback } from 'react';
import { GameState, AvatarItem } from '../types';

const INITIAL_ITEMS: AvatarItem[] = [
  { id: 'hat_crown', name: '왕관', emoji: '👑', category: 'hat', price: 50, owned: false, equipped: false },
  { id: 'hat_wizard', name: '마법사 모자', emoji: '🎩', category: 'hat', price: 30, owned: false, equipped: false },
  { id: 'hat_flower', name: '꽃 머리띠', emoji: '🌸', category: 'hat', price: 20, owned: false, equipped: false },
  { id: 'hat_star', name: '별 머리띠', emoji: '⭐', category: 'hat', price: 25, owned: false, equipped: false },
  { id: 'acc_glasses', name: '예쁜 안경', emoji: '👓', category: 'accessory', price: 40, owned: false, equipped: false },
  { id: 'acc_bow', name: '리본', emoji: '🎀', category: 'accessory', price: 15, owned: false, equipped: false },
  { id: 'acc_necklace', name: '목걸이', emoji: '📿', category: 'accessory', price: 35, owned: false, equipped: false },
  { id: 'bg_rainbow', name: '무지개 배경', emoji: '🌈', category: 'background', price: 60, owned: false, equipped: false },
  { id: 'bg_stars', name: '별빛 배경', emoji: '✨', category: 'background', price: 45, owned: false, equipped: false },
  { id: 'bg_flowers', name: '꽃밭 배경', emoji: '🌷', category: 'background', price: 55, owned: false, equipped: false },
  { id: 'outfit_princess', name: '공주 드레스', emoji: '👗', category: 'outfit', price: 80, owned: false, equipped: false },
  { id: 'outfit_superhero', name: '슈퍼히어로', emoji: '🦸', category: 'outfit', price: 70, owned: false, equipped: false },
  { id: 'outfit_unicorn', name: '유니콘 옷', emoji: '🦄', category: 'outfit', price: 90, owned: false, equipped: false },
];

const STORAGE_KEY = 'kumon_game_state';
const ITEMS_KEY = 'kumon_items';

function loadState(): GameState {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  return {
    points: 0,
    level: 1,
    streak: 0,
    totalCorrect: 0,
    totalWrong: 0,
    equippedItems: [],
    ownedItems: [],
  };
}

function loadItems(): AvatarItem[] {
  try {
    const saved = localStorage.getItem(ITEMS_KEY);
    if (saved) return JSON.parse(saved);
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
      const bonus = newStreak >= 3 ? 5 : 0;
      const pointsEarned = 10 + bonus;
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

      const updated = prev.map(i => i.id === itemId ? { ...i, owned: true } : i);
      setGameState(gs => {
        const next = { ...gs, points: gs.points - item.price, ownedItems: [...gs.ownedItems, itemId] };
        save(next, updated);
        return next;
      });
      return updated;
    });
  }, [gameState.points, save]);

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

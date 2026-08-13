import React, { useCallback, useEffect, useState } from 'react';
import {
  BlockPlan, Category, DEFAULT_BLOCKS, DEFAULT_CATEGORIES, DateKey, Entry, Resist, TimeBlock,
} from '../types';
import { Backup } from '../utils/backup';
import { runningOf } from '../utils/entry';
import { mergeById } from '../utils/merge';
import { KEYS, clearAll, load, save } from '../utils/storage';

/**
 * 분류·기록·타임블록의 저장소.
 *
 * 규칙 하나: 모든 변경은 localStorage에 즉시 쓴다.
 * 특히 **타이머가 그렇다** — 돌아가는 타이머는 메모리 위의 상태가 아니라
 * `endedAt === null` 인 기록이라, 앱을 껐다 켜도 그대로 이어진다.
 */

export type NewCategory = Omit<Category, 'id' | 'updatedAt' | 'createdAt' | 'order' | 'deleted'>;
export type NewEntry = Omit<Entry, 'id' | 'updatedAt' | 'createdAt' | 'deleted'>;

export type CollName = 'categories' | 'entries' | 'plans';

/** 잘못 눌렀다고 볼 만큼 짧은 기록 — 이보다 짧으면 흔적을 안 남긴다 */
const MISTAP_MS = 60_000;

function stamp<T extends { updatedAt: number }>(rec: T): T {
  return { ...rec, updatedAt: Date.now() };
}

/**
 * 앱이 업데이트되면서 기본 레코드에 필드가 붙었을 때,
 * **아직 사용자가 손대지 않은 것**(updatedAt === 0)만 새 기본값으로 갈아끼운다.
 *
 * 손댄 적 있는 레코드는 건드리지 않는다 — 사용자가 고친 이름과 색이
 * 업데이트 한 번에 되돌아가면 그게 더 나쁘다.
 */
function withDefaults<T extends { id: string; updatedAt: number }>(saved: T[], defaults: T[]): T[] {
  const byId = new Map(saved.map(r => [r.id, r]));
  for (const d of defaults) {
    const cur = byId.get(d.id);
    if (!cur) byId.set(d.id, d);
    else if (cur.updatedAt === 0) byId.set(d.id, d);
  }
  return Array.from(byId.values());
}

export interface TrackerStore {
  categories: Category[];
  entries: Entry[];
  blocks: TimeBlock[];
  plans: BlockPlan[];
  resists: Resist[];
  /** 지금 돌아가는 기록 (endedAt === null) */
  running: Entry | null;

  addCategory: (v: NewCategory) => Category;
  updateCategory: (id: string, patch: Partial<Category>) => void;
  removeCategory: (id: string) => void;

  addEntry: (v: NewEntry) => Entry;
  updateEntry: (id: string, patch: Partial<Entry>) => void;
  removeEntry: (id: string) => void;

  updateBlock: (id: string, patch: Partial<TimeBlock>) => void;

  /** (날짜, 블록) 한 쌍에 계획 하나. 이미 있으면 고치고 없으면 만든다 */
  setPlan: (day: DateKey, blockId: string, categoryId: string, memo: string) => void;
  clearPlan: (day: DateKey, blockId: string) => void;

  /** 충동을 참았다 */
  addResist: (categoryId: string, at?: number) => void;

  /** 지금부터 이 분류로 기록 시작. 돌던 기록은 이 순간에 끝난다 */
  start: (categoryId: string, now?: number) => void;
  /** 돌던 기록을 지금 끝낸다 */
  stop: (now?: number) => void;

  /** 삭제 취소 — 툼스톤을 되살린다 */
  restore: (coll: CollName, id: string) => void;

  importBackup: (b: Backup) => void;
  resetAll: () => void;
}

export function useTracker(newId: () => string): TrackerStore {
  const [categories, setCategories] = useState<Category[]>(
    () => withDefaults(load(KEYS.categories, DEFAULT_CATEGORIES), DEFAULT_CATEGORIES),
  );
  const [entries, setEntries] = useState<Entry[]>(() => load(KEYS.entries, []));
  const [blocks, setBlocks] = useState<TimeBlock[]>(
    () => withDefaults(load(KEYS.blocks, DEFAULT_BLOCKS), DEFAULT_BLOCKS),
  );
  const [plans, setPlans] = useState<BlockPlan[]>(() => load(KEYS.plans, []));
  const [resists, setResists] = useState<Resist[]>(() => load(KEYS.resists, []));

  useEffect(() => { save(KEYS.categories, categories); }, [categories]);
  useEffect(() => { save(KEYS.entries, entries); }, [entries]);
  useEffect(() => { save(KEYS.blocks, blocks); }, [blocks]);
  useEffect(() => { save(KEYS.plans, plans); }, [plans]);
  useEffect(() => { save(KEYS.resists, resists); }, [resists]);

  const running = runningOf(entries);

  /** 목록 맨 뒤로 갈 order 값 */
  const nextOrder = () => {
    const live = categories.filter(c => !c.deleted);
    return live.length ? Math.max(...live.map(c => c.order)) + 1 : 0;
  };

  // 새 레코드는 setter 콜백 '밖에서' 만든다.
  // 안에서 만들면 StrictMode가 콜백을 두 번 돌리면서 id가 두 개 생기고,
  // 호출한 쪽에 돌려줄 값도 없다 (콜백은 나중에 실행된다).
  const addCategory = (v: NewCategory): Category => {
    const now = Date.now();
    const created: Category = { ...v, id: newId(), order: nextOrder(), createdAt: now, updatedAt: now };
    setCategories(prev => [...prev, created]);
    return created;
  };

  const updateCategory = (id: string, patch: Partial<Category>) => {
    setCategories(prev => prev.map(c => (c.id === id ? stamp({ ...c, ...patch }) : c)));
  };

  // 실제로 지우지 않고 툼스톤을 남긴다 — 설정에서 되살릴 수 있게.
  // 그 분류로 적어둔 기록도 그대로 남는다 ('지운 분류'로 보인다).
  const removeCategory = (id: string) => {
    setCategories(prev => prev.map(c => (c.id === id ? stamp({ ...c, deleted: true }) : c)));
  };

  const addEntry = (v: NewEntry): Entry => {
    const now = Date.now();
    const created: Entry = { ...v, id: newId(), createdAt: now, updatedAt: now };
    setEntries(prev => [...prev, created]);
    return created;
  };

  const updateEntry = (id: string, patch: Partial<Entry>) => {
    setEntries(prev => prev.map(e => (e.id === id ? stamp({ ...e, ...patch }) : e)));
  };

  const removeEntry = (id: string) => {
    setEntries(prev => prev.map(e => (e.id === id ? stamp({ ...e, deleted: true }) : e)));
  };

  const updateBlock = (id: string, patch: Partial<TimeBlock>) => {
    setBlocks(prev => prev.map(b => (b.id === id ? stamp({ ...b, ...patch }) : b)));
  };

  const setPlan = (day: DateKey, blockId: string, categoryId: string, memo: string) => {
    const now = Date.now();
    const created: BlockPlan = {
      id: newId(), day, blockId, categoryId, memo, createdAt: now, updatedAt: now,
    };
    setPlans(prev => {
      const existing = prev.find(p => !p.deleted && p.day === day && p.blockId === blockId);
      if (existing) {
        return prev.map(p =>
          (p.id === existing.id ? stamp({ ...p, categoryId, memo, deleted: false }) : p));
      }
      return [...prev, created];
    });
  };

  const clearPlan = (day: DateKey, blockId: string) => {
    setPlans(prev => prev.map(p =>
      (!p.deleted && p.day === day && p.blockId === blockId
        ? stamp({ ...p, deleted: true })
        : p)));
  };

  const addResist = (categoryId: string, at = Date.now()) => {
    const created: Resist = { id: newId(), categoryId, at, createdAt: at, updatedAt: at };
    setResists(prev => [...prev, created]);
  };

  /**
   * 돌던 기록을 끝내고 새 기록을 잇는다.
   *
   * 잘못 눌러 몇 초 만에 다른 분류로 옮긴 경우엔 그 기록을 아예 없앤다 —
   * 툼스톤으로 남기면 휴지통이 3초짜리 기록으로 뒤덮인다.
   */
  const start = (categoryId: string, now = Date.now()) => {
    const created: Entry = {
      id: newId(), categoryId, startedAt: now, endedAt: null,
      memo: '', createdAt: now, updatedAt: now,
    };

    setEntries(prev => {
      const closed = prev.flatMap(e => {
        if (e.deleted || e.endedAt != null) return [e];
        if (now - e.startedAt < MISTAP_MS) return [];
        return [stamp({ ...e, endedAt: now })];
      });
      return [...closed, created];
    });
  };

  const stop = (now = Date.now()) => {
    setEntries(prev => prev.map(e =>
      (!e.deleted && e.endedAt == null ? stamp({ ...e, endedAt: now }) : e)));
  };

  const restore = useCallback((coll: CollName, id: string) => {
    const setter: React.Dispatch<React.SetStateAction<any[]>> =
      coll === 'categories' ? setCategories : coll === 'plans' ? setPlans : setEntries;
    setter(prev => prev.map(r => (r.id === id ? stamp({ ...r, deleted: false }) : r)));
  }, []);

  const importBackup = useCallback((b: Backup) => {
    setCategories(prev => mergeById(prev, b.categories));
    setEntries(prev => mergeById(prev, b.entries));
    // 버전 1 백업에는 없는 것들 — 빈 배열을 얹어도 지금 것이 지워지지 않는다
    setBlocks(prev => mergeById(prev, b.blocks));
    setPlans(prev => mergeById(prev, b.plans));
    setResists(prev => mergeById(prev, b.resists));
  }, []);

  const resetAll = useCallback(() => {
    clearAll();
    setCategories(DEFAULT_CATEGORIES);
    setEntries([]);
    setBlocks(DEFAULT_BLOCKS);
    setPlans([]);
    setResists([]);
  }, []);

  return {
    categories, entries, blocks, plans, resists, running,
    addCategory, updateCategory, removeCategory,
    addEntry, updateEntry, removeEntry,
    updateBlock, setPlan, clearPlan, addResist,
    start, stop, restore, importBackup, resetAll,
  };
}

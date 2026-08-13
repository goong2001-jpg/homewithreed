import React, { useCallback, useEffect, useState } from 'react';
import { Asset, AssetKind, DEFAULT_KINDS, Goal, Loan, Recurring, Syncable } from '../types';
import { Backup } from '../utils/backup';
import { mergeById } from '../utils/merge';
import { KEYS, clearAll, load, save } from '../utils/storage';

/**
 * 자산·부채·고정비·분류의 저장소.
 *
 * 규칙 하나: 모든 변경은 localStorage에 즉시 쓴다.
 * couple-budget의 useLedger와 달리 네트워크가 없어서 실패할 구석이 없다.
 */

/** 새 레코드를 만들 때 넘기는 값 — id·시각·순서는 여기서 붙인다 */
export type NewRecord<T> = Omit<T, 'id' | 'updatedAt' | 'createdAt' | 'order' | 'deleted'>;

interface Ordered extends Syncable {
  order: number;
  createdAt: number;
}

function stamp<T extends Syncable>(rec: T): T {
  return { ...rec, updatedAt: Date.now() };
}

/** 목록 맨 뒤로 갈 order 값 */
function nextOrder(recs: Ordered[]): number {
  const live = recs.filter(r => !r.deleted);
  return live.length ? Math.max(...live.map(r => r.order)) + 1 : 0;
}

export interface Ops<T> {
  add: (v: NewRecord<T>) => T;
  update: (id: string, patch: Partial<T>) => void;
  remove: (id: string) => void;
}

export interface AssetStore {
  kinds: AssetKind[];
  assets: Asset[];
  loans: Loan[];
  recurrings: Recurring[];
  goals: Goal[];

  kindOps: Ops<AssetKind>;
  assetOps: Ops<Asset>;
  loanOps: Ops<Loan>;
  recurringOps: Ops<Recurring>;
  goalOps: Ops<Goal>;

  /** 삭제 취소 — 툼스톤을 되살린다 */
  restore: (coll: CollName, id: string) => void;
  /** 툼스톤을 진짜로 지운다 */
  purge: (coll: CollName, id: string) => void;

  importBackup: (b: Backup) => void;
  resetAll: () => void;
}

export type CollName = 'kinds' | 'assets' | 'loans' | 'recurrings' | 'goals';

export function useAssets(newId: () => string): AssetStore {
  const [kinds, setKinds] = useState<AssetKind[]>(() => load(KEYS.kinds, DEFAULT_KINDS));
  const [assets, setAssets] = useState<Asset[]>(() => load(KEYS.assets, []));
  const [loans, setLoans] = useState<Loan[]>(() => load(KEYS.loans, []));
  const [recurrings, setRecurrings] = useState<Recurring[]>(() => load(KEYS.recurrings, []));
  const [goals, setGoals] = useState<Goal[]>(() => load(KEYS.goals, []));

  useEffect(() => { save(KEYS.kinds, kinds); }, [kinds]);
  useEffect(() => { save(KEYS.assets, assets); }, [assets]);
  useEffect(() => { save(KEYS.loans, loans); }, [loans]);
  useEffect(() => { save(KEYS.recurrings, recurrings); }, [recurrings]);
  useEffect(() => { save(KEYS.goals, goals); }, [goals]);

  /**
   * add/update/remove 한 벌을 만든다 — 네 컬렉션이 똑같이 동작한다.
   *
   * add에서 새 레코드를 setter 콜백 '밖에서' 만드는 게 중요하다.
   * 안에서 만들면 StrictMode가 콜백을 두 번 돌리면서 id가 두 개 생기고,
   * 호출한 쪽에 돌려줄 값도 없다 (콜백은 나중에 실행된다).
   */
  function makeOps<T extends Ordered>(
    list: T[],
    setter: React.Dispatch<React.SetStateAction<T[]>>,
  ): Ops<T> {
    return {
      add: (v: NewRecord<T>): T => {
        const now = Date.now();
        const created = {
          ...(v as object),
          id: newId(),
          order: nextOrder(list),
          createdAt: now,
          updatedAt: now,
        } as T;
        setter(prev => [...prev, created]);
        return created;
      },
      update: (id, patch) => {
        setter(prev => prev.map(r => (r.id === id ? stamp({ ...r, ...patch }) : r)));
      },
      // 실제로 지우지 않고 툼스톤을 남긴다 — 설정에서 되살릴 수 있게
      remove: (id) => {
        setter(prev => prev.map(r => (r.id === id ? stamp({ ...r, deleted: true }) : r)));
      },
    };
  }

  const setters: Record<CollName, React.Dispatch<React.SetStateAction<any[]>>> = {
    kinds: setKinds, assets: setAssets, loans: setLoans,
    recurrings: setRecurrings, goals: setGoals,
  };

  const restore = useCallback((coll: CollName, id: string) => {
    setters[coll](prev => prev.map(r => (r.id === id ? stamp({ ...r, deleted: false }) : r)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const purge = useCallback((coll: CollName, id: string) => {
    setters[coll](prev => prev.filter(r => r.id !== id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const importBackup = useCallback((b: Backup) => {
    setKinds(prev => mergeById(prev, b.kinds));
    setAssets(prev => mergeById(prev, b.assets));
    setLoans(prev => mergeById(prev, b.loans));
    setRecurrings(prev => mergeById(prev, b.recurrings));
    setGoals(prev => mergeById(prev, b.goals));
  }, []);

  const resetAll = useCallback(() => {
    clearAll();
    setKinds(DEFAULT_KINDS);
    setAssets([]);
    setLoans([]);
    setRecurrings([]);
    setGoals([]);
  }, []);

  return {
    kinds, assets, loans, recurrings, goals,
    kindOps: makeOps(kinds, setKinds),
    assetOps: makeOps(assets, setAssets),
    loanOps: makeOps(loans, setLoans),
    recurringOps: makeOps(recurrings, setRecurrings),
    goalOps: makeOps(goals, setGoals),
    restore, purge, importBackup, resetAll,
  };
}

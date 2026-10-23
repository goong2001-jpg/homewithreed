import React, { useCallback, useEffect, useState } from 'react';
import { Asset, AssetKind, DateKey, DEFAULT_KINDS, Goal, Loan, Recurring, Snapshot, Summary, Syncable } from '../types';
import { Backup } from '../utils/backup';
import { mergeById, purgeTombstones } from '../utils/merge';
import { upsertMonthlySnapshot } from '../utils/snapshot';
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
  /** 월별 순자산 스냅샷 — 직접 고치지 않고 syncSnapshot 으로만 쌓인다 */
  snapshots: Snapshot[];

  kindOps: Ops<AssetKind>;
  assetOps: Ops<Asset>;
  loanOps: Ops<Loan>;
  recurringOps: Ops<Recurring>;
  goalOps: Ops<Goal>;

  /**
   * 이번 달 스냅샷을 summary 에 맞춘다 (없으면 만들고, 있으면 덮어쓴다).
   * App 이 summary 가 바뀔 때마다 부른다. 숫자가 그대로면 아무것도 안 바뀐다.
   */
  syncSnapshot: (summary: Summary, today: DateKey) => void;

  /** 삭제 취소 — 툼스톤을 되살린다 */
  restore: (coll: CollName, id: string) => void;
  /** 툼스톤을 진짜로 지운다 */
  purge: (coll: CollName, id: string) => void;

  importBackup: (b: Backup) => void;
  resetAll: () => void;
}

export type CollName = 'kinds' | 'assets' | 'loans' | 'recurrings' | 'goals';

/** 지운 지 90일이 넘은 툼스톤은 휴지통에서도 치운다 — 되살릴 일이 없는 흔적이 쌓이지 않게 */
const TOMBSTONE_TTL_MS = 90 * 86_400_000;

export function useAssets(newId: () => string): AssetStore {
  // 시작할 때 한 번 오래된 툼스톤을 정리한다 (저장은 아래 effect 가 상태 그대로 한다)
  const [kinds, setKinds] = useState<AssetKind[]>(
    () => purgeTombstones(load(KEYS.kinds, DEFAULT_KINDS), TOMBSTONE_TTL_MS),
  );
  const [assets, setAssets] = useState<Asset[]>(
    () => purgeTombstones(load(KEYS.assets, []), TOMBSTONE_TTL_MS),
  );
  const [loans, setLoans] = useState<Loan[]>(
    () => purgeTombstones(load(KEYS.loans, []), TOMBSTONE_TTL_MS),
  );
  const [recurrings, setRecurrings] = useState<Recurring[]>(
    () => purgeTombstones(load(KEYS.recurrings, []), TOMBSTONE_TTL_MS),
  );
  const [goals, setGoals] = useState<Goal[]>(
    () => purgeTombstones(load(KEYS.goals, []), TOMBSTONE_TTL_MS),
  );
  const [snapshots, setSnapshots] = useState<Snapshot[]>(
    () => purgeTombstones(load(KEYS.snapshots, []), TOMBSTONE_TTL_MS),
  );

  useEffect(() => { save(KEYS.kinds, kinds); }, [kinds]);
  useEffect(() => { save(KEYS.assets, assets); }, [assets]);
  useEffect(() => { save(KEYS.loans, loans); }, [loans]);
  useEffect(() => { save(KEYS.recurrings, recurrings); }, [recurrings]);
  useEffect(() => { save(KEYS.goals, goals); }, [goals]);
  useEffect(() => { save(KEYS.snapshots, snapshots); }, [snapshots]);

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

  // upsertMonthlySnapshot 은 바뀐 게 없으면 같은 배열을 돌려주므로 setState 가 렌더를 일으키지 않는다
  const syncSnapshot = useCallback((summary: Summary, today: DateKey) => {
    setSnapshots(prev => upsertMonthlySnapshot(prev, summary, today));
  }, []);

  const importBackup = useCallback((b: Backup) => {
    setKinds(prev => mergeById(prev, b.kinds));
    setAssets(prev => mergeById(prev, b.assets));
    setLoans(prev => mergeById(prev, b.loans));
    setRecurrings(prev => mergeById(prev, b.recurrings));
    setGoals(prev => mergeById(prev, b.goals));
    setSnapshots(prev => mergeById(prev, b.snapshots ?? []));
  }, []);

  const resetAll = useCallback(() => {
    clearAll();
    setKinds(DEFAULT_KINDS);
    setAssets([]);
    setLoans([]);
    setRecurrings([]);
    setGoals([]);
    setSnapshots([]);
  }, []);

  return {
    kinds, assets, loans, recurrings, goals, snapshots,
    kindOps: makeOps(kinds, setKinds),
    assetOps: makeOps(assets, setAssets),
    loanOps: makeOps(loans, setLoans),
    recurringOps: makeOps(recurrings, setRecurrings),
    goalOps: makeOps(goals, setGoals),
    syncSnapshot,
    restore, purge, importBackup, resetAll,
  };
}

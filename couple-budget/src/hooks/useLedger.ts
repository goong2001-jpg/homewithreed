import { Dispatch, SetStateAction, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CollName, DEFAULT_PERSONS, Expense, ExpenseCategory, FixedExpense, IncomeEntry,
  MonthKey, Person, RemoteBatch, Syncable, SyncSettings,
} from '../types';
import { KEYS, load, save } from '../utils/storage';
import { mergeById } from '../utils/merge';
import { Backup } from '../utils/backup';
import { addMonths, monthIncome, monthOf } from '../utils/budget';
import { newId } from '../utils/id';
import { useSync } from './useSync';

/**
 * 앱의 단일 진실 공급원.
 *
 * 원칙: **모든 변경은 로컬 우선.** 네트워크를 절대 await 하지 않는다.
 * localStorage에 먼저 쓰고 화면을 즉시 갱신한 뒤, 클라우드로는 던져만 놓는다.
 * → 지하철에서도, Firebase 설정이 없어도 앱은 똑같이 동작한다.
 *
 * 영속화 방식은 receipt-tracker/src/hooks/useTransactions.ts 와 같다:
 * 모듈 레벨 키 · load()의 try/catch 폴백 · setState 업데이터 안에서 save().
 */
/**
 * 사람 목록을 읽는다.
 * 예전 버전은 설정(couple_budget_settings) 안에 두어 동기화가 안 됐다.
 * 처음 한 번 자기 저장소로 옮긴다 — updatedAt 은 0으로 둬서,
 * 상대 폰에서 실제로 고친 내용이 항상 이기게 한다.
 */
function loadPersons(): Person[] {
  const saved = load<Person[]>(KEYS.persons, []);
  if (saved.length) return saved;

  const legacy = load<{ persons?: Person[] }>(KEYS.settings, {});
  const base = legacy.persons?.length ? legacy.persons : DEFAULT_PERSONS;
  const migrated = base.map(p => ({
    ...p,
    createdAt: typeof p.createdAt === 'number' ? p.createdAt : 0,
    updatedAt: typeof p.updatedAt === 'number' ? p.updatedAt : 0,
  }));
  save(KEYS.persons, migrated);
  return migrated;
}

export function useLedger(sync: SyncSettings, month: MonthKey) {
  const [persons, setPersons] = useState<Person[]>(loadPersons);
  const [incomes, setIncomes] = useState<IncomeEntry[]>(() => load(KEYS.incomes, []));
  const [fixed, setFixed] = useState<FixedExpense[]>(() => load(KEYS.fixedExpenses, []));
  const [expenses, setExpenses] = useState<Expense[]>(() => load(KEYS.expenses, []));

  /** 클라우드에서 온 스냅샷을 로컬과 합친다 (id 기준 last-write-wins) */
  const onBatch = useCallback((batch: RemoteBatch) => {
    switch (batch.coll) {
      case 'persons':
        setPersons(prev => {
          const next = mergeById(prev, batch.records);
          save(KEYS.persons, next);
          return next;
        });
        break;
      case 'incomes':
        setIncomes(prev => {
          const next = mergeById(prev, batch.records);
          save(KEYS.incomes, next);
          return next;
        });
        break;
      case 'fixedExpenses':
        setFixed(prev => {
          const next = mergeById(prev, batch.records);
          save(KEYS.fixedExpenses, next);
          return next;
        });
        break;
      case 'expenses':
        setExpenses(prev => {
          const next = mergeById(prev, batch.records);
          save(KEYS.expenses, next);
          return next;
        });
        break;
    }
  }, []);

  const { status, error, push, fetchAllExpenses, isLive } = useSync({ sync, month, onBatch });

  /** 로컬에 저장(수정이면 교체, 아니면 추가)하고 클라우드로 던진다 */
  const commit = useCallback(<T extends Syncable>(
    coll: CollName,
    storageKey: string,
    setter: Dispatch<SetStateAction<T[]>>,
    rec: T,
  ) => {
    setter(prev => {
      const exists = prev.some(r => r.id === rec.id);
      const next = exists
        ? prev.map(r => (r.id === rec.id ? rec : r))
        : [rec, ...prev];
      save(storageKey, next);
      return next;
    });
    push(coll, rec);
  }, [push]);

  /** 삭제는 툼스톤으로 표시한다 — 이유는 utils/merge.ts 주석 참고 */
  const softDelete = useCallback(<T extends Syncable>(
    coll: CollName,
    storageKey: string,
    setter: Dispatch<SetStateAction<T[]>>,
    id: string,
  ) => {
    setter(prev => {
      const target = prev.find(r => r.id === id);
      if (!target) return prev;
      const tomb = { ...target, deleted: true, updatedAt: Date.now() };
      const next = prev.map(r => (r.id === id ? tomb : r));
      save(storageKey, next);
      push(coll, tomb);
      return next;
    });
  }, [push]);

  // ------------------------------- 사람 -------------------------------

  const savePerson = useCallback((input: {
    id?: string; name: string; color: string; order: number;
  }) => {
    const now = Date.now();
    const existing = input.id ? persons.find(p => p.id === input.id) : undefined;
    const rec: Person = {
      id: input.id ?? newId(),
      name: input.name,
      color: input.color,
      order: input.order,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    commit('persons', KEYS.persons, setPersons, rec);
  }, [persons, commit]);

  const deletePerson = useCallback(
    (id: string) => softDelete('persons', KEYS.persons, setPersons, id),
    [softDelete],
  );

  // ------------------------------- 수입 -------------------------------

  const saveIncome = useCallback((input: {
    id?: string; month: MonthKey; personId: string; amount: number; memo: string;
  }) => {
    const now = Date.now();
    const rec: IncomeEntry = {
      id: input.id ?? newId(),
      month: input.month,
      personId: input.personId,
      amount: input.amount,
      memo: input.memo,
      createdAt: now,
      updatedAt: now,
    };
    commit('incomes', KEYS.incomes, setIncomes, rec);
  }, [commit]);

  const deleteIncome = useCallback(
    (id: string) => softDelete('incomes', KEYS.incomes, setIncomes, id),
    [softDelete],
  );

  // ----------------------------- 고정지출 -----------------------------

  const saveFixed = useCallback((input: {
    id?: string; name: string; amount: number;
    startMonth: MonthKey; endMonth: MonthKey | null; personId: string | null;
  }) => {
    const now = Date.now();
    const rec: FixedExpense = {
      id: input.id ?? newId(),
      name: input.name,
      amount: input.amount,
      startMonth: input.startMonth,
      endMonth: input.endMonth,
      personId: input.personId,
      createdAt: now,
      updatedAt: now,
    };
    commit('fixedExpenses', KEYS.fixedExpenses, setFixed, rec);
  }, [commit]);

  const deleteFixed = useCallback(
    (id: string) => softDelete('fixedExpenses', KEYS.fixedExpenses, setFixed, id),
    [softDelete],
  );

  // ----------------------------- 변동지출 -----------------------------

  const saveExpense = useCallback((input: {
    id?: string; date: string; amount: number;
    category: ExpenseCategory; content: string; personId: string;
  }) => {
    const now = Date.now();
    const rec: Expense = {
      id: input.id ?? newId(),
      date: input.date,
      month: monthOf(input.date),
      amount: input.amount,
      category: input.category,
      content: input.content,
      personId: input.personId,
      createdAt: now,
      updatedAt: now,
    };
    commit('expenses', KEYS.expenses, setExpenses, rec);
  }, [commit]);

  const deleteExpense = useCallback(
    (id: string) => softDelete('expenses', KEYS.expenses, setExpenses, id),
    [softDelete],
  );

  /**
   * 지난달 수입을 이 달로 그대로 가져온다.
   * 급여는 보통 매달 같으므로, 달이 바뀔 때마다 처음부터 입력하지 않도록 한 번에 복사한다.
   * (달마다 금액이 다를 수 있으니 자동이 아니라 사용자가 누를 때만 실행한다)
   */
  const copyIncomeFromPrevMonth = useCallback((target: MonthKey) => {
    const from = addMonths(target, -1);
    const source = incomes.filter(i => !i.deleted && i.month === from);
    for (const src of source) {
      const existing = incomes.find(
        i => !i.deleted && i.month === target && i.personId === src.personId,
      );
      const now = Date.now();
      commit('incomes', KEYS.incomes, setIncomes, {
        id: existing?.id ?? newId(),
        month: target,
        personId: src.personId,
        amount: src.amount,
        memo: src.memo,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      });
    }
    return source.reduce((s, i) => s + i.amount, 0);
  }, [incomes, commit]);

  /**
   * 배우자가 보낸 파일을 내 기록과 합친다 (Firebase 없이 쓰는 경로).
   * 덮어쓰지 않고 id 기준으로 합치므로, 서로 주고받기만 하면 양쪽이 같아진다.
   * 동기화를 켜 둔 상태라면 합친 결과를 클라우드로도 올린다.
   */
  const importBackup = useCallback((backup: Backup) => {
    /**
     * ⚠️ 병합을 setState 업데이터 안에서 하면 안 된다.
     * 업데이터는 나중에 실행되므로 '몇 건 들어왔는지'를 바로 알 수 없고,
     * 클라우드로 올릴 목록도 빈 채로 남는다.
     * 그래서 지금 상태값으로 먼저 계산한 뒤 결과를 통째로 넣는다.
     */
    const apply = <T extends Syncable>(
      coll: CollName,
      storageKey: string,
      setter: Dispatch<SetStateAction<T[]>>,
      current: T[],
      incoming: T[],
    ): number => {
      if (!incoming.length) return 0;

      const before = new Map(current.map(r => [r.id, r]));
      const next = mergeById(current, incoming);
      // 새로 들어왔거나 내용이 바뀐 것만 추린다
      const changed = next.filter(r => {
        const old = before.get(r.id);
        return !old || old.updatedAt !== r.updatedAt;
      });
      if (!changed.length) return 0;

      save(storageKey, next);
      setter(next);
      for (const r of changed) push(coll, r);   // 동기화 중이면 클라우드에도 반영
      return changed.length;
    };

    return {
      persons: apply('persons', KEYS.persons, setPersons, persons, backup.persons),
      incomes: apply('incomes', KEYS.incomes, setIncomes, incomes, backup.incomes),
      fixed: apply('fixedExpenses', KEYS.fixedExpenses, setFixed, fixed, backup.fixedExpenses),
      expenses: apply('expenses', KEYS.expenses, setExpenses, expenses, backup.expenses),
    };
  }, [persons, incomes, fixed, expenses, push]);

  // -------------------------- 클라우드 보조작업 --------------------------

  /** '지금까지 기록 클라우드로 올리기' — 명시적으로 눌렀을 때만 실행한다 */
  const uploadAll = useCallback(() => {
    let n = 0;
    for (const r of persons) { push('persons', r); n++; }
    for (const r of incomes) { push('incomes', r); n++; }
    for (const r of fixed) { push('fixedExpenses', r); n++; }
    for (const r of expenses) { push('expenses', r); n++; }
    return n;
  }, [persons, incomes, fixed, expenses, push]);

  /**
   * 연결된 뒤 이 기기의 기존 기록을 방에 딱 한 번 올린다.
   *
   * 왜 필요한가: 예전 버전에서 만든 사람 목록처럼 '이미 폰에만 있던' 기록은
   * 아무도 손대지 않으면 영영 클라우드로 안 올라간다. 그러면 상대 폰에서 볼 수 없다.
   *
   * 왜 조금 기다리는가: 먼저 들어온 스냅샷을 병합한 뒤에 올려야
   * 이 기기가 들고 있던 낡은 사본으로 클라우드를 덮어쓰지 않는다.
   * (push 는 setDoc 이라 서버에서 updatedAt 을 비교해주지 않는다)
   */
  const uploadAllRef = useRef<() => number>(() => 0);
  uploadAllRef.current = uploadAll;

  useEffect(() => {
    if (!isLive) return;
    const code = sync.roomCode.trim();
    if (!code) return;
    if (load<string>(KEYS.seeded, '') === code) return;   // 이 방엔 이미 올렸다

    // uploadAll 은 ref 로 읽는다 — 의존성에 넣으면 기록이 바뀔 때마다
    // 타이머가 다시 시작돼서 언제 올라갈지 예측할 수 없게 된다
    const t = setTimeout(() => {
      uploadAllRef.current();
      save(KEYS.seeded, code);
    }, 2500);
    return () => clearTimeout(t);
  }, [isLive, sync.roomCode]);

  /** '지난 데이터 모두 불러오기' — 새 폰에서 전체 이력을 한 번 받아온다 */
  const pullAllExpenses = useCallback(async (): Promise<number> => {
    const remote = await fetchAllExpenses();
    if (!remote.length) return 0;
    setExpenses(prev => {
      const next = mergeById(prev, remote);
      save(KEYS.expenses, next);
      return next;
    });
    return remote.length;
  }, [fetchAllExpenses]);

  /** 이 기기의 모든 기록을 지운다 (클라우드는 건드리지 않는다) */
  const clearLocal = useCallback(() => {
    setIncomes([]); setFixed([]); setExpenses([]);
    save(KEYS.incomes, []); save(KEYS.fixedExpenses, []); save(KEYS.expenses, []);
  }, []);

  const counts = useMemo(
    () => ({
      persons: persons.filter(r => !r.deleted).length,
      incomes: incomes.filter(r => !r.deleted).length,
      fixed: fixed.filter(r => !r.deleted).length,
      expenses: expenses.filter(r => !r.deleted).length,
    }),
    [persons, incomes, fixed, expenses],
  );

  return {
    persons, incomes, fixed, expenses,
    savePerson, deletePerson,
    saveIncome, deleteIncome,
    saveFixed, deleteFixed,
    saveExpense, deleteExpense,
    copyIncomeFromPrevMonth,
    /** 지난달에 등록된 수입 합계 — 이 달이 비었을 때 '지난달과 같이' 버튼에 쓴다 */
    prevMonthIncome: monthIncome(incomes, addMonths(month, -1)),
    importBackup,
    uploadAll, pullAllExpenses, clearLocal,
    counts,
    syncStatus: status, syncError: error, isLive,
  };
}

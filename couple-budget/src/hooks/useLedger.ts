import { Dispatch, SetStateAction, useCallback, useMemo, useState } from 'react';
import {
  CollName, Expense, ExpenseCategory, FixedExpense, IncomeEntry, MonthKey,
  RemoteBatch, Syncable, SyncSettings,
} from '../types';
import { KEYS, load, save } from '../utils/storage';
import { mergeById } from '../utils/merge';
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
export function useLedger(sync: SyncSettings, month: MonthKey) {
  const [incomes, setIncomes] = useState<IncomeEntry[]>(() => load(KEYS.incomes, []));
  const [fixed, setFixed] = useState<FixedExpense[]>(() => load(KEYS.fixedExpenses, []));
  const [expenses, setExpenses] = useState<Expense[]>(() => load(KEYS.expenses, []));

  /** 클라우드에서 온 스냅샷을 로컬과 합친다 (id 기준 last-write-wins) */
  const onBatch = useCallback((batch: RemoteBatch) => {
    switch (batch.coll) {
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

  // -------------------------- 클라우드 보조작업 --------------------------

  /** '지금까지 기록 클라우드로 올리기' — 명시적으로 눌렀을 때만 실행한다 */
  const uploadAll = useCallback(() => {
    let n = 0;
    for (const r of incomes) { push('incomes', r); n++; }
    for (const r of fixed) { push('fixedExpenses', r); n++; }
    for (const r of expenses) { push('expenses', r); n++; }
    return n;
  }, [incomes, fixed, expenses, push]);

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
      incomes: incomes.filter(r => !r.deleted).length,
      fixed: fixed.filter(r => !r.deleted).length,
      expenses: expenses.filter(r => !r.deleted).length,
    }),
    [incomes, fixed, expenses],
  );

  return {
    incomes, fixed, expenses,
    saveIncome, deleteIncome,
    saveFixed, deleteFixed,
    saveExpense, deleteExpense,
    copyIncomeFromPrevMonth,
    /** 지난달에 등록된 수입 합계 — 이 달이 비었을 때 '지난달과 같이' 버튼에 쓴다 */
    prevMonthIncome: monthIncome(incomes, addMonths(month, -1)),
    uploadAll, pullAllExpenses, clearLocal,
    counts,
    syncStatus: status, syncError: error, isLive,
  };
}

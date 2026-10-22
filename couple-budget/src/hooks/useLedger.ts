import { Dispatch, SetStateAction, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CategoryBudget, CollName, DEFAULT_PERSONS, Expense, ExpenseCategory, FixedExpense,
  GiftDirection, GiftEntry, GiftKind, IncomeEntry, MonthKey, Person, RemoteBatch, Syncable,
  SyncSettings, budgetIdOf,
} from '../types';
import { KEYS, load, remove, save } from '../utils/storage';
import { localWinners, mergeById } from '../utils/merge';
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
  const [gifts, setGifts] = useState<GiftEntry[]>(() => load(KEYS.gifts, []));
  const [budgets, setBudgets] = useState<CategoryBudget[]>(() => load(KEYS.budgets, []));

  /**
   * 스냅샷 병합에서 로컬이 이긴 레코드 — 렌더가 끝난 뒤 서버로 되밀어 올린다.
   *
   * 왜 되밀어 올리나: push 는 setDoc 이라 서버가 updatedAt 을 비교하지 않는다.
   * 오프라인에서 묵힌 낡은 수정이 나중에 올라와 상대 폰의 최신 기록을 덮어쓰면,
   * 이 기기는 mergeById 로 제 최신본을 지키지만 서버는 낡은 채로 남는다.
   * 그 최신본을 다시 올려야 서버와 상대 폰도 같은 값으로 수렴한다.
   *
   * 왜 업데이터 안에서 바로 push 하지 않나: StrictMode 가 업데이터를 두 번 돌린다.
   * 승자는 Map 에 모아두고(두 번 넣어도 하나) 렌더 뒤 effect 에서 한 번만 올린다.
   */
  const pendingPushRef = useRef(new Map<string, { coll: CollName; rec: Syncable }>());
  /**
   * 되밀어 올린 (컬렉션·id·updatedAt) 묶음. 같은 판본은 한 번만 올린다 —
   * 서버가 그 쓰기를 거부하면(보안 규칙 등) 스냅샷이 원격값으로 되돌아오고,
   * 그때마다 다시 올리면 끝없는 핑퐁이 되기 때문이다.
   */
  const pushedBackRef = useRef(new Set<string>());

  /** 들어온 레코드를 id 기준으로 합치고, 로컬이 이긴 것은 되밀어 올릴 목록에 적는다 */
  const mergeIn = useCallback(<T extends Syncable>(
    coll: CollName,
    storageKey: string,
    setter: Dispatch<SetStateAction<T[]>>,
    incoming: T[],
  ) => {
    setter(prev => {
      for (const w of localWinners(prev, incoming)) {
        pendingPushRef.current.set(`${coll}:${w.id}`, { coll, rec: w });
      }
      const next = mergeById(prev, incoming);
      save(storageKey, next);
      return next;
    });
  }, []);

  /** 클라우드에서 온 스냅샷을 로컬과 합친다 (id 기준 last-write-wins) */
  const onBatch = useCallback((batch: RemoteBatch) => {
    switch (batch.coll) {
      case 'persons':
        mergeIn('persons', KEYS.persons, setPersons, batch.records);
        break;
      case 'incomes':
        mergeIn('incomes', KEYS.incomes, setIncomes, batch.records);
        break;
      case 'fixedExpenses':
        mergeIn('fixedExpenses', KEYS.fixedExpenses, setFixed, batch.records);
        break;
      case 'expenses':
        mergeIn('expenses', KEYS.expenses, setExpenses, batch.records);
        break;
      case 'gifts':
        mergeIn('gifts', KEYS.gifts, setGifts, batch.records);
        break;
      case 'budgets':
        mergeIn('budgets', KEYS.budgets, setBudgets, batch.records);
        break;
    }
  }, [mergeIn]);

  const { status, error, push, fetchAllExpenses, isLive } = useSync({ sync, month, onBatch });

  // 병합에서 로컬이 이긴 레코드를 서버로 되밀어 올린다 (mergeIn 주석 참고).
  // 의존성 없이 매 렌더 뒤에 돌지만, 목록이 비어 있으면 아무 일도 하지 않는다.
  useEffect(() => {
    const pending = pendingPushRef.current;
    if (!pending.size) return;
    pending.forEach(({ coll, rec }) => {
      const key = `${coll}:${rec.id}:${rec.updatedAt}`;
      if (pushedBackRef.current.has(key)) return;
      pushedBackRef.current.add(key);
      push(coll, rec);
    });
    pending.clear();
  });

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

  /**
   * 삭제는 툼스톤으로 표시한다 — 이유는 utils/merge.ts 주석 참고.
   * 툼스톤은 commit 처럼 업데이터 '밖에서' 만들고 올린다 —
   * 안에서 push 하면 StrictMode 가 업데이터를 두 번 돌려 두 번 올라간다.
   */
  const softDelete = useCallback(<T extends Syncable>(
    coll: CollName,
    storageKey: string,
    setter: Dispatch<SetStateAction<T[]>>,
    list: T[],
    id: string,
  ) => {
    const target = list.find(r => r.id === id);
    if (!target) return;
    const tomb = { ...target, deleted: true, updatedAt: Date.now() };
    setter(prev => {
      const next = prev.map(r => (r.id === id ? tomb : r));
      save(storageKey, next);
      return next;
    });
    push(coll, tomb);
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
    (id: string) => softDelete('persons', KEYS.persons, setPersons, persons, id),
    [persons, softDelete],
  );

  // ------------------------------- 수입 -------------------------------

  const saveIncome = useCallback((input: {
    id?: string; month: MonthKey; personId: string; amount: number; memo: string;
  }) => {
    const now = Date.now();
    const existing = input.id ? incomes.find(i => i.id === input.id) : undefined;
    const rec: IncomeEntry = {
      id: input.id ?? newId(),
      month: input.month,
      personId: input.personId,
      amount: input.amount,
      memo: input.memo,
      // 수정일 땐 처음 만든 시각을 지킨다 (정렬 기준이라 바뀌면 순서가 튄다)
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    commit('incomes', KEYS.incomes, setIncomes, rec);
  }, [incomes, commit]);

  const deleteIncome = useCallback(
    (id: string) => softDelete('incomes', KEYS.incomes, setIncomes, incomes, id),
    [incomes, softDelete],
  );

  // ----------------------------- 고정지출 -----------------------------

  const saveFixed = useCallback((input: {
    id?: string; name: string; amount: number;
    startMonth: MonthKey; endMonth: MonthKey | null; personId: string | null;
  }) => {
    const now = Date.now();
    const existing = input.id ? fixed.find(f => f.id === input.id) : undefined;
    const rec: FixedExpense = {
      id: input.id ?? newId(),
      name: input.name,
      amount: input.amount,
      startMonth: input.startMonth,
      endMonth: input.endMonth,
      personId: input.personId,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    commit('fixedExpenses', KEYS.fixedExpenses, setFixed, rec);
  }, [fixed, commit]);

  const deleteFixed = useCallback(
    (id: string) => softDelete('fixedExpenses', KEYS.fixedExpenses, setFixed, fixed, id),
    [fixed, softDelete],
  );

  // ----------------------------- 변동지출 -----------------------------

  const saveExpense = useCallback((input: {
    id?: string; date: string; amount: number;
    category: ExpenseCategory; content: string; personId: string;
  }) => {
    const now = Date.now();
    const existing = input.id ? expenses.find(e => e.id === input.id) : undefined;
    const rec: Expense = {
      id: input.id ?? newId(),
      date: input.date,
      month: monthOf(input.date),
      amount: input.amount,
      category: input.category,
      content: input.content,
      personId: input.personId,
      // 금액·메모를 고쳐도 목록에서 자리가 바뀌지 않도록 처음 만든 시각을 지킨다
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    commit('expenses', KEYS.expenses, setExpenses, rec);
  }, [expenses, commit]);

  const deleteExpense = useCallback(
    (id: string) => softDelete('expenses', KEYS.expenses, setExpenses, expenses, id),
    [expenses, softDelete],
  );

  // -------------------------- 경조사 · 용돈 --------------------------
  // 저금통 계산에는 들어가지 않는다 (types/index.ts GiftEntry 주석 참고)

  const saveGift = useCallback((input: {
    id?: string; date: string; direction: GiftDirection; amount: number;
    kind: GiftKind; counterparty: string; personId: string; memo: string;
  }) => {
    const now = Date.now();
    const existing = input.id ? gifts.find(g => g.id === input.id) : undefined;
    const rec: GiftEntry = {
      id: input.id ?? newId(),
      date: input.date,
      month: monthOf(input.date),
      direction: input.direction,
      amount: input.amount,
      kind: input.kind,
      counterparty: input.counterparty,
      personId: input.personId,
      memo: input.memo,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    commit('gifts', KEYS.gifts, setGifts, rec);
  }, [gifts, commit]);

  const deleteGift = useCallback(
    (id: string) => softDelete('gifts', KEYS.gifts, setGifts, gifts, id),
    [gifts, softDelete],
  );

  // -------------------------- 카테고리별 월 상한 --------------------------

  /**
   * 카테고리 하나의 월 상한을 정한다. 0 이하(빈 칸)는 '상한 없음' = 툼스톤.
   * id 가 카테고리에서 정해지므로(budgetIdOf) 같은 카테고리에 두 건이 생기지 않는다.
   */
  const setCategoryBudget = useCallback((category: ExpenseCategory, monthlyLimit: number) => {
    const id = budgetIdOf(category);
    const existing = budgets.find(b => b.id === id);
    const limit = Math.max(0, Math.round(monthlyLimit));

    if (limit <= 0) {
      // 없던 상한을 지우는 건 아무 일도 아니다 — 툼스톤을 괜히 만들지 않는다
      if (!existing || existing.deleted) return;
      softDelete('budgets', KEYS.budgets, setBudgets, budgets, id);
      return;
    }
    if (existing && !existing.deleted && existing.monthlyLimit === limit) return;

    // 툼스톤이던 카테고리에 다시 상한을 넣으면 deleted 없는 새 레코드로 되살린다
    const rec: CategoryBudget = { id, category, monthlyLimit: limit, updatedAt: Date.now() };
    commit('budgets', KEYS.budgets, setBudgets, rec);
  }, [budgets, commit, softDelete]);

  /**
   * 지난달 수입을 이 달로 그대로 가져온다.
   * 급여는 보통 매달 같으므로, 달이 바뀔 때마다 처음부터 입력하지 않도록 한 번에 복사한다.
   * (달마다 금액이 다를 수 있으니 자동이 아니라 사용자가 누를 때만 실행한다)
   *
   * ⚠️ 이 달에 수입이 이미 하나라도 있으면 아무것도 하지 않는다.
   * 한 사람이 급여 + 부업 일당처럼 여러 건을 가질 수 있으므로
   * '사람별로 덮어쓰기'가 성립하지 않는다 — 그대로 두면 같은 급여가 두 번 쌓인다.
   */
  const copyIncomeFromPrevMonth = useCallback((target: MonthKey) => {
    if (incomes.some(i => !i.deleted && i.month === target)) return 0;

    const source = incomes.filter(i => !i.deleted && i.month === addMonths(target, -1));
    for (const src of source) {
      const now = Date.now();
      commit('incomes', KEYS.incomes, setIncomes, {
        id: newId(),
        month: target,
        personId: src.personId,
        amount: src.amount,
        memo: src.memo,
        createdAt: now,
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
      gifts: apply('gifts', KEYS.gifts, setGifts, gifts, backup.gifts),
      budgets: apply('budgets', KEYS.budgets, setBudgets, budgets, backup.budgets),
    };
  }, [persons, incomes, fixed, expenses, gifts, budgets, push]);

  // -------------------------- 클라우드 보조작업 --------------------------

  /** '지금까지 기록 클라우드로 올리기' — 명시적으로 눌렀을 때만 실행한다 */
  const uploadAll = useCallback(() => {
    let n = 0;
    for (const r of persons) { push('persons', r); n++; }
    for (const r of incomes) { push('incomes', r); n++; }
    for (const r of fixed) { push('fixedExpenses', r); n++; }
    for (const r of expenses) { push('expenses', r); n++; }
    for (const r of gifts) { push('gifts', r); n++; }
    for (const r of budgets) { push('budgets', r); n++; }
    return n;
  }, [persons, incomes, fixed, expenses, gifts, budgets, push]);

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
    mergeIn('expenses', KEYS.expenses, setExpenses, remote);
    return remote.length;
  }, [fetchAllExpenses, mergeIn]);

  /**
   * 이 기기의 모든 기록을 지운다 (클라우드는 건드리지 않는다).
   * 사람 목록은 기본값으로 되돌리고, '이 방에 이미 올렸다' 표시도 지운다 —
   * 안 지우면 같은 방에 다시 연결했을 때 기록이 다시 올라가지 않는다.
   */
  const clearLocal = useCallback(() => {
    setIncomes([]); setFixed([]); setExpenses([]); setGifts([]); setBudgets([]);
    save(KEYS.incomes, []); save(KEYS.fixedExpenses, []);
    save(KEYS.expenses, []); save(KEYS.gifts, []); save(KEYS.budgets, []);
    remove(KEYS.persons);
    setPersons(loadPersons());
    remove(KEYS.seeded);
  }, []);

  const counts = useMemo(
    () => ({
      persons: persons.filter(r => !r.deleted).length,
      incomes: incomes.filter(r => !r.deleted).length,
      fixed: fixed.filter(r => !r.deleted).length,
      expenses: expenses.filter(r => !r.deleted).length,
      gifts: gifts.filter(r => !r.deleted).length,
      budgets: budgets.filter(r => !r.deleted).length,
    }),
    [persons, incomes, fixed, expenses, gifts, budgets],
  );

  return {
    persons, incomes, fixed, expenses, gifts, budgets,
    setCategoryBudget,
    savePerson, deletePerson,
    saveIncome, deleteIncome,
    saveFixed, deleteFixed,
    saveExpense, deleteExpense,
    saveGift, deleteGift,
    copyIncomeFromPrevMonth,
    /** 지난달에 등록된 수입 합계 — 이 달이 비었을 때 '지난달과 같이' 버튼에 쓴다 */
    prevMonthIncome: monthIncome(incomes, addMonths(month, -1)),
    importBackup,
    uploadAll, pullAllExpenses, clearLocal,
    counts,
    syncStatus: status, syncError: error, isLive,
  };
}

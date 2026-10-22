import React, { useCallback, useMemo, useState } from 'react';
import {
  AddMode, Expense, GiftDirection, GiftEntry, IncomeEntry, View, budgetIdOf,
} from './types';
import {
  alive, budgetStatus, computeMonthBudget, frequentExpenses, limitAlert, monthExpenses, monthOf,
} from './utils/budget';
import { shortWon } from './utils/format';
import { isReportDay, reportAnchor, weeklyReport } from './utils/weekly';
import { useAppSettings } from './hooks/useAppSettings';
import { useMonthNav } from './hooks/useMonthNav';
import { useLedger } from './hooks/useLedger';
import TabBar, { TAB_BAR_HEIGHT } from './components/TabBar';
import HomeView from './components/HomeView';
import AddView from './components/AddView';
import HistoryView from './components/HistoryView';
import TopSpendView from './components/TopSpendView';
import GiftsView from './components/GiftsView';
import GiftForm from './components/GiftForm';
import SettingsView from './components/SettingsView';
import Toast, { ToastMessage } from './components/Toast';

export default function App() {
  const [view, setView] = useState<View>('home');
  // 내역 화면의 사람 필터. 홈에서 사람을 눌러 들어올 수 있어야 해서 여기서 들고 있다.
  const [historyPerson, setHistoryPerson] = useState<string>('all');
  // 입력 화면이 지출을 받는지 수입을 받는지
  const [addMode, setAddMode] = useState<AddMode>('expense');
  // 고치는 중인 내역. 둘 다 null 이면 입력 화면은 '새로 쓰기'다
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [editingIncome, setEditingIncome] = useState<IncomeEntry | null>(null);
  // 경조사 적기/고치기 화면. null 이면 장부 목록을 보여준다
  // (탭을 따로 만들지 않는다 — 경조사 탭 안에서만 열리는 화면이라 탭 표시가 유지돼야 한다)
  const [giftForm, setGiftForm] =
    useState<{ entry?: GiftEntry; direction: GiftDirection } | null>(null);
  const { settings, setSync } = useAppSettings();
  const { month, prev, next, goToToday } = useMonthNav();
  const ledger = useLedger(settings.sync, month);

  // 모든 돈 계산은 여기서 한 번만 한다 — 아래 컴포넌트들은 계산하지 않는다
  const budget = useMemo(
    () => computeMonthBudget({
      month,
      incomes: ledger.incomes,
      fixed: ledger.fixed,
      expenses: ledger.expenses,
      persons: ledger.persons,
    }),
    [month, ledger.incomes, ledger.fixed, ledger.expenses, ledger.persons],
  );

  // 지운 사람은 화면에서 뺀다 (과거 내역 보존을 위해 데이터는 남겨둔다)
  const activePersons = useMemo(
    () => ledger.persons.filter(p => !p.deleted).sort((a, b) => a.order - b.order),
    [ledger.persons],
  );

  const nav = { onPrev: prev, onNext: next, onToday: goToToday };

  // ---- 카테고리별 월 상한 ----
  const budgetRows = useMemo(
    () => budgetStatus(monthExpenses(ledger.expenses, month), ledger.budgets),
    [ledger.expenses, ledger.budgets, month],
  );

  // ---- 자주 쓰는 지출 (최근 90일) ----
  const frequent = useMemo(() => frequentExpenses(ledger.expenses, new Date()), [ledger.expenses]);

  // ---- 주간 리포트 — 탭을 옮길 때마다 '오늘'을 다시 본다 (자정을 넘긴 채 켜 둔 폰) ----
  const weekly = useMemo(() => {
    const now = new Date();
    const report = weeklyReport(
      { incomes: ledger.incomes, fixed: ledger.fixed, expenses: ledger.expenses },
      reportAnchor(now),
    );
    return { report, showOnHome: isReportDay(now) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ledger.incomes, ledger.fixed, ledger.expenses, view]);

  // ---- 상한을 넘겼을 때 한 줄 알림 ----
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const clearToast = useCallback(() => setToast(null), []);

  /** 저장 전후의 그 카테고리 지출을 비교해 80%·100% 를 '이번에' 넘겼으면 알린다 */
  const { budgets, expenses, saveExpense } = ledger;
  const saveExpenseWithAlert: typeof saveExpense = useCallback(input => {
    const limitRec = budgets.find(b => b.id === budgetIdOf(input.category));
    const limit = limitRec && alive(limitRec) ? limitRec.monthlyLimit : 0;
    if (limit > 0) {
      const m = monthOf(input.date);
      const others = expenses.filter(
        e => alive(e) && e.month === m && e.category === input.category && e.id !== input.id,
      ).reduce((s, e) => s + e.amount, 0);
      const prev = input.id ? expenses.find(e => e.id === input.id) : undefined;
      // 고치는 중이면 원래 금액이 이미 들어 있던 상태가 '전'이다 (달·카테고리가 같을 때만)
      const wasHere = prev && alive(prev) && prev.month === m && prev.category === input.category;
      const before = others + (wasHere ? prev!.amount : 0);
      const after = others + input.amount;
      const kind = limitAlert(before, after, limit);
      if (kind) {
        setToast({
          key: Date.now(),
          tone: kind,
          text: kind === 'over'
            ? `🚨 ${input.category} 예산 ${shortWon(limit)}을 넘었어요 (${shortWon(after)})`
            : `⚠️ ${input.category} 예산의 80%를 썼어요 (${shortWon(limit)} 중 ${shortWon(after)})`,
        });
      }
    }
    saveExpense(input);
  }, [budgets, expenses, saveExpense]);

  /** 입력 화면을 깨끗한 '새로 쓰기' 상태로 연다 */
  function openAdd(mode: AddMode) {
    setEditingExpense(null);
    setEditingIncome(null);
    setAddMode(mode);
    setView('add');
  }

  function editExpense(e: Expense) {
    setEditingIncome(null);
    setEditingExpense(e);
    setAddMode('expense');
    setView('add');
  }

  function editIncome(i: IncomeEntry) {
    setEditingExpense(null);
    setEditingIncome(i);
    setAddMode('income');
    setView('add');
  }

  return (
    <>
      <div style={{ minHeight: '100vh', background: '#f8f9fa', paddingBottom: TAB_BAR_HEIGHT + 16 }}>
        {view === 'home' && (
          <HomeView
            month={month}
            budget={budget}
            fixedCount={ledger.counts.fixed}
            syncStatus={ledger.syncStatus}
            prevMonthIncome={ledger.prevMonthIncome}
            budgetRows={budgetRows}
            weeklyReport={weekly.showOnHome ? weekly.report : null}
            {...nav}
            onGoSettings={() => setView('settings')}
            onGoAdd={() => openAdd('expense')}
            onGoAddIncome={() => openAdd('income')}
            onCopyPrevIncome={() => ledger.copyIncomeFromPrevMonth(month)}
            onSelectPerson={id => { setHistoryPerson(id); setView('history'); }}
          />
        )}

        {view === 'add' && (
          <AddView
            month={month}
            persons={activePersons}
            budget={budget}
            mode={addMode}
            onModeChange={setAddMode}
            editingExpense={editingExpense ?? undefined}
            editingIncome={editingIncome ?? undefined}
            frequent={frequent}
            onSaveExpense={saveExpenseWithAlert}
            onDeleteExpense={ledger.deleteExpense}
            onSaveIncome={ledger.saveIncome}
            onDeleteIncome={ledger.deleteIncome}
            onDone={() => {
              // 새로 썼으면 홈으로 보내 저금통이 바뀌는 걸 보게 하고,
              // 고친 거면 보고 있던 화면으로 되돌려준다
              setView(editingExpense ? 'history' : editingIncome ? 'settings' : 'home');
              setEditingExpense(null);
              setEditingIncome(null);
            }}
          />
        )}

        {view === 'history' && (
          <HistoryView
            month={month}
            budget={budget}
            persons={activePersons}
            incomes={ledger.incomes}
            fixed={ledger.fixed}
            expenses={ledger.expenses}
            gifts={ledger.gifts}
            syncStatus={ledger.syncStatus}
            isLive={ledger.isLive}
            {...nav}
            personFilter={historyPerson}
            onPersonFilterChange={setHistoryPerson}
            onEditExpense={editExpense}
            onDeleteExpense={ledger.deleteExpense}
            onPullAll={() => { void ledger.pullAllExpenses(); }}
            onGoSettings={() => setView('settings')}
          />
        )}

        {view === 'top' && (
          <TopSpendView
            month={month}
            budget={budget}
            persons={activePersons}
            expenses={ledger.expenses}
            syncStatus={ledger.syncStatus}
            {...nav}
            onEditExpense={editExpense}
            onGoSettings={() => setView('settings')}
          />
        )}

        {view === 'gifts' && (
          giftForm ? (
            <GiftForm
              key={giftForm.entry?.id ?? `new-${giftForm.direction}`}
              persons={activePersons}
              initial={giftForm.entry}
              defaultDirection={giftForm.direction}
              onSave={ledger.saveGift}
              onDelete={ledger.deleteGift}
              onDone={() => setGiftForm(null)}
            />
          ) : (
            <GiftsView
              gifts={ledger.gifts}
              persons={activePersons}
              syncStatus={ledger.syncStatus}
              onAdd={d => setGiftForm({ direction: d })}
              onEdit={g => setGiftForm({ entry: g, direction: g.direction })}
              onGoSettings={() => setView('settings')}
            />
          )
        )}

        {view === 'settings' && (
          <SettingsView
            month={month}
            budget={budget}
            settings={settings}
            incomes={ledger.incomes}
            fixed={ledger.fixed}
            expenses={ledger.expenses}
            gifts={ledger.gifts}
            budgets={ledger.budgets}
            onSetBudget={ledger.setCategoryBudget}
            weeklyReport={weekly.report}
            syncStatus={ledger.syncStatus}
            syncError={ledger.syncError}
            counts={ledger.counts}
            {...nav}
            onAddIncome={() => openAdd('income')}
            onEditIncome={editIncome}
            onDeleteIncome={ledger.deleteIncome}
            onCopyPrevIncome={() => ledger.copyIncomeFromPrevMonth(month)}
            onSaveFixed={ledger.saveFixed}
            onDeleteFixed={ledger.deleteFixed}
            persons={activePersons}
            onSavePerson={ledger.savePerson}
            onDeletePerson={ledger.deletePerson}
            onSetSync={setSync}
            onImport={ledger.importBackup}
            onUploadAll={ledger.uploadAll}
            onClearLocal={ledger.clearLocal}
          />
        )}
      </div>

      <Toast toast={toast} onDone={clearToast} />

      <TabBar
        active={view}
        onChange={v => {
          // 탭으로 직접 들어올 땐 전체를 보여준다 (홈에서 사람을 눌러 들어온 경우만 필터 유지)
          if (v === 'history') setHistoryPerson('all');
          // 입력 탭은 언제나 '새로 쓰기'다 — 고치던 내역을 물고 들어가지 않는다
          // 경조사 탭도 언제나 목록부터 — 적다 만 화면을 물고 돌아오지 않는다
          setGiftForm(null);
          if (v === 'add') { openAdd('expense'); return; }
          setEditingExpense(null);
          setEditingIncome(null);
          setView(v);
        }}
      />
    </>
  );
}

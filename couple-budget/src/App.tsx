import React, { useMemo, useState } from 'react';
import { View } from './types';
import { computeMonthBudget } from './utils/budget';
import { useAppSettings } from './hooks/useAppSettings';
import { useMonthNav } from './hooks/useMonthNav';
import { useLedger } from './hooks/useLedger';
import TabBar, { TAB_BAR_HEIGHT } from './components/TabBar';
import HomeView from './components/HomeView';
import ExpenseForm from './components/ExpenseForm';
import HistoryView from './components/HistoryView';
import SettingsView from './components/SettingsView';

export default function App() {
  const [view, setView] = useState<View>('home');
  // 내역 화면의 사람 필터. 홈에서 사람을 눌러 들어올 수 있어야 해서 여기서 들고 있다.
  const [historyPerson, setHistoryPerson] = useState<string>('all');
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
            {...nav}
            onGoSettings={() => setView('settings')}
            onGoAdd={() => setView('add')}
            onCopyPrevIncome={() => ledger.copyIncomeFromPrevMonth(month)}
            onSelectPerson={id => { setHistoryPerson(id); setView('history'); }}
          />
        )}

        {view === 'add' && (
          <ExpenseForm
            persons={activePersons}
            budget={budget}
            onSave={ledger.saveExpense}
            // 저장 후 홈으로 보내서 저금통이 줄어드는 걸 보게 한다
            onDone={() => setView('home')}
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
            syncStatus={ledger.syncStatus}
            isLive={ledger.isLive}
            {...nav}
            personFilter={historyPerson}
            onPersonFilterChange={setHistoryPerson}
            onDeleteExpense={ledger.deleteExpense}
            onPullAll={() => { void ledger.pullAllExpenses(); }}
            onGoSettings={() => setView('settings')}
          />
        )}

        {view === 'settings' && (
          <SettingsView
            month={month}
            budget={budget}
            settings={settings}
            incomes={ledger.incomes}
            fixed={ledger.fixed}
            expenses={ledger.expenses}
            syncStatus={ledger.syncStatus}
            syncError={ledger.syncError}
            counts={ledger.counts}
            {...nav}
            onSaveIncome={ledger.saveIncome}
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

      <TabBar
        active={view}
        onChange={v => {
          // 탭으로 직접 들어올 땐 전체를 보여준다 (홈에서 사람을 눌러 들어온 경우만 필터 유지)
          if (v === 'history') setHistoryPerson('all');
          setView(v);
        }}
      />
    </>
  );
}

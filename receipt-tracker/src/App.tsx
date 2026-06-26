import React, { useState } from 'react';
import { View } from './types';
import { useTransactions } from './hooks/useTransactions';
import { useMonthNav } from './hooks/useMonthNav';
import MonthlyList from './components/MonthlyList';
import AddTransaction from './components/AddTransaction';
import SettingsView from './components/SettingsView';

export default function App() {
  const [view, setView] = useState<View>('list');
  const { transactions, addTransaction, deleteTransaction } = useTransactions();
  const { currentMonth, filtered, prev, next, goToToday } = useMonthNav(transactions);

  if (view === 'add') {
    return (
      <AddTransaction
        onSave={t => { addTransaction(t); setView('list'); }}
        onCancel={() => setView('list')}
      />
    );
  }

  if (view === 'settings') {
    return (
      <SettingsView
        transactions={filtered}
        currentMonth={currentMonth}
        onBack={() => setView('list')}
      />
    );
  }

  return (
    <MonthlyList
      transactions={filtered}
      currentMonth={currentMonth}
      onPrev={prev}
      onNext={next}
      onToday={goToToday}
      onAdd={() => setView('add')}
      onSettings={() => setView('settings')}
      onDelete={deleteTransaction}
    />
  );
}

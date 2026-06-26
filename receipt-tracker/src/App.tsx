import React, { useState } from 'react';
import { View } from './types';
import { useTransactions } from './hooks/useTransactions';
import { useSettings } from './hooks/useSettings';
import { useMonthNav } from './hooks/useMonthNav';
import MonthlyList from './components/MonthlyList';
import AddTransaction from './components/AddTransaction';
import SettingsView from './components/SettingsView';

export default function App() {
  const [view, setView] = useState<View>('list');
  const { transactions, addTransaction, deleteTransaction } = useTransactions();
  const { settings, setApiKey } = useSettings();
  const { currentMonth, filtered, prev, next, goToToday } = useMonthNav(transactions);

  if (view === 'add') {
    return (
      <AddTransaction
        apiKey={settings.claudeApiKey}
        onSave={t => { addTransaction(t); setView('list'); }}
        onCancel={() => setView('list')}
        onNeedApiKey={() => setView('settings')}
      />
    );
  }

  if (view === 'settings') {
    return (
      <SettingsView
        apiKey={settings.claudeApiKey}
        onSaveApiKey={setApiKey}
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

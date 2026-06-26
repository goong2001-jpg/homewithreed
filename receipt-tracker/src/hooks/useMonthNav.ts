import { useState, useMemo } from 'react';
import { Transaction } from '../types';

function getThisMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function useMonthNav(transactions: Transaction[]) {
  const [currentMonth, setCurrentMonth] = useState(getThisMonth);

  const filtered = useMemo(
    () => transactions.filter(t => t.date.startsWith(currentMonth)),
    [transactions, currentMonth]
  );

  function prev() {
    const [y, m] = currentMonth.split('-').map(Number);
    const d = new Date(y, m - 2);
    setCurrentMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }

  function next() {
    const [y, m] = currentMonth.split('-').map(Number);
    const d = new Date(y, m);
    setCurrentMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }

  function goToToday() {
    setCurrentMonth(getThisMonth());
  }

  return { currentMonth, filtered, prev, next, goToToday };
}

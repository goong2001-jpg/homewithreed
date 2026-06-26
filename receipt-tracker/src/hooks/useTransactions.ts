import { useState, useCallback } from 'react';
import { Transaction } from '../types';

const STORAGE_KEY = 'receipt_tracker_transactions';

function load(): Transaction[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  return [];
}

function save(transactions: Transaction[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
}

export function useTransactions() {
  const [transactions, setTransactions] = useState<Transaction[]>(load);

  const addTransaction = useCallback((t: Transaction) => {
    setTransactions(prev => {
      const next = [t, ...prev];
      save(next);
      return next;
    });
  }, []);

  const updateTransaction = useCallback((updated: Transaction) => {
    setTransactions(prev => {
      const next = prev.map(t => t.id === updated.id ? updated : t);
      save(next);
      return next;
    });
  }, []);

  const deleteTransaction = useCallback((id: string) => {
    setTransactions(prev => {
      const next = prev.filter(t => t.id !== id);
      save(next);
      return next;
    });
  }, []);

  return { transactions, addTransaction, updateTransaction, deleteTransaction };
}

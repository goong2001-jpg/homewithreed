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
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
  } catch (e) {
    // 사파리 프라이빗 모드나 저장 용량 초과로 막힐 수 있다. 앱을 죽이지는 않는다.
    console.warn('저장 실패:', e);
  }
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

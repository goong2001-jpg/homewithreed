import React from 'react';
import { Transaction } from '../types';

interface Props {
  transactions: Transaction[];
}

function fmt(n: number) {
  return n.toLocaleString('ko-KR') + '원';
}

export default function SummaryBar({ transactions }: Props) {
  const income = transactions.filter(t => t.type === '입금').reduce((s, t) => s + t.amount, 0);
  const expense = transactions.filter(t => t.type === '지출').reduce((s, t) => s + t.amount, 0);
  const balance = income - expense;

  return (
    <div style={{
      display: 'flex',
      background: '#fff',
      margin: '12px 16px',
      borderRadius: 12,
      padding: '14px 0',
      boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
    }}>
      <div style={{ flex: 1, textAlign: 'center', borderRight: '1px solid #f0f0f0' }}>
        <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>수입</div>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#27ae60' }}>{fmt(income)}</div>
      </div>
      <div style={{ flex: 1, textAlign: 'center', borderRight: '1px solid #f0f0f0' }}>
        <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>지출</div>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#e74c3c' }}>{fmt(expense)}</div>
      </div>
      <div style={{ flex: 1, textAlign: 'center' }}>
        <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>잔액</div>
        <div style={{ fontSize: 15, fontWeight: 700, color: balance >= 0 ? '#2c3e50' : '#e74c3c' }}>{fmt(balance)}</div>
      </div>
    </div>
  );
}

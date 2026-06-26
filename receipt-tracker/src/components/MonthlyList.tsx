import React from 'react';
import { Transaction } from '../types';
import SummaryBar from './SummaryBar';
import TransactionItem from './TransactionItem';
import { exportMonthToExcel } from '../utils/excelExport';

interface Props {
  transactions: Transaction[];
  currentMonth: string;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onAdd: () => void;
  onSettings: () => void;
  onDelete: (id: string) => void;
}

function groupByDate(transactions: Transaction[]): [string, Transaction[]][] {
  const map = new Map<string, Transaction[]>();
  const sorted = [...transactions].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
  for (const t of sorted) {
    if (!map.has(t.date)) map.set(t.date, []);
    map.get(t.date)!.push(t);
  }
  return Array.from(map.entries());
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00');
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${days[d.getDay()]})`;
}

export default function MonthlyList({ transactions, currentMonth, onPrev, onNext, onToday, onAdd, onSettings, onDelete }: Props) {
  const [y, m] = currentMonth.split('-');
  const monthLabel = `${y}년 ${m}월`;
  const groups = groupByDate(transactions);

  return (
    <div style={{ minHeight: '100vh', background: '#f8f9fa', paddingBottom: 80 }}>
      <div style={{
        background: '#fff',
        padding: '14px 16px',
        boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
        position: 'sticky',
        top: 0,
        zIndex: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={onPrev} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', padding: '4px 8px', color: '#555' }}>‹</button>
            <span style={{ fontSize: 18, fontWeight: 700 }}>{monthLabel}</span>
            <button onClick={onNext} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', padding: '4px 8px', color: '#555' }}>›</button>
            <button
              onClick={onToday}
              style={{ fontSize: 12, padding: '4px 10px', border: '1px solid #ddd', borderRadius: 12, background: '#f5f5f5', color: '#666', cursor: 'pointer' }}
            >
              이번달
            </button>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => exportMonthToExcel(transactions, currentMonth)}
              disabled={transactions.length === 0}
              style={{
                fontSize: 12, padding: '6px 10px', border: '1px solid #ddd',
                borderRadius: 8, background: transactions.length === 0 ? '#f5f5f5' : '#eafaf1',
                color: transactions.length === 0 ? '#aaa' : '#27ae60',
                cursor: transactions.length === 0 ? 'not-allowed' : 'pointer',
                fontWeight: 600,
              }}
            >
              Excel
            </button>
            <button
              onClick={onSettings}
              style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', padding: '4px 6px' }}
            >
              ⚙️
            </button>
          </div>
        </div>
      </div>

      <SummaryBar transactions={transactions} />

      {groups.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#bbb' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📋</div>
          <div style={{ fontSize: 15 }}>이달의 내역이 없습니다</div>
          <div style={{ fontSize: 13, marginTop: 6 }}>영수증을 찍어 추가해보세요!</div>
        </div>
      ) : (
        <div style={{ margin: '8px 0' }}>
          {groups.map(([date, items]) => (
            <div key={date} style={{ marginBottom: 2 }}>
              <div style={{ padding: '8px 16px', fontSize: 12, color: '#888', fontWeight: 600, background: '#f8f9fa' }}>
                {formatDate(date)}
              </div>
              <div style={{ background: '#fff', borderRadius: 0 }}>
                {items.map(t => (
                  <TransactionItem key={t.id} transaction={t} onDelete={onDelete} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={onAdd}
        style={{
          position: 'fixed',
          bottom: 24,
          right: 20,
          width: 56,
          height: 56,
          borderRadius: '50%',
          background: '#3498db',
          color: '#fff',
          border: 'none',
          fontSize: 28,
          cursor: 'pointer',
          boxShadow: '0 4px 16px rgba(52,152,219,0.4)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          lineHeight: 1,
        }}
      >
        +
      </button>
    </div>
  );
}

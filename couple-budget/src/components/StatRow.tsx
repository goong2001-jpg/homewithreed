import React from 'react';
import { MonthBudget } from '../types';
import { won } from '../utils/format';

interface Props {
  budget: MonthBudget;
}

/** receipt-tracker/src/components/SummaryBar.tsx 의 3열 카드 구조를 그대로 따랐다 */
export default function StatRow({ budget }: Props) {
  const future = budget.phase === 'future';

  const cells: { label: string; value: string; color: string }[] = [
    future
      ? { label: '하루 예산', value: won(Math.floor(budget.dailyBudget)), color: '#2c3e50' }
      : { label: '오늘 쓴 돈', value: won(budget.spentToday), color: budget.spentToday > 0 ? '#e74c3c' : '#95a5a6' },
    { label: '이달 누적 지출', value: won(budget.variableSpent), color: '#2c3e50' },
    {
      label: future ? '이 달 일수' : '남은 일수',
      value: `${future ? budget.daysInMonth : budget.remainingDays}일`,
      color: '#2c3e50',
    },
  ];

  return (
    <div style={{
      display: 'flex',
      background: '#fff',
      margin: '12px 16px',
      borderRadius: 12,
      padding: '14px 0',
      boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
    }}>
      {cells.map((c, i) => (
        <div
          key={c.label}
          style={{
            flex: 1,
            textAlign: 'center',
            borderRight: i < cells.length - 1 ? '1px solid #f0f0f0' : undefined,
            padding: '0 4px',
          }}
        >
          <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>{c.label}</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: c.color }}>{c.value}</div>
        </div>
      ))}
    </div>
  );
}

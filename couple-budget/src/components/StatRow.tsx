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
      ? { label: '하루 예산', value: won(Math.floor(budget.dailyBudget)), color: '#191F28' }
      : { label: '오늘 쓴 돈', value: won(budget.spentToday), color: budget.spentToday > 0 ? '#191F28' : '#B0B8C1' },
    { label: '이달 누적 지출', value: won(budget.variableSpent), color: '#191F28' },
    {
      label: future ? '이 달 일수' : '남은 일수',
      value: `${future ? budget.daysInMonth : budget.remainingDays}일`,
      color: '#191F28',
    },
  ];

  return (
    <div style={{
      display: 'flex', background: '#fff', margin: '0 12px 10px', borderRadius: 20,
      padding: '18px 20px',
    }}>
      {cells.map(c => {
        // '12,000원' → 숫자는 크게, 단위는 작게
        const m = c.value.match(/^(.*?)(원|일)$/);
        return (
          <div key={c.label} style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12.5, color: '#8B95A1', fontWeight: 500 }}>{c.label}</div>
            <div style={{
              fontSize: 17, fontWeight: 700, color: c.color, marginTop: 4,
              letterSpacing: -0.4, whiteSpace: 'nowrap',
            }}>
              {m ? m[1] : c.value}
              {m && <span style={{ fontSize: 12.5, fontWeight: 600, color: '#4E5968' }}>{m[2]}</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

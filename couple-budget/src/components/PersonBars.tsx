import React from 'react';
import { MonthBudget } from '../types';
import { won } from '../utils/format';

interface Props {
  budget: MonthBudget;
}

export default function PersonBars({ budget }: Props) {
  const { perPerson, variableSpent } = budget;
  if (!perPerson.length) return null;

  return (
    <div style={{
      background: '#fff',
      margin: '0 16px 12px',
      borderRadius: 12,
      padding: 16,
      boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
        <h3 style={{ margin: 0, fontSize: 14, color: '#333' }}>누가 얼마 썼나</h3>
        <span style={{ fontSize: 11, color: '#aaa' }}>이달 합계 {won(variableSpent)}</span>
      </div>

      {perPerson.map(p => (
        <div key={p.personId} style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 5 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#333' }}>
              {p.name}
              {p.income > 0 && (
                <span style={{ fontSize: 11, color: '#aaa', fontWeight: 400, marginLeft: 6 }}>
                  수입 {won(p.income)}
                </span>
              )}
            </span>
            <span style={{ fontSize: 13, fontWeight: 700, color: p.expense > 0 ? '#e74c3c' : '#bbb' }}>
              {won(p.expense)}
            </span>
          </div>
          <div style={{ background: '#f1f3f5', borderRadius: 99, height: 8, overflow: 'hidden' }}>
            <div style={{
              width: `${Math.round(p.ratio * 100)}%`,
              height: '100%',
              background: p.color,
              borderRadius: 99,
              transition: 'width 500ms ease',
            }} />
          </div>
        </div>
      ))}

      {variableSpent === 0 && (
        <div style={{ fontSize: 12, color: '#bbb', textAlign: 'center', paddingTop: 2 }}>
          아직 이달 지출이 없어요
        </div>
      )}
    </div>
  );
}

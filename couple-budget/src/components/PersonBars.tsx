import React from 'react';
import { MonthBudget } from '../types';
import { won } from '../utils/format';

interface Props {
  budget: MonthBudget;
  /** 사람을 누르면 그 사람 내역으로 보낸다 */
  onSelectPerson: (personId: string) => void;
}

export default function PersonBars({ budget, onSelectPerson }: Props) {
  const { perPerson, variableSpent } = budget;
  if (!perPerson.length) return null;

  return (
    <div style={{ background: '#fff', margin: '0 12px 10px', borderRadius: 20, padding: '18px 20px 14px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#191F28' }}>누가 얼마 썼나</h3>
        <span style={{ fontSize: 13, color: '#8B95A1' }}>이달 합계 {won(variableSpent)}</span>
      </div>

      {perPerson.map(p => (
        <button
          key={p.personId}
          onClick={() => onSelectPerson(p.personId)}
          style={{
            display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left',
            cursor: 'pointer', background: 'none', border: 'none', padding: '10px 0',
          }}
        >
          {/* 사람 색은 사용자가 고른 색 그대로 — 옅은 바탕에 진한 글자로 */}
          <span style={{
            width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: `${p.color}1f`, color: p.color, fontSize: 14, fontWeight: 700,
          }}>
            {p.name.slice(0, 1)}
          </span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{
              display: 'block', fontSize: 15, fontWeight: 600, color: '#191F28',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {p.name}
            </span>
            <span style={{ display: 'block', fontSize: 12.5, color: '#8B95A1', marginTop: 1 }}>
              {Math.round(p.ratio * 100)}%
              {p.income > 0 && <> · 수입 {won(p.income)}</>}
            </span>
          </span>
          <span style={{ fontSize: 15, fontWeight: 700, color: p.expense > 0 ? '#191F28' : '#B0B8C1', flexShrink: 0 }}>
            {won(p.expense)}
          </span>
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" style={{ flexShrink: 0 }}>
            <path d="m9 6 6 6-6 6" fill="none" stroke="#B0B8C1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      ))}

      {variableSpent === 0 && (
        <div style={{ fontSize: 12.5, color: '#B0B8C1', paddingTop: 2 }}>아직 이달 지출이 없어요</div>
      )}
    </div>
  );
}

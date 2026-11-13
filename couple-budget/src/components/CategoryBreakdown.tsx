import React from 'react';
import { CATEGORY_COLOR, CATEGORY_EMOJI, CategorySpend, ExpenseCategory } from '../types';
import { won } from '../utils/format';

interface Props {
  rows: CategorySpend[];
  /** 지금 걸려 있는 카테고리 필터 (없으면 null) */
  selected: ExpenseCategory | null;
  onSelect: (c: ExpenseCategory | null) => void;
  /** 누구 것을 보고 있는지 (제목에 표시) */
  scopeLabel?: string;
}

export default function CategoryBreakdown({ rows, selected, onSelect, scopeLabel }: Props) {
  const total = rows.reduce((s, r) => s + r.amount, 0);

  return (
    <div style={{
      background: '#fff', margin: '12px 16px', borderRadius: 20, padding: 16,
      boxShadow: 'none',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
        <h3 style={{ margin: 0, fontSize: 14, color: '#191F28' }}>
          어디에 썼나{scopeLabel ? ` · ${scopeLabel}` : ''}
        </h3>
        <span style={{ fontSize: 11, color: '#B0B8C1' }}>합계 {won(total)}</span>
      </div>

      {rows.length === 0 ? (
        <div style={{ fontSize: 12.5, color: '#B0B8C1', textAlign: 'center', padding: '14px 0' }}>
          아직 지출이 없어요
        </div>
      ) : (
        rows.map(r => {
          const on = selected === r.category;
          const color = CATEGORY_COLOR[r.category];
          return (
            <button
              key={r.category}
              // 다시 누르면 필터가 풀린다
              onClick={() => onSelect(on ? null : r.category)}
              style={{
                display: 'block', width: '100%', textAlign: 'left', cursor: 'pointer',
                background: on ? `${color}12` : 'none',
                border: 'none', borderRadius: 12,
                padding: on ? '8px 8px 6px' : '8px 0 6px',
                marginBottom: 6,
              }}
            >
              <div style={{
                display: 'flex', justifyContent: 'space-between',
                alignItems: 'baseline', marginBottom: 5,
              }}>
                <span style={{ fontSize: 13, color: '#191F28', fontWeight: on ? 700 : 500 }}>
                  {CATEGORY_EMOJI[r.category]} {r.category}
                  <span style={{ fontSize: 11, color: '#B0B8C1', fontWeight: 400, marginLeft: 6 }}>
                    {r.count}건 · {Math.round(r.ratio * 100)}%
                  </span>
                </span>
                <span style={{ fontSize: 13.5, fontWeight: 700, color: '#191F28' }}>
                  {won(r.amount)}
                </span>
              </div>
              <div style={{ background: '#F2F4F6', borderRadius: 99, height: 7, overflow: 'hidden' }}>
                <div style={{
                  width: `${Math.max(2, Math.round(r.ratio * 100))}%`,
                  height: '100%', background: color, borderRadius: 99,
                  transition: 'width 400ms ease',
                }} />
              </div>
            </button>
          );
        })
      )}

      {rows.length > 0 && (
        <div style={{ fontSize: 11, color: '#B0B8C1', marginTop: 4, lineHeight: 1.6 }}>
          {selected
            ? '다시 누르면 전체로 돌아갑니다.'
            : '눌러서 그 카테고리 내역만 볼 수 있어요.'}
        </div>
      )}
    </div>
  );
}

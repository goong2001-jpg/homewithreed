import React from 'react';
import { BUDGET_WARN_RATIO, BudgetStatusRow, CATEGORY_COLOR, CATEGORY_EMOJI } from '../types';
import { shortWon } from '../utils/format';

interface Props {
  rows: BudgetStatusRow[];
  /** 설정의 '카테고리 예산' 카드로 보낸다 */
  onGoSettings: () => void;
}

/** 상한 대비 색 — 80% 부터 주황, 100% 부터 빨강, 그 전엔 카테고리 색 */
export function limitColor(row: BudgetStatusRow): string {
  if (row.ratio >= 1) return '#e74c3c';
  if (row.ratio >= BUDGET_WARN_RATIO) return '#f39c12';
  return CATEGORY_COLOR[row.category];
}

/** '식비 20만원 중 16만원 (80%)' / 넘으면 '식비 20만원 중 25만원 · 초과' */
export function limitLabel(row: BudgetStatusRow): string {
  const base = `${row.category} ${shortWon(row.limit)} 중 ${shortWon(row.spent)}`;
  if (row.ratio >= 1) return `${base} · 초과`;
  return `${base} (${Math.round(row.ratio * 100)}%)`;
}

/**
 * 홈 — 상한을 정해 둔 카테고리만 얇은 막대로. 하나도 없으면 아예 그리지 않는다.
 */
export default function BudgetLimits({ rows, onGoSettings }: Props) {
  if (!rows.length) return null;

  return (
    <div style={{
      background: '#fff', margin: '0 16px 12px', borderRadius: 12, padding: '14px 16px 12px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
        <h3 style={{ margin: 0, fontSize: 14, color: '#333' }}>카테고리 예산</h3>
        <button
          onClick={onGoSettings}
          style={{ background: 'none', border: 'none', fontSize: 11, color: '#90a4ae', cursor: 'pointer', padding: 0 }}
        >
          고치기 ›
        </button>
      </div>

      {rows.map(r => {
        const color = limitColor(r);
        const warn = r.ratio >= BUDGET_WARN_RATIO;
        return (
          <div key={r.category} style={{ marginBottom: 9 }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
              marginBottom: 4, fontSize: 12.5,
            }}>
              <span style={{ color: warn ? color : '#2c3e50', fontWeight: warn ? 700 : 500 }}>
                {CATEGORY_EMOJI[r.category]} {limitLabel(r)}
              </span>
              {!warn && (
                <span style={{ fontSize: 11, color: '#b0bec5' }}>{Math.round(r.ratio * 100)}%</span>
              )}
            </div>
            <div style={{ background: '#f1f3f5', borderRadius: 99, height: 5, overflow: 'hidden' }}>
              <div style={{
                width: `${Math.min(100, Math.max(1, Math.round(r.ratio * 100)))}%`,
                height: '100%', background: color, borderRadius: 99,
                transition: 'width 400ms ease',
              }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

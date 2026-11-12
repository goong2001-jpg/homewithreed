import React from 'react';
import { CATEGORY_EMOJI, RecurringCandidate } from '../types';
import { shortMonthLabel, won } from '../utils/format';

interface Props {
  /** budget.ts recurringCandidates — '아니에요'라고 한 것은 이미 빠져서 들어온다 */
  items: RecurringCandidate[];
  onMove: (item: RecurringCandidate) => void;
  onDismiss: (key: string) => void;
}

/**
 * 홈 — 석 달 연속 같은 내용·금액으로 적은 지출을 고정지출로 옮기자고 권한다.
 * 옮기면 다음 달부터는 적지 않아도 하루 쓸 돈에서 미리 빠진다.
 */
export default function RecurringCard({ items, onMove, onDismiss }: Props) {
  if (items.length === 0) return null;

  return (
    <div style={{
      background: '#fff', margin: '0 16px 12px', borderRadius: 12, padding: '14px 14px 6px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
    }}>
      <div style={{ fontSize: 13.5, fontWeight: 700, color: '#2c3e50' }}>매달 나가는 돈 같아요</div>
      <div style={{ fontSize: 12, color: '#95a5a6', margin: '3px 0 10px', lineHeight: 1.6 }}>
        고정지출로 옮기면 매달 적지 않아도 하루 쓸 돈에서 미리 빠져요.
      </div>
      {items.map(it => (
        <div key={it.key} style={{ borderTop: '1px solid #f3f5f6', padding: '10px 0' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span>{CATEGORY_EMOJI[it.category]}</span>
            <span style={{
              flex: 1, minWidth: 0, fontSize: 14, fontWeight: 600, color: '#2c3e50',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {it.content}
            </span>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#607d8b', flexShrink: 0 }}>
              {won(it.amount)}
            </span>
          </div>
          <div style={{ fontSize: 11.5, color: '#b0bec5', margin: '3px 0 8px' }}>
            {it.months.map(shortMonthLabel).join(' · ')}에 한 번씩 · 옮기면 {shortMonthLabel(it.startMonth)}부터 적용
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => onMove(it)}
              style={{
                flex: 2, padding: '9px 6px', borderRadius: 8, border: 'none', cursor: 'pointer',
                background: '#eafaf1', color: '#1e8449', fontSize: 12.5, fontWeight: 700,
              }}
            >
              고정지출로 옮기기
            </button>
            <button
              onClick={() => onDismiss(it.key)}
              style={{
                flex: 1, padding: '9px 6px', borderRadius: 8, cursor: 'pointer',
                border: '1px solid #eceff1', background: '#fff', color: '#90a4ae', fontSize: 12.5,
              }}
            >
              아니에요
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

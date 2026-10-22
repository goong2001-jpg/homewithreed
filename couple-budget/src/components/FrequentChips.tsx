import React from 'react';
import { CATEGORY_EMOJI, FrequentExpense } from '../types';
import { shortWon } from '../utils/format';

interface Props {
  items: FrequentExpense[];
  onPick: (item: FrequentExpense) => void;
}

/**
 * 입력 탭 맨 위 — 최근 90일에 반복된 지출을 칩으로. 누르면 칸이 채워질 뿐, 저장은 아니다.
 * 후보가 2개 미만이면 '자주'라고 부르기 민망하니 줄 자체를 숨긴다.
 */
export default function FrequentChips({ items, onPick }: Props) {
  if (items.length < 2) return null;

  return (
    <div style={{ padding: '14px 0 0' }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: '#78909c', padding: '0 16px', marginBottom: 8 }}>
        자주 쓰는 지출
        <span style={{ fontWeight: 400, color: '#b0bec5', marginLeft: 6 }}>누르면 채워져요 · 저장은 한 번 더</span>
      </div>
      <div style={{
        display: 'flex', gap: 8, overflowX: 'auto', padding: '0 16px 4px',
        WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none',
      }}>
        {items.map(it => (
          <button
            key={`${it.category}|${it.content}|${it.amount}`}
            onClick={() => onPick(it)}
            style={{
              flexShrink: 0, padding: '8px 12px', borderRadius: 18, cursor: 'pointer',
              border: '1.5px solid #d5f0e0', background: '#fff', color: '#2c3e50',
              fontSize: 12.5, display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap',
            }}
          >
            <span>{CATEGORY_EMOJI[it.category]}</span>
            <span style={{ fontWeight: 600, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {it.content || it.category}
            </span>
            <span style={{ color: '#e74c3c', fontWeight: 700 }}>{shortWon(it.amount)}</span>
            <span style={{ fontSize: 10.5, color: '#b0bec5' }}>{it.count}회</span>
          </button>
        ))}
      </div>
    </div>
  );
}

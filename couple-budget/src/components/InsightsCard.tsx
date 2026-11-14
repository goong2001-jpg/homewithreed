import React from 'react';
import { Insight } from '../utils/insights';

interface Props {
  items: Insight[];
}

const DOT: Record<Insight['tone'], string> = {
  warn: '#F59F00',
  good: '#12B76A',
  info: '#B0B8C1',
};

/**
 * 저금통 화면 — 기록을 보고 짚어주는 '살펴볼 점'. 없으면 아예 그리지 않는다.
 * 계산은 utils/insights.ts 가 한다 (여기는 그리기만).
 */
export default function InsightsCard({ items }: Props) {
  if (!items.length) return null;

  return (
    <div style={{ background: '#fff', margin: '0 12px 10px', borderRadius: 20, padding: '18px 20px 8px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#191F28' }}>살펴볼 점</h3>
        <span style={{ fontSize: 12, color: '#B0B8C1' }}>적은 기록으로 계산했어요</span>
      </div>

      {items.map((it, i) => (
        <div
          key={it.key}
          style={{
            display: 'flex', gap: 10, padding: '12px 0',
            borderTop: i === 0 ? 'none' : '1px solid #F2F4F6',
          }}
        >
          <span style={{
            width: 7, height: 7, borderRadius: '50%', background: DOT[it.tone],
            flexShrink: 0, marginTop: 7,
          }} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 14.5, fontWeight: 600, color: '#191F28', lineHeight: 1.45 }}>
              {it.title}
            </div>
            <div style={{ fontSize: 12.5, color: '#8B95A1', marginTop: 3, lineHeight: 1.6 }}>
              {it.detail}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

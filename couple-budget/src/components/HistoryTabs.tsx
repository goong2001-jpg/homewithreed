import React from 'react';

interface Props {
  active: 'history' | 'top';
  onChange: (v: 'history' | 'top') => void;
}

/**
 * 내역 탭 안에서 '전체 내역'과 '큰 지출 TOP5'를 오간다.
 * TOP5 는 예전엔 아래 탭이었다 — 탭이 여섯 개라 글자가 작고 빽빽해서 여기로 옮겼다 (v17).
 */
export default function HistoryTabs({ active, onChange }: Props) {
  const tab = (on: boolean): React.CSSProperties => ({
    flex: 1, padding: '9px 0', borderRadius: 9, cursor: 'pointer', fontSize: 13.5,
    border: 'none',
    background: on ? '#fff' : 'transparent',
    color: on ? '#2c3e50' : '#90a4ae',
    fontWeight: on ? 700 : 500,
    boxShadow: on ? '0 1px 3px rgba(0,0,0,0.12)' : 'none',
  });

  return (
    <div style={{
      display: 'flex', gap: 4, margin: '12px 16px 0', padding: 4,
      background: '#eceff1', borderRadius: 11,
    }}>
      <button onClick={() => onChange('history')} style={tab(active === 'history')} aria-pressed={active === 'history'}>
        전체 내역
      </button>
      <button onClick={() => onChange('top')} style={tab(active === 'top')} aria-pressed={active === 'top'}>
        큰 지출 TOP5
      </button>
    </div>
  );
}

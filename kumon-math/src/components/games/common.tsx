import React from 'react';

export const card: React.CSSProperties = {
  background: 'white', borderRadius: 24, padding: '18px 16px',
  width: '100%', maxWidth: 380, textAlign: 'center',
  boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
};

export const bigBtn = (on = true): React.CSSProperties => ({
  width: '100%', padding: '14px 0', borderRadius: 16, border: 'none',
  background: on ? 'linear-gradient(135deg,#667eea,#764ba2)' : '#ddd',
  color: 'white', fontSize: 16, fontWeight: 900,
  cursor: on ? 'pointer' : 'not-allowed', fontFamily: 'inherit',
});

export const lineBtn = (color = '#7c4dff'): React.CSSProperties => ({
  flex: 1, padding: '12px 0', borderRadius: 14, border: `2px solid ${color}`,
  background: 'white', color, fontSize: 15, fontWeight: 800,
  cursor: 'pointer', fontFamily: 'inherit',
});

/** 놀이를 다 했을 때 보여주는 화면 */
export function Finish({ emoji, title, sub, stars, onAgain, onBack }: {
  emoji: string; title: string; sub?: string; stars: number;
  onAgain: () => void; onBack: () => void;
}) {
  return (
    <div style={card}>
      <div style={{ fontSize: 60 }}>{emoji}</div>
      <div style={{ fontSize: 22, fontWeight: 900, color: '#27ae60', margin: '6px 0' }}>{title}</div>
      {sub && <div style={{ fontSize: 14, color: '#888', marginBottom: 6 }}>{sub}</div>}
      {stars > 0 && <div style={{ fontSize: 16, fontWeight: 800, color: '#f39c12', marginBottom: 14 }}>+{stars} ⭐</div>}
      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={onBack} style={lineBtn()}>놀이 고르기</button>
        <button onClick={onAgain} style={{ ...bigBtn(), flex: 1 }}>한 번 더! 🔁</button>
      </div>
    </div>
  );
}

export interface GameProps {
  /** 놀이에 쓸 단어 (아이가 배운 단어) */
  pool: import('../../words/wordBank').Word[];
  /** 별 주기 */
  onStars: (n: number) => void;
  onBack: () => void;
}

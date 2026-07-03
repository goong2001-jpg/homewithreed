import React from 'react';

interface Props {
  level: number;
  streak: number;
  points: number;
  courseName?: string;
  courseEmoji?: string;
  onCourseClick?: () => void;
}

export default function ProgressBar({ level, streak, points, courseName, courseEmoji, onCourseClick }: Props) {
  const maxLevel = 20;
  const pct = (level / maxLevel) * 100;

  return (
    <div style={{
      background: 'white',
      borderRadius: 20,
      padding: '12px 20px',
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
      width: '100%',
      maxWidth: 380,
      boxSizing: 'border-box',
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <span
            onClick={onCourseClick}
            style={{
              fontSize: 13, fontWeight: 700, color: '#9b59b6',
              cursor: onCourseClick ? 'pointer' : 'default',
              textDecoration: onCourseClick ? 'underline dotted' : 'none',
              textUnderlineOffset: 3,
            }}
          >
            {courseName ? `📚 ${courseEmoji ?? ''} ${courseName} · ` : ''}레벨 {level}
          </span>
          <span style={{ fontSize: 13, color: '#bbb' }}>최대 {maxLevel}</span>
        </div>
        <div style={{ background: '#eee', borderRadius: 99, height: 10, overflow: 'hidden' }}>
          <div style={{
            width: `${pct}%`,
            height: '100%',
            background: 'linear-gradient(90deg, #a18cd1, #fbc2eb)',
            borderRadius: 99,
            transition: 'width 0.5s ease',
          }} />
        </div>
      </div>
      <div style={{ textAlign: 'center', minWidth: 52 }}>
        <div style={{ fontSize: 11, color: '#888' }}>연속</div>
        <div style={{ fontSize: 20, fontWeight: 800, color: '#f39c12' }}>
          {streak > 0 ? `🔥${streak}` : '—'}
        </div>
      </div>
      <div style={{ textAlign: 'center', minWidth: 52 }}>
        <div style={{ fontSize: 11, color: '#888' }}>포인트</div>
        <div style={{ fontSize: 18, fontWeight: 800, color: '#9b59b6' }}>⭐{points}</div>
      </div>
    </div>
  );
}

import React from 'react';

interface Props {
  todaySolved: number;
  dailyGoal: number;
  attendanceStreak: number;
}

export default function DailyMission({ todaySolved, dailyGoal, attendanceStreak }: Props) {
  const done = todaySolved >= dailyGoal;
  const pct = Math.min(100, (todaySolved / dailyGoal) * 100);

  return (
    <div style={{
      background: done ? 'linear-gradient(135deg, #84fab0, #8fd3f4)' : 'white',
      borderRadius: 20,
      padding: '12px 20px',
      display: 'flex',
      alignItems: 'center',
      gap: 14,
      boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
      width: '100%',
      maxWidth: 380,
      boxSizing: 'border-box',
      marginTop: 10,
      transition: 'background 0.5s',
    }}>
      <div style={{ fontSize: 26 }}>{done ? '🏆' : '📌'}</div>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: done ? '#1e7d4f' : '#e67e22' }}>
            {done ? '오늘의 미션 완료! 🎉' : '오늘의 미션'}
          </span>
          <span style={{ fontSize: 13, fontWeight: 800, color: done ? '#1e7d4f' : '#888' }}>
            {Math.min(todaySolved, dailyGoal)} / {dailyGoal}
          </span>
        </div>
        <div style={{ background: done ? 'rgba(255,255,255,0.6)' : '#eee', borderRadius: 99, height: 10, overflow: 'hidden' }}>
          <div style={{
            width: `${pct}%`,
            height: '100%',
            background: done
              ? 'linear-gradient(90deg, #27ae60, #2ecc71)'
              : 'linear-gradient(90deg, #f6d365, #fda085)',
            borderRadius: 99,
            transition: 'width 0.5s ease',
          }} />
        </div>
      </div>
      {attendanceStreak > 1 && (
        <div style={{ textAlign: 'center', minWidth: 48 }}>
          <div style={{ fontSize: 11, color: done ? '#1e7d4f' : '#888' }}>연속 출석</div>
          <div style={{ fontSize: 17, fontWeight: 800, color: '#e74c3c' }}>🔥{attendanceStreak}일</div>
        </div>
      )}
    </div>
  );
}

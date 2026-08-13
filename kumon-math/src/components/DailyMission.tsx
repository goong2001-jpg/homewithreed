import React from 'react';

interface Props {
  todaySolved: number;
  dailyGoal: number;
  attendanceStreak: number;
  bankedProblems: number;
  bankedAppliedToday: number;
}

export default function DailyMission({
  todaySolved, dailyGoal, attendanceStreak, bankedProblems, bankedAppliedToday,
}: Props) {
  const done = todaySolved >= dailyGoal;
  const extra = Math.max(0, todaySolved - dailyGoal);
  const pct = Math.min(100, (todaySolved / dailyGoal) * 100);
  const bankedDays = Math.floor(bankedProblems / dailyGoal);

  return (
    <div style={{
      background: done ? 'linear-gradient(135deg, #84fab0, #8fd3f4)' : 'white',
      borderRadius: 20,
      padding: '12px 20px',
      boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
      width: '100%',
      maxWidth: 380,
      boxSizing: 'border-box',
      marginTop: 10,
      transition: 'background 0.5s',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ fontSize: 26 }}>{done ? '🏆' : '📌'}</div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: done ? '#1e7d4f' : '#e67e22' }}>
              {done ? '오늘의 미션 완료! 🎉' : '오늘의 미션'}
            </span>
            <span style={{ fontSize: 13, fontWeight: 800, color: done ? '#1e7d4f' : '#888' }}>
              {todaySolved} / {dailyGoal}
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

      {/* 🍯 미리하기 저금통 — 미션을 끝내도 계속 풀 수 있어요 */}
      {done && (
        <div style={{
          marginTop: 10, paddingTop: 10,
          borderTop: '2px dashed rgba(255,255,255,0.7)',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span style={{ fontSize: 22 }}>🍯</span>
          <div style={{ flex: 1, fontSize: 12, fontWeight: 700, color: '#1e6b4a', lineHeight: 1.45 }}>
            {extra > 0
              ? <>내일 걸 <b style={{ fontSize: 14 }}>{extra}개</b> 미리 해뒀어!</>
              : <>더 풀면 내일 걸 미리 해둘 수 있어! 💪</>}
            {bankedProblems > 0 && (
              <div style={{ color: '#2c7a5a', fontWeight: 800 }}>
                🎁 저금통에 {bankedProblems}개
                {bankedDays > 0 && ` — ${bankedDays}일치 채웠어요!`}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 미리 해둔 걸로 오늘 미션이 채워진 경우 */}
      {bankedAppliedToday > 0 && (
        <div style={{
          marginTop: 8, fontSize: 12, fontWeight: 700,
          color: done ? '#1e6b4a' : '#e67e22', textAlign: 'center',
        }}>
          ✨ 어제 미리 해둔 {bankedAppliedToday}개를 오늘 미션에 넣었어요!
        </div>
      )}
    </div>
  );
}

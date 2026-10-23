import React from 'react';
import { MISSIONS, MissionState, isMissionDone, missionGoal, missionsDoneCount, MISSION_BONUS } from '../words/missions';
import { playClick } from '../utils/sounds';

/**
 * 영어 단어 화면의 "오늘 미션 3개" 카드.
 * 세 줄에 체크 표시가 붙고, 다 하면 "오늘 미션 완료 ✅" 로 바뀐다.
 */
export function MissionCard({ missions }: { missions: MissionState }) {
  const done = missionsDoneCount(missions);
  const all = done >= MISSIONS.length;
  return (
    <div style={{
      width: '100%', maxWidth: 380, boxSizing: 'border-box',
      background: all ? 'linear-gradient(135deg,#84fab0,#8fd3f4)' : 'white',
      borderRadius: 18, padding: '12px 16px', marginBottom: 12,
      boxShadow: '0 4px 14px rgba(0,0,0,0.08)', transition: 'background 0.5s',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 14, fontWeight: 900, color: all ? '#1e7d4f' : '#44405e' }}>
          {all ? '오늘 미션 완료 ✅' : '📌 오늘 미션 3개'}
        </span>
        <span style={{ fontSize: 12, fontWeight: 800, color: all ? '#1e7d4f' : '#999' }}>
          {all ? `⭐ +${MISSION_BONUS} 받았어요` : `${done} / ${MISSIONS.length}`}
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {MISSIONS.map(m => {
          const ok = isMissionDone(missions, m.id);
          const n = Math.min(missions.progress[m.id] ?? 0, missionGoal(m.id));
          return (
            <div key={m.id} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              background: ok ? 'rgba(255,255,255,0.55)' : '#f6f4fb', borderRadius: 12, padding: '7px 10px',
            }}>
              <span style={{ fontSize: 18, width: 24, textAlign: 'center' }}>{ok ? '✅' : '⬜'}</span>
              <span style={{ fontSize: 18 }}>{m.emoji}</span>
              <span style={{
                flex: 1, fontSize: 14, fontWeight: 800,
                color: ok ? '#1e7d4f' : '#4a4463',
                textDecoration: ok ? 'line-through' : 'none',
              }}>{m.label}</span>
              <span style={{ fontSize: 12, fontWeight: 800, color: ok ? '#1e7d4f' : '#9b59b6' }}>
                {n} / {m.goal}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const CONFETTI = ['🎉', '⭐', '🎊', '✨', '💖', '🌟', '🎈', '🍀'];

/** 세 미션을 다 했을 때 하루 한 번 뜨는 축하 화면 */
export function MissionCelebration({ onClose }: { onClose: () => void }) {
  return (
    <div
      role="dialog"
      aria-label="오늘 미션 완료"
      style={{
        position: 'fixed', inset: 0, zIndex: 120,
        background: 'rgba(60,40,90,0.72)', backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, overflow: 'hidden',
      }}
    >
      {/* 색종이 — CSS 애니메이션 이모지 */}
      {Array.from({ length: 18 }, (_, i) => (
        <span key={i} aria-hidden style={{
          position: 'absolute', top: -40, left: `${(i * 37) % 100}%`,
          fontSize: 22 + (i % 3) * 8, pointerEvents: 'none',
          animation: `confettiFall ${2.4 + (i % 5) * 0.4}s linear ${(i % 6) * 0.25}s infinite`,
        }}>{CONFETTI[i % CONFETTI.length]}</span>
      ))}
      <div style={{
        background: 'white', borderRadius: 28, padding: '30px 24px', width: '100%', maxWidth: 340,
        textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.35)', animation: 'fadeIn 0.4s ease',
        position: 'relative',
      }}>
        <div style={{ fontSize: 72, lineHeight: 1.1 }}>🏆</div>
        <div style={{ fontSize: 24, fontWeight: 900, color: '#27ae60', margin: '10px 0 6px' }}>
          오늘 끝! 내일 또 만나 👋
        </div>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#888', lineHeight: 1.6, marginBottom: 18 }}>
          미션 3개를 다 했어요!<br />
          <span style={{ color: '#f39c12', fontWeight: 900 }}>⭐ {MISSION_BONUS}개</span> 보너스를 받았어요
        </div>
        <button
          onClick={() => { onClose(); playClick(); }}
          style={{
            width: '100%', padding: '18px 0', borderRadius: 18, border: 'none',
            background: 'linear-gradient(135deg,#667eea,#764ba2)', color: 'white',
            fontSize: 22, fontWeight: 900, cursor: 'pointer', fontFamily: 'inherit',
            boxShadow: '0 6px 20px rgba(102,126,234,0.5)',
          }}
        >닫기</button>
      </div>
    </div>
  );
}

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

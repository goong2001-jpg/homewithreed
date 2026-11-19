import React from 'react';
import { MISSIONS, MissionState, isMissionDone, missionGoal, MISSION_BONUS } from '../words/missions';
import { playClick } from '../utils/sounds';

/** 앱 밖 영어 시간 — 엄마·아빠가 확인을 거쳐 더한다 */
export const OFF_APP_ACTIVITIES = [
  { emoji: '📚', label: '그림책 읽어줬어요', minutes: 10 },
  { emoji: '📺', label: '영어 영상 봤어요', minutes: 15 },
  { emoji: '🎵', label: '영어 노래·오디오 들었어요', minutes: 10 },
  { emoji: '✨', label: '그 밖에 영어로 놀았어요', minutes: 5 },
];

/** 동그라미 진행 표시 */
function Ring({ value, goal, size = 92 }: { value: number; goal: number; size?: number }) {
  const r = (size - 12) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.min(1, value / goal);
  const full = value >= goal;
  return (
    <svg width={size} height={size} role="img" aria-label={`오늘 영어 ${value}분 / ${goal}분`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={full ? 'rgba(255,255,255,0.7)' : '#efeaf9'} strokeWidth={10} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={full ? '#27ae60' : 'url(#ringGrad)'} strokeWidth={10}
        strokeLinecap="round" strokeDasharray={`${c * pct} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dasharray 0.6s ease' }} />
      <defs>
        <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f6d365" /><stop offset="100%" stopColor="#f5576c" />
        </linearGradient>
      </defs>
      <text x="50%" y="47%" textAnchor="middle" fontSize="24" fontWeight="900" fill={full ? '#1e7d4f' : '#44405e'}>{value}</text>
      <text x="50%" y="68%" textAnchor="middle" fontSize="11" fontWeight="800" fill="#8a7a9a">/ {goal}분</text>
    </svg>
  );
}

/**
 * 영어 단어 화면 맨 위 "오늘의 영어 30분" 카드.
 * 동그라미가 오늘 영어 시간(앱 + 앱 밖)이고, 아래 네 줄은 30분을 쓰는 추천 순서다.
 * 30분을 채우면 "오늘 끝 ✅" 으로 바뀐다.
 */
export function MissionCard({ missions, minutes, goal, offMin, onAddOffline }: {
  missions: MissionState;
  minutes: number;
  goal: number;
  /** 오늘 적은 앱 밖 시간 */
  offMin: number;
  /** 엄마·아빠 기록 버튼 */
  onAddOffline: () => void;
}) {
  const all = minutes >= goal;
  return (
    <div style={{
      width: '100%', maxWidth: 380, boxSizing: 'border-box',
      background: all ? 'linear-gradient(135deg,#84fab0,#8fd3f4)' : 'white',
      borderRadius: 18, padding: '12px 14px', marginBottom: 12,
      boxShadow: '0 4px 14px rgba(0,0,0,0.08)', transition: 'background 0.5s',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Ring value={minutes} goal={goal} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 900, color: all ? '#1e7d4f' : '#44405e' }}>
            {all ? '오늘 영어 30분 끝 ✅' : '⏱️ 오늘의 영어 30분'}
          </div>
          <div style={{ fontSize: 12, fontWeight: 800, color: all ? '#1e7d4f' : '#8a7a9a', margin: '2px 0 6px', lineHeight: 1.4 }}>
            {all ? `⭐ +${MISSION_BONUS} 받았어요! 더 하면 더 좋아요` : `${goal - minutes}분 남았어요`}
            {offMin > 0 && <><br />(그림책·영상 {offMin}분 포함)</>}
          </div>
          <button onClick={() => { playClick(); onAddOffline(); }} style={{
            border: 'none', borderRadius: 10, padding: '6px 10px', fontSize: 12, fontWeight: 800,
            background: all ? 'rgba(255,255,255,0.7)' : '#f2f0fa', color: '#6b5b8a', cursor: 'pointer', fontFamily: 'inherit',
          }}>👪 앱 밖 영어 시간 더하기 🔒</button>
        </div>
      </div>
      <div style={{ fontSize: 11, fontWeight: 800, color: all ? '#1e7d4f' : '#999', margin: '10px 0 6px' }}>
        추천 순서
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {MISSIONS.map((m, i) => {
          const ok = isMissionDone(missions, m.id);
          const n = Math.min(missions.progress[m.id] ?? 0, missionGoal(m.id));
          return (
            <div key={m.id} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: ok ? 'rgba(255,255,255,0.55)' : '#f6f4fb', borderRadius: 12, padding: '6px 10px',
            }}>
              <span style={{ fontSize: 16, width: 22, textAlign: 'center' }}>{ok ? '✅' : `${i + 1}`}</span>
              <span style={{ fontSize: 17 }}>{m.emoji}</span>
              <span style={{
                flex: 1, fontSize: 13, fontWeight: 800,
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

/** 엄마·아빠가 앱 밖 영어 시간을 더하는 창 (확인을 거친 뒤에 연다) */
export function OffAppSheet({ offMin, onAdd, onClose }: {
  offMin: number; onAdd: (minutes: number) => void; onClose: () => void;
}) {
  const [msg, setMsg] = React.useState<string | null>(null);
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 260, padding: 20,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: 'white', borderRadius: 22, padding: '20px 18px', maxWidth: 340, width: '100%',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
      }}>
        <div style={{ fontSize: 17, fontWeight: 900, color: '#44405e' }}>👪 앱 밖 영어 시간</div>
        <div style={{ fontSize: 12, color: '#888', fontWeight: 700, margin: '2px 0 12px', lineHeight: 1.5 }}>
          그림책 읽어주기, 영어 영상·노래도 영어 30분에 들어가요. 오늘 더한 시간: <b>{offMin}분</b>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {OFF_APP_ACTIVITIES.map(a => (
            <button key={a.label} onClick={() => { playClick(); onAdd(a.minutes); setMsg(`${a.emoji} +${a.minutes}분 더했어요!`); }} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '11px 12px', borderRadius: 14,
              border: '2px solid #e6e1f5', background: '#faf8ff', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
            }}>
              <span style={{ fontSize: 22 }}>{a.emoji}</span>
              <span style={{ flex: 1, fontSize: 14, fontWeight: 800, color: '#44405e' }}>{a.label}</span>
              <span style={{ fontSize: 14, fontWeight: 900, color: '#7c4dff' }}>+{a.minutes}분</span>
            </button>
          ))}
        </div>
        {msg && <div style={{ fontSize: 13, fontWeight: 800, color: '#27ae60', marginTop: 10, textAlign: 'center' }}>{msg}</div>}
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button disabled={offMin <= 0} onClick={() => { playClick(); onAdd(-5); setMsg('5분 뺐어요'); }} style={{
            flex: 1, padding: '11px 0', borderRadius: 12, border: '2px solid #ddd', background: 'white',
            color: offMin > 0 ? '#e67e22' : '#ccc', fontSize: 13, fontWeight: 800, cursor: offMin > 0 ? 'pointer' : 'default', fontFamily: 'inherit',
          }}>잘못 눌렀어요 −5분</button>
          <button onClick={() => { playClick(); onClose(); }} style={{
            flex: 1, padding: '11px 0', borderRadius: 12, border: 'none',
            background: 'linear-gradient(135deg,#667eea,#764ba2)', color: 'white', fontSize: 14, fontWeight: 900,
            cursor: 'pointer', fontFamily: 'inherit',
          }}>닫기</button>
        </div>
      </div>
    </div>
  );
}

const CONFETTI = ['🎉', '⭐', '🎊', '✨', '💖', '🌟', '🎈', '🍀'];

/** 영어 30분을 채웠을 때 하루 한 번 뜨는 축하 화면 */
export function MissionCelebration({ onClose }: { onClose: () => void }) {
  return (
    <div
      role="dialog"
      aria-label="오늘 영어 30분 완료"
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
          오늘 영어 30분을 다 채웠어요!<br />
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

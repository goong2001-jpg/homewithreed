import React from 'react';
import { LogMap, sumDays, weekOf, isStudyDay } from '../words/log';
import { playClick } from '../utils/sounds';

const DAYS = ['월', '화', '수', '목', '금', '토', '일'];

/** 한 주 기록에서 칭찬할 말을 고른다 */
function praise(studyDays: number, mastered: number, right: number): string {
  if (studyDays >= 6) return '일주일 내내 열심히 했어! 정말 대단해! 🏆';
  if (studyDays >= 4) return '꾸준히 공부했어! 멋져! 💪';
  if (mastered > 0) return '완전히 익힌 단어가 생겼어! 💎';
  if (right >= 10) return '문제를 정말 잘 풀었어! 👏';
  return '공부를 시작한 것만으로도 멋져! 🌱';
}

/**
 * 주간 칭찬 카드 — 한 주(월~일) 동안 한 일을 요정이 칭찬해 준다.
 * 새 주에 처음 앱을 열면 지난주 카드가 한 번 뜨고, 엄마·아빠 메뉴에서 언제든 볼 수 있다.
 */
export default function WeeklyCard({ log, date, name, title, onClose }: {
  log: LogMap;
  /** 이 날짜가 든 주를 보여준다 */
  date: string;
  name: string;
  title: string;
  onClose: () => void;
}) {
  const week = weekOf(log, date);
  const sum = sumDays(week.map(d => d.log));
  const who = name ? `${name}, ` : '';

  const stat = (emoji: string, n: number, label: string) => (
    <div style={{ flex: 1, background: 'rgba(255,255,255,0.85)', borderRadius: 14, padding: '10px 4px' }}>
      <div style={{ fontSize: 22 }}>{emoji}</div>
      <div style={{ fontSize: 22, fontWeight: 900, color: '#5b4b8a' }}>{n}</div>
      <div style={{ fontSize: 11, fontWeight: 800, color: '#8a7a9a' }}>{label}</div>
    </div>
  );

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 250, padding: 16,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Nunito','Noto Sans KR',sans-serif",
    }}>
      <div style={{
        background: 'linear-gradient(160deg,#fff1c9,#ffd6e8 60%,#d9d4ff)', borderRadius: 26,
        padding: '22px 18px', maxWidth: 360, width: '100%', textAlign: 'center',
        boxShadow: '0 25px 80px rgba(0,0,0,0.35)', border: '4px solid rgba(255,255,255,0.9)',
      }}>
        <div style={{ fontSize: 44 }}>🏅</div>
        <div style={{ fontSize: 20, fontWeight: 900, color: '#44405e' }}>{title}</div>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#8a7a9a', marginBottom: 12 }}>
          {week[0].date} ~ {week[6].date}
        </div>

        <div style={{ display: 'flex', gap: 5, justifyContent: 'center', marginBottom: 12 }}>
          {week.map((d, i) => {
            const on = isStudyDay(d.log);
            return (
              <div key={d.date} style={{
                width: 38, padding: '6px 0', borderRadius: 12, fontSize: 12, fontWeight: 900,
                background: on ? 'linear-gradient(135deg,#84fab0,#8fd3f4)' : 'rgba(255,255,255,0.6)',
                color: on ? '#1e5c40' : '#bbb',
              }}>
                {DAYS[i]}
                <div style={{ fontSize: 16 }}>{on ? '⭐' : '·'}</div>
              </div>
            );
          })}
        </div>

        <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
          {stat('📅', sum.studyDays, '공부한 날')}
          {stat('🆕', sum.newWords, '새로 배운 단어')}
          {stat('💎', sum.mastered, '완전히 익힌 단어')}
        </div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
          {stat('✅', sum.right, '한 번에 맞힌 문제')}
          {stat('🎮', sum.games, '놀이터 활동')}
          {stat('🎟️', sum.earned, '받은 쿠폰')}
        </div>

        <div style={{
          background: 'white', borderRadius: 16, padding: '12px 12px', marginBottom: 14,
          fontSize: 15, fontWeight: 900, color: '#b5478f', lineHeight: 1.4,
        }}>
          🧚 {who}{praise(sum.studyDays, sum.mastered, sum.right)}
        </div>

        <button onClick={() => { playClick(); onClose(); }} style={{
          width: '100%', padding: '13px 0', borderRadius: 14, border: 'none',
          background: 'linear-gradient(135deg,#667eea,#764ba2)', color: 'white',
          fontSize: 16, fontWeight: 900, cursor: 'pointer', fontFamily: 'inherit',
        }}>좋아! 👍</button>
      </div>
    </div>
  );
}

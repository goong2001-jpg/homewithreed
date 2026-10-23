import React, { Suspense, lazy, useCallback, useMemo, useState } from 'react';
import { useWordProgress } from '../hooks/useWordProgress';
import { useGameState } from '../hooks/useGameState';
import { useMissions } from '../hooks/useMissions';
import { useStreak } from '../hooks/useStreak';
import { learnedPool } from '../words/pool';
import { playClick } from '../utils/sounds';
import Loading from '../components/Loading';

// 놀이는 고를 때 하나씩 내려받는다
const MatchGame = lazy(() => import('../components/games/MatchGame'));
const SpellGame = lazy(() => import('../components/games/SpellGame'));
const TeacherGame = lazy(() => import('../components/games/TeacherGame'));
const FindGame = lazy(() => import('../components/games/FindGame'));
const PictureBook = lazy(() => import('../components/games/PictureBook'));

type Game = 'match' | 'spell' | 'book' | 'teacher' | 'find';

const GAMES: { id: Game; emoji: string; title: string; desc: string; color: string }[] = [
  { id: 'match',   emoji: '🃏', title: '짝 맞추기',   desc: '그림과 단어 짝 찾기',         color: 'linear-gradient(135deg,#a18cd1,#fbc2eb)' },
  { id: 'spell',   emoji: '🔤', title: '철자 맞추기', desc: '글자 조각으로 단어 만들기',   color: 'linear-gradient(135deg,#ffe29f,#ffa99f)' },
  { id: 'book',    emoji: '📚', title: '단어 그림책', desc: '내가 모은 단어 보기',         color: 'linear-gradient(135deg,#84fab0,#8fd3f4)' },
  { id: 'teacher', emoji: '👩‍🏫', title: '선생님 놀이', desc: '엄마·아빠에게 문제 내기',    color: 'linear-gradient(135deg,#f6d365,#fda085)' },
  { id: 'find',    emoji: '🏠', title: '물건 찾기',   desc: '집에서 진짜 물건 찾아오기',   color: 'linear-gradient(135deg,#a1c4fd,#c2e9fb)' },
];

export default function PlayScreen() {
  const { progress } = useWordProgress();
  const { gameState, addPoints } = useGameState();
  const { bump } = useMissions();
  const { markActive } = useStreak();
  const [game, setGame] = useState<Game | null>(null);
  const pool = useMemo(() => learnedPool(progress.seen, progress.unit), [progress.seen, progress.unit]);
  const learnedCount = Object.keys(progress.seen).length;

  // 별을 받는 순간 = 놀이를 한 판 한 것 → 오늘 미션 "놀이터 게임 1판" 과 스트릭에 반영
  const onStars = useCallback((n: number) => {
    addPoints(n);
    bump('play');
    markActive();
  }, [addPoints, bump, markActive]);
  const back = useCallback(() => { setGame(null); playClick(); }, []);

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(160deg,#d7f9f1 0%,#cddafd 50%,#fde2e4 100%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '14px 16px 40px', fontFamily: "'Nunito','Noto Sans KR',sans-serif",
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', maxWidth: 380, marginBottom: 12 }}>
        <div style={{ fontSize: 21, fontWeight: 900, color: '#44405e' }}>🎮 놀이터</div>
        <div style={{ background: 'white', borderRadius: 14, padding: '7px 12px', fontSize: 14, fontWeight: 800, color: '#f39c12', boxShadow: '0 3px 10px rgba(0,0,0,0.1)' }}>
          ⭐ {gameState.points}
        </div>
      </div>

      {game === null && (
        <>
          <div style={{ width: '100%', maxWidth: 380, fontSize: 13, color: '#6b6b7d', fontWeight: 700, marginBottom: 12 }}>
            지금까지 배운 단어 {learnedCount}개로 놀아요!
            {learnedCount < 12 && ' (아직 적으면 배우는 소리의 단어도 같이 나와요)'}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', maxWidth: 380 }}>
            {GAMES.map(g => (
              <button key={g.id} onClick={() => { setGame(g.id); playClick(); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', borderRadius: 20,
                  border: 'none', background: g.color, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                  boxShadow: '0 4px 14px rgba(0,0,0,0.1)',
                }}>
                <span style={{ fontSize: 40 }}>{g.emoji}</span>
                <span>
                  <div style={{ fontSize: 18, fontWeight: 900, color: '#3b2f4a' }}>{g.title}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#5b4a6a' }}>{g.desc}</div>
                </span>
              </button>
            ))}
          </div>
        </>
      )}

      {game !== null && game !== 'book' && (
        <button onClick={back} style={{
          alignSelf: 'center', width: '100%', maxWidth: 380, marginBottom: 10, padding: '8px 0', borderRadius: 12,
          border: 'none', background: 'rgba(255,255,255,0.8)', color: '#7c4dff', fontWeight: 800, fontSize: 14,
          cursor: 'pointer', fontFamily: 'inherit',
        }}>← 놀이 고르기</button>
      )}
      <Suspense fallback={<Loading />}>
        {game === 'match' && <MatchGame pool={pool} onStars={onStars} onBack={back} />}
        {game === 'spell' && <SpellGame pool={pool} onStars={onStars} onBack={back} />}
        {game === 'teacher' && <TeacherGame pool={pool} onStars={onStars} onBack={back} />}
        {game === 'find' && <FindGame pool={pool} onStars={onStars} onBack={back} />}
        {game === 'book' && <PictureBook seen={progress.seen} known={progress.known} onBack={back} />}
      </Suspense>
    </div>
  );
}

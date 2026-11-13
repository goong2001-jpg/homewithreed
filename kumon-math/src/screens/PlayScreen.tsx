import React, { Suspense, lazy, useCallback, useMemo, useState } from 'react';
import { useWordProgress } from '../hooks/useWordProgress';
import { useGameState } from '../hooks/useGameState';
import { useMissions } from '../hooks/useMissions';
import { useStreak } from '../hooks/useStreak';
import { useSettings } from '../hooks/useSettings';
import { learnedPool, toughWords } from '../words/pool';
import { logDay, readConfusions, topConfusions } from '../words/log';
import { WORD_BANK } from '../words/wordBank';
import { isoToday } from '../words/dates';
import { playClick } from '../utils/sounds';
import Loading from '../components/Loading';
import GradTest, { GRAD_STARS, Certificate } from '../components/GradTest';

// 놀이는 고를 때 하나씩 내려받는다
const MatchGame = lazy(() => import('../components/games/MatchGame'));
const SpellGame = lazy(() => import('../components/games/SpellGame'));
const TeacherGame = lazy(() => import('../components/games/TeacherGame'));
const FindGame = lazy(() => import('../components/games/FindGame'));
const PictureBook = lazy(() => import('../components/games/PictureBook'));
const SentenceGame = lazy(() => import('../components/games/SentenceGame'));
const SpeakGame = lazy(() => import('../components/games/SpeakGame'));
const TrainGame = lazy(() => import('../components/games/TrainGame'));
const ConfuseGame = lazy(() => import('../components/games/ConfuseGame'));

type Game = 'match' | 'spell' | 'dictation' | 'sentence' | 'speak' | 'book' | 'teacher' | 'find' | 'train' | 'confuse' | 'certs';

const GAMES: { id: Game; emoji: string; title: string; desc: string; color: string }[] = [
  { id: 'match',   emoji: '🃏', title: '짝 맞추기',   desc: '그림과 단어 짝 찾기',         color: 'linear-gradient(135deg,#a18cd1,#fbc2eb)' },
  { id: 'spell',   emoji: '🔤', title: '철자 맞추기', desc: '글자 조각으로 단어 만들기',   color: 'linear-gradient(135deg,#ffe29f,#ffa99f)' },
  { id: 'dictation', emoji: '✍️', title: '듣고 받아쓰기', desc: '소리만 듣고 단어 만들기',   color: 'linear-gradient(135deg,#fddb92,#d1fdff)' },
  { id: 'sentence', emoji: '🧩', title: '문장 만들기', desc: '낱말을 이어 문장 만들기',      color: 'linear-gradient(135deg,#c2e9fb,#a1c4fd)' },
  { id: 'speak',   emoji: '🎤', title: '따라 말하기', desc: '마이크에 대고 말하기',         color: 'linear-gradient(135deg,#ff9a9e,#fecfef)' },
  { id: 'train',   emoji: '🎯', title: '특별 훈련',   desc: '자주 틀리는 단어 연습',        color: 'linear-gradient(135deg,#fbc2eb,#a6c1ee)' },
  { id: 'confuse', emoji: '🔀', title: '헷갈리는 짝', desc: '비슷한 두 단어 비교하기',      color: 'linear-gradient(135deg,#d4fc79,#96e6a1)' },
  { id: 'book',    emoji: '📚', title: '단어 그림책', desc: '내가 모은 단어 보기',         color: 'linear-gradient(135deg,#84fab0,#8fd3f4)' },
  { id: 'teacher', emoji: '👩‍🏫', title: '선생님 놀이', desc: '엄마·아빠에게 문제 내기',    color: 'linear-gradient(135deg,#f6d365,#fda085)' },
  { id: 'find',    emoji: '🏠', title: '물건 찾기',   desc: '집에서 진짜 물건 찾아오기',   color: 'linear-gradient(135deg,#a1c4fd,#c2e9fb)' },
  { id: 'certs',   emoji: '🎓', title: '내 졸업장',   desc: '졸업 시험과 졸업장 보기',      color: 'linear-gradient(135deg,#fff1c9,#f6d365)' },
];

export default function PlayScreen() {
  const { progress, passGrad } = useWordProgress();
  const { settings } = useSettings();
  const { gameState, addPoints } = useGameState();
  const { bump } = useMissions();
  const { markActive } = useStreak();
  const [game, setGame] = useState<Game | null>(null);
  const pool = useMemo(() => learnedPool(progress.seen, progress.unit), [progress.seen, progress.unit]);
  const learnedCount = Object.keys(progress.seen).length;
  // 특별 훈련: 자주 틀리는 단어 / 헷갈리는 짝: 문제에서 서로 바꿔 고른 단어
  const tough = useMemo(() => toughWords(progress.srs), [progress.srs]);
  const pairs = useMemo(() => topConfusions(readConfusions(), 4)
    .map(c => ({ a: WORD_BANK.find(w => w.en === c.a), b: WORD_BANK.find(w => w.en === c.b) }))
    .filter((p): p is { a: typeof WORD_BANK[number]; b: typeof WORD_BANK[number] } => !!p.a && !!p.b),
  // 놀이를 고를 때마다 새로 읽는다
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [game]);
  const [gradUnit, setGradUnit] = useState<number | null>(null);
  const graduated = Object.entries(progress.graduated).map(([u, date]) => ({ unit: Number(u), date }))
    .sort((a, b) => a.unit - b.unit);

  // 별을 받는 순간 = 놀이를 한 판 한 것 → 오늘 미션 "놀이터 게임 1판" 과 스트릭에 반영
  const onStars = useCallback((n: number) => {
    addPoints(n);
    bump('play');
    markActive();
    logDay('games');
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
          {/* 놀이가 많아서 두 줄로 놓는다 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, width: '100%', maxWidth: 380 }}>
            {GAMES.map(g => (
              <button key={g.id} onClick={() => { setGame(g.id); playClick(); }}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, padding: '12px 8px',
                  borderRadius: 20, border: 'none', background: g.color, cursor: 'pointer', fontFamily: 'inherit',
                  textAlign: 'center', boxShadow: '0 4px 14px rgba(0,0,0,0.1)', position: 'relative',
                }}>
                <span style={{ fontSize: 36, lineHeight: 1.1 }}>{g.emoji}</span>
                <div style={{ fontSize: 16, fontWeight: 900, color: '#3b2f4a' }}>{g.title}</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#5b4a6a' }}>{g.desc}</div>
                {/* 할 것이 있는 놀이에는 숫자를 붙인다 */}
                {((g.id === 'train' && tough.length > 0) || (g.id === 'certs' && progress.pendingGrad.length > 0)) && (
                  <span style={{
                    position: 'absolute', top: 6, right: 8, background: '#e74c3c', color: 'white', borderRadius: 10,
                    padding: '1px 7px', fontSize: 12, fontWeight: 900,
                  }}>{g.id === 'train' ? tough.length : progress.pendingGrad.length}</span>
                )}
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
        {game === 'dictation' && <SpellGame pool={pool} onStars={onStars} onBack={back} dictation />}
        {game === 'sentence' && <SentenceGame pool={pool} onStars={onStars} onBack={back} />}
        {game === 'speak' && <SpeakGame pool={pool} onStars={onStars} onBack={back} />}
        {game === 'train' && <TrainGame pool={tough} others={pool} onStars={onStars} onBack={back} />}
        {game === 'confuse' && <ConfuseGame pairs={pairs} onStars={onStars} onBack={back} />}
        {game === 'certs' && (
          <div style={{
            background: 'white', borderRadius: 24, padding: '18px 16px', width: '100%', maxWidth: 380,
            textAlign: 'center', boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
          }}>
            <div style={{ fontSize: 17, fontWeight: 900, color: '#44405e', marginBottom: 10 }}>🎓 내 졸업장</div>
            {progress.pendingGrad.map(u => (
              <button key={u} onClick={() => { setGradUnit(u); playClick(); }} style={{
                width: '100%', padding: '13px 0', borderRadius: 14, border: 'none', marginBottom: 8,
                background: 'linear-gradient(135deg,#f6d365,#fda085)', color: '#5b3a1a',
                fontSize: 16, fontWeight: 900, cursor: 'pointer', fontFamily: 'inherit',
              }}>🎓 {u + 1}단계 졸업 시험 보기</button>
            ))}
            {graduated.length === 0 && progress.pendingGrad.length === 0 && (
              <div style={{ fontSize: 14, color: '#888', lineHeight: 1.6 }}>
                아직 졸업장이 없어요.<br />소리 단계 하나를 다 배우면 졸업 시험을 볼 수 있어요!
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {graduated.map(g => <Certificate key={g.unit} unit={g.unit} date={g.date} name={settings.childName} />)}
            </div>
          </div>
        )}
        {gradUnit !== null && (
          <GradTest unit={gradUnit} name={settings.childName} today={isoToday()}
            onPass={() => { passGrad(gradUnit); onStars(GRAD_STARS); }}
            onClose={() => setGradUnit(null)} />
        )}
      </Suspense>
    </div>
  );
}

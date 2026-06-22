import React, { useState, useCallback, useEffect } from 'react';
import './App.css';
import { Problem, Operation } from './types';
import { useGameState } from './hooks/useGameState';
import Avatar from './components/Avatar';
import ProblemCard from './components/ProblemCard';
import ProgressBar from './components/ProgressBar';
import CountingHelper from './components/CountingHelper';
import Shop from './components/Shop';
import { playCorrect, playWrong, playStreak } from './utils/sounds';

type AvatarMood = 'idle' | 'happy' | 'sad' | 'thinking';

const CORRECT_MESSAGES = [
  '딩동댕! 정답이야 🎉',
  '우와 맞았어! 최고야 ⭐',
  '정답! 진짜 잘했어 👏',
  '오~ 똑똑한걸! ✨',
  '맞혔다! 신난다 🎊',
  '와! 척척박사네 🌟',
];

const STREAK_MESSAGES: Record<number, string> = {
  3: '3번 연속 정답! 멋지다 🔥',
  5: '5번 연속! 수학 천재다 👑',
  7: '7번 연속! 우와 대단해 💖',
  10: '10번 연속!! 진짜 최고야 🚀',
};

const WRONG_MESSAGES = [
  '아쉽다! 다시 한 번 해볼까? 😊',
  '괜찮아~ 천천히 또 해보자 💪',
  '거의 다 왔어! 한 번 더 도전! 🌈',
  '실수해도 괜찮아, 같이 세어보자 🤗',
];

function generateProblem(level: number): Problem {
  const operations: Operation[] = level <= 12 ? ['add'] : ['add', 'subtract'];
  const operation = operations[Math.floor(Math.random() * operations.length)];

  let num1: number, num2: number;

  if (level <= 3) {
    num1 = Math.floor(Math.random() * 5) + 1;
    num2 = Math.floor(Math.random() * Math.min(5, 10 - num1)) + 1;
  } else if (level <= 7) {
    num1 = Math.floor(Math.random() * 9) + 1;
    num2 = Math.floor(Math.random() * 9) + 1;
    if (num1 + num2 > 15) num2 = Math.floor(Math.random() * (15 - num1)) + 1;
  } else if (level <= 12) {
    num1 = Math.floor(Math.random() * 10) + 1;
    num2 = 10;
  } else if (level <= 16) {
    if (operation === 'add') {
      num1 = Math.floor(Math.random() * 10) + 1;
      num2 = Math.floor(Math.random() * 9) + 1;
      if (num1 + num2 > 20) num2 = 20 - num1;
    } else {
      num1 = Math.floor(Math.random() * 10) + 11;
      num2 = Math.floor(Math.random() * 10) + 1;
    }
  } else {
    if (operation === 'add') {
      num1 = Math.floor(Math.random() * 15) + 6;
      num2 = Math.floor(Math.random() * 9) + 1;
    } else {
      num1 = Math.floor(Math.random() * 20) + 5;
      num2 = Math.floor(Math.random() * (num1 - 1)) + 1;
    }
  }

  const answer = operation === 'add' ? num1 + num2 : num1 - num2;
  return { num1, num2, operation, answer };
}

export default function App() {
  const { gameState, items, onCorrect, onWrong, buyItem, equipItem } = useGameState();
  const [problem, setProblem] = useState<Problem>(() => generateProblem(1));
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [mood, setMood] = useState<AvatarMood>('idle');
  const [showHelper, setShowHelper] = useState(false);
  const [showShop, setShowShop] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState('');
  const [pointsFlash, setPointsFlash] = useState(0);
  const [flashKey, setFlashKey] = useState(0);

  const nextProblem = useCallback((lvl: number) => {
    setIsCorrect(null);
    setMood('thinking');
    setProblem(generateProblem(lvl));
    setTimeout(() => setMood('idle'), 400);
  }, []);

  const handleSubmit = useCallback((answer: number) => {
    if (isCorrect !== null) return;

    if (answer === problem.answer) {
      setIsCorrect(true);
      setMood('happy');

      const newStreak = gameState.streak + 1;
      const streakMsg = STREAK_MESSAGES[newStreak];
      const normalMsg = CORRECT_MESSAGES[Math.floor(Math.random() * CORRECT_MESSAGES.length)];
      setFeedbackMsg(streakMsg || normalMsg);

      const earned = 3 + (newStreak > 0 && newStreak % 5 === 0 ? 2 : 0);
      setPointsFlash(earned);
      setFlashKey(k => k + 1);

      if (newStreak > 0 && newStreak % 5 === 0) {
        playStreak();
      } else {
        playCorrect();
      }

      onCorrect();
      setTimeout(() => {
        setPointsFlash(0);
        setFeedbackMsg('');
        nextProblem(Math.min(gameState.level + (newStreak >= 5 ? 1 : 0), 20));
      }, 1600);
    } else {
      setIsCorrect(false);
      setMood('sad');
      const msg = WRONG_MESSAGES[Math.floor(Math.random() * WRONG_MESSAGES.length)];
      setFeedbackMsg(msg);
      playWrong();
      onWrong();
      setTimeout(() => {
        setShowHelper(true);
        setIsCorrect(null);
        setMood('idle');
        setFeedbackMsg('');
      }, 1000);
    }
  }, [problem, isCorrect, onCorrect, onWrong, gameState.streak, gameState.level, nextProblem]);

  useEffect(() => {
    setProblem(generateProblem(gameState.level));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(160deg, #ffecd2 0%, #fcb69f 40%, #c3cfe2 100%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '20px 16px 40px',
      fontFamily: "'Nunito', 'Noto Sans KR', sans-serif",
    }}>
      {/* 상단 바 */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        width: '100%', maxWidth: 380, marginBottom: 20,
      }}>
        <div style={{ fontSize: 24, fontWeight: 900, color: '#2c3e50' }}>
          🧮 수학놀이
        </div>
        <button
          onClick={() => setShowShop(true)}
          style={{
            background: 'linear-gradient(135deg, #f093fb, #f5576c)',
            color: 'white', border: 'none', borderRadius: 14,
            padding: '10px 18px', fontSize: 15, fontWeight: 800,
            cursor: 'pointer', boxShadow: '0 4px 12px rgba(240,147,251,0.5)',
          }}
        >
          🛍️ 상점
        </button>
      </div>

      <ProgressBar level={gameState.level} streak={gameState.streak} points={gameState.points} />

      {/* 아바타 영역 */}
      <div style={{
        margin: '16px 0 12px',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
      }}>
        <div className={mood === 'happy' ? 'avatar-bounce' : mood === 'sad' ? 'avatar-shake' : mood === 'thinking' ? 'avatar-pulse' : ''}>
          <Avatar items={items} mood={mood} size="large" />
        </div>

        {pointsFlash > 0 && (
          <div key={flashKey} style={{
            fontSize: 22, fontWeight: 800, color: '#f39c12',
            animation: 'floatUp 1.4s ease forwards',
          }}>
            +{pointsFlash} ⭐
          </div>
        )}

        {feedbackMsg && (
          <div style={{
            fontSize: 17, fontWeight: 700,
            color: isCorrect ? '#27ae60' : '#e74c3c',
            background: 'white',
            padding: '10px 20px',
            borderRadius: 20,
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            animation: 'fadeIn 0.3s ease',
            textAlign: 'center',
            maxWidth: 280,
          }}>
            {feedbackMsg}
          </div>
        )}
      </div>

      <ProblemCard problem={problem} onSubmit={handleSubmit} isCorrect={isCorrect} />

      <div style={{
        marginTop: 20,
        display: 'flex', gap: 20,
        color: 'rgba(0,0,0,0.5)', fontSize: 14, fontWeight: 600,
      }}>
        <span>✅ {gameState.totalCorrect}개</span>
        <span>❌ {gameState.totalWrong}개</span>
        <span>정답률: {gameState.totalCorrect + gameState.totalWrong > 0
          ? Math.round(gameState.totalCorrect / (gameState.totalCorrect + gameState.totalWrong) * 100)
          : 0}%</span>
      </div>

      {showHelper && (
        <CountingHelper
          problem={problem}
          onClose={() => {
            setShowHelper(false);
            nextProblem(Math.max(gameState.level - 1, 1));
          }}
        />
      )}
      {showShop && (
        <Shop
          items={items}
          points={gameState.points}
          totalCorrect={gameState.totalCorrect}
          onBuy={buyItem}
          onEquip={equipItem}
          onClose={() => setShowShop(false)}
        />
      )}
    </div>
  );
}

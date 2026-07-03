import React, { useState, useCallback } from 'react';
import './App.css';
import { Problem } from './types';
import { useGameState } from './hooks/useGameState';
import { generateProblem, getCourse } from './curriculum/math';
import Avatar from './components/Avatar';
import ProblemCard from './components/ProblemCard';
import ProgressBar from './components/ProgressBar';
import DailyMission from './components/DailyMission';
import CountingHelper from './components/CountingHelper';
import CourseSelect from './components/CourseSelect';
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

export default function App() {
  const { gameState, items, onCorrect, onWrong, buyItem, equipItem, switchCourse } = useGameState();
  const [problem, setProblem] = useState<Problem>(() => generateProblem(gameState.courseId, gameState.level));
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [mood, setMood] = useState<AvatarMood>('idle');
  const [showHelper, setShowHelper] = useState(false);
  const [showShop, setShowShop] = useState(false);
  const [showCourseSelect, setShowCourseSelect] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState('');
  const [pointsFlash, setPointsFlash] = useState(0);
  const [flashKey, setFlashKey] = useState(0);
  const [unlocked, setUnlocked] = useState<{ id: string; name: string; emoji: string } | null>(null);

  const course = getCourse(gameState.courseId);

  const nextProblem = useCallback((courseId: string, lvl: number) => {
    setIsCorrect(null);
    setMood('thinking');
    setProblem(generateProblem(courseId, lvl));
    setTimeout(() => setMood('idle'), 400);
  }, []);

  const handleSubmit = useCallback((answer: number) => {
    if (isCorrect !== null) return;

    if (answer === problem.answer) {
      setIsCorrect(true);
      setMood('happy');

      const result = onCorrect();
      const newStreak = gameState.streak + 1;

      if (result.missionCompleted) {
        setFeedbackMsg(`오늘의 미션 완료! 보너스 +20⭐ 🏆`);
        playStreak();
      } else if (STREAK_MESSAGES[newStreak]) {
        setFeedbackMsg(STREAK_MESSAGES[newStreak]);
        playStreak();
      } else {
        setFeedbackMsg(CORRECT_MESSAGES[Math.floor(Math.random() * CORRECT_MESSAGES.length)]);
        playCorrect();
      }

      setPointsFlash(result.earned);
      setFlashKey(k => k + 1);

      setTimeout(() => {
        setPointsFlash(0);
        setFeedbackMsg('');
        if (result.unlockedCourse) {
          setUnlocked(result.unlockedCourse);
        } else {
          nextProblem(result.courseId, result.nextLevel);
        }
      }, 1600);
    } else {
      setIsCorrect(false);
      setMood('sad');
      setFeedbackMsg(WRONG_MESSAGES[Math.floor(Math.random() * WRONG_MESSAGES.length)]);
      playWrong();
      onWrong();
      setTimeout(() => {
        setShowHelper(true);
        setIsCorrect(null);
        setMood('idle');
        setFeedbackMsg('');
      }, 1000);
    }
  }, [problem, isCorrect, onCorrect, onWrong, gameState.streak, nextProblem]);

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

      <ProgressBar
        level={gameState.level}
        streak={gameState.streak}
        points={gameState.points}
        courseName={course.name}
        courseEmoji={course.emoji}
        onCourseClick={() => setShowCourseSelect(true)}
      />

      <DailyMission
        todaySolved={gameState.todaySolved}
        dailyGoal={gameState.dailyGoal}
        attendanceStreak={gameState.attendanceStreak}
      />

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
            nextProblem(gameState.courseId, gameState.level);
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

      {/* 📚 코스 고르기 모달 */}
      {showCourseSelect && (
        <CourseSelect
          currentCourseId={gameState.courseId}
          unlockedCourseIds={gameState.unlockedCourseIds}
          courseLevels={gameState.courseLevels}
          onSelect={(id) => {
            switchCourse(id);
            nextProblem(id, gameState.courseLevels[id] ?? 1);
          }}
          onClose={() => setShowCourseSelect(false)}
        />
      )}

      {/* 🎉 새 코스 해금 모달 — 자동으로 넘어가지 않고 아이가 선택 */}
      {unlocked && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 200, padding: 20,
        }}>
          <div style={{
            background: 'linear-gradient(160deg, #fbc2eb, #a6c1ee)',
            borderRadius: 28, padding: '36px 28px', maxWidth: 380, width: '100%',
            textAlign: 'center', boxShadow: '0 25px 80px rgba(0,0,0,0.4)',
            animation: 'fadeIn 0.4s ease',
          }}>
            <div style={{ fontSize: 64, marginBottom: 8 }}>🎉</div>
            <div style={{ fontSize: 24, fontWeight: 900, color: '#5b3a7a', marginBottom: 8 }}>
              새 코스가 열렸어!
            </div>
            <div style={{ fontSize: 17, fontWeight: 700, color: '#6b4a8a', marginBottom: 20, lineHeight: 1.5 }}>
              정말 잘해서<br />
              <span style={{ fontSize: 22, color: '#e74c3c' }}>{unlocked.emoji} {unlocked.name}</span><br />
              코스가 열렸어! 지금 해볼래?
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button
                onClick={() => {
                  const u = unlocked;
                  setUnlocked(null);
                  playStreak();
                  switchCourse(u.id);
                  nextProblem(u.id, 1);
                }}
                style={{
                  background: 'linear-gradient(135deg, #667eea, #764ba2)',
                  color: 'white', border: 'none', borderRadius: 14,
                  padding: '14px 24px', fontSize: 16, fontWeight: 800,
                  cursor: 'pointer', boxShadow: '0 6px 20px rgba(102,126,234,0.5)',
                }}
              >
                지금 도전! 🚀
              </button>
              <button
                onClick={() => {
                  setUnlocked(null);
                  nextProblem(gameState.courseId, gameState.level);
                }}
                style={{
                  background: 'white',
                  color: '#764ba2', border: '2px solid #764ba2', borderRadius: 14,
                  padding: '14px 24px', fontSize: 16, fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                나중에 할래 😊
              </button>
            </div>
            <div style={{ fontSize: 12, color: '#8a6aa8', marginTop: 14 }}>
              위쪽 📚 코스 이름을 누르면 언제든 바꿀 수 있어요
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

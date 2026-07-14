import { useState } from 'react';
import CbtExam from './components/CbtExam';
import PracticalStudy from './components/PracticalStudy';
import WrongNote from './components/WrongNote';
import { loadHistory, loadWrongNotes } from './storage';

type View = 'home' | 'cbt' | 'wrongnote' | 'practical';

export default function App() {
  const [view, setView] = useState<View>('home');

  const goHome = () => setView('home');

  return (
    <div className="app">
      <header className="app-header">
        <h1 onClick={goHome}>🦺 산업안전기사 시험 대비</h1>
        <span className="subtitle">필기 CBT · 오답노트 · 실기 필답형</span>
      </header>

      {view === 'home' && <Home onSelect={setView} />}
      {view === 'cbt' && <CbtExam onExit={goHome} />}
      {view === 'wrongnote' && <WrongNote onExit={goHome} />}
      {view === 'practical' && <PracticalStudy onExit={goHome} />}
    </div>
  );
}

function Home({ onSelect }: { onSelect: (view: View) => void }) {
  const history = loadHistory();
  const wrongCount = loadWrongNotes().length;

  return (
    <div>
      <div className="mode-cards">
        <button className="mode-card" onClick={() => onSelect('cbt')}>
          <span className="icon">📝</span>
          <h2>필기 CBT 모의고사</h2>
          <p>실제 시험처럼 6과목 × 20문제, 180분 타이머로 풀고 과목별 점수와 합격 여부를 확인합니다.</p>
          <span className="badge">120문제 · 180분</span>
        </button>
        <button className="mode-card" onClick={() => onSelect('wrongnote')}>
          <span className="icon">📕</span>
          <h2>오답노트</h2>
          <p>모의고사에서 틀린 문제를 모아 다시 풀어봅니다. 맞히면 목록에서 지울 수 있어요.</p>
          <span className="badge">{wrongCount}문제 저장됨</span>
        </button>
        <button className="mode-card" onClick={() => onSelect('practical')}>
          <span className="icon">🗂️</span>
          <h2>실기 필답형 대비</h2>
          <p>기출 유형 필답형 문제를 플래시카드로 암기합니다. 스스로 채점하며 모르는 문제만 반복하세요.</p>
          <span className="badge">셀프 채점</span>
        </button>
      </div>

      <h3 className="section-title">최근 모의고사 기록</h3>
      {history.length === 0 ? (
        <div className="empty-note">아직 응시 기록이 없습니다. 첫 모의고사에 도전해 보세요!</div>
      ) : (
        <div className="history-list">
          {history.slice(0, 5).map((record, i) => {
            const total = record.scores.reduce((sum, s) => sum + s.total, 0);
            const correct = record.scores.reduce((sum, s) => sum + s.correct, 0);
            const avg = total === 0 ? 0 : (correct / total) * 100;
            return (
              <div key={i} className="history-item">
                <span className="date">
                  {new Date(record.date).toLocaleString('ko-KR', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                </span>
                <span>평균 {avg.toFixed(1)}점</span>
                <span className={`pass-tag ${record.passed ? 'pass' : 'fail'}`}>
                  {record.passed ? '합격' : '불합격'}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

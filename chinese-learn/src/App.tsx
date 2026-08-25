import React, { useCallback, useEffect, useState } from 'react';
import ExamView from './components/ExamView';
import HistoryView from './components/HistoryView';
import StudyView from './components/StudyView';
import { LESSONS } from './data/lessons';
import { ExamRecord } from './data/types';
import { chineseVoiceAvailable, speechSupported, stopSpeaking, warmUpVoices } from './speech';
import { addExam, clearAll, loadExams, loadLearned, saveLearned } from './storage';

type Tab = 'study' | 'exam' | 'history';

const TABS: { key: Tab; icon: string; label: string }[] = [
  { key: 'study', icon: '📚', label: '학습' },
  { key: 'exam', icon: '📝', label: '시험' },
  { key: 'history', icon: '📊', label: '기록' },
];

export default function App() {
  const [tab, setTab] = useState<Tab>('study');
  const [index, setIndex] = useState(0);
  const [learned, setLearned] = useState<number[]>(() => loadLearned());
  const [exams, setExams] = useState<ExamRecord[]>(() => loadExams());
  const [hasVoice, setHasVoice] = useState(true);

  // 음성 목록은 늦게 로드되므로 깨워두고, 다 불러온 뒤 중국어 음성 유무를 다시 본다
  useEffect(() => {
    if (!speechSupported()) {
      setHasVoice(false);
      return;
    }
    const check = () => setHasVoice(chineseVoiceAvailable());
    warmUpVoices(check);
    check();
    const timer = window.setTimeout(check, 1200);
    return () => window.clearTimeout(timer);
  }, []);

  const goTab = (next: Tab) => {
    stopSpeaking();
    setTab(next);
  };

  const toggleLearned = useCallback((id: number) => {
    setLearned((prev) => {
      const next = prev.includes(id) ? prev.filter((n) => n !== id) : [...prev, id];
      saveLearned(next);
      return next.slice().sort((a, b) => a - b);
    });
  }, []);

  const handleFinished = useCallback((record: ExamRecord) => {
    setExams(addExam(record));
  }, []);

  const reviewSet = useCallback((setId: number) => {
    const i = LESSONS.findIndex((l) => l.id === setId);
    if (i >= 0) setIndex(i);
    stopSpeaking();
    setTab('study');
  }, []);

  const reset = useCallback(() => {
    clearAll();
    setLearned([]);
    setExams([]);
  }, []);

  const percent = Math.round((learned.length / LESSONS.length) * 100);

  return (
    <div className="app">
      <header className="topbar">
        <h1>중국어 한 세트</h1>
        <p>단어 1개 + 바로 쓰는 회화 1개 · 전체 {LESSONS.length}세트</p>
        <div className="progress">
          <span style={{ width: `${percent}%` }} />
        </div>
      </header>

      <main className="content">
        {tab === 'study' && (
          <StudyView
            index={index}
            onIndexChange={(i) => {
              stopSpeaking();
              setIndex(i);
            }}
            learned={learned}
            onToggleLearned={toggleLearned}
            voiceMissing={!hasVoice}
          />
        )}
        {tab === 'exam' && (
          <ExamView
            learned={learned}
            listening={hasVoice}
            onReview={reviewSet}
            onFinished={handleFinished}
          />
        )}
        {tab === 'history' && <HistoryView learned={learned} exams={exams} onReset={reset} />}
      </main>

      <nav className="tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            className={tab === t.key ? 'active' : ''}
            onClick={() => goTab(t.key)}
          >
            <span className="ico">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </nav>
    </div>
  );
}

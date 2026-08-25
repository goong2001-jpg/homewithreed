import React, { useCallback, useEffect, useMemo, useState } from 'react';
import ExamView from './components/ExamView';
import HistoryView from './components/HistoryView';
import StudyView from './components/StudyView';
import VoiceGuide from './components/VoiceGuide';
import { LESSONS } from './data/lessons';
import { ExamRecord } from './data/types';
import { onVoicesChanged, stopSpeaking, VoiceStatus, voiceStatus } from './speech';
import { addExam, clearAll, loadExams, loadLearned, saveLearned } from './storage';
import { VoiceGuideContext } from './voiceGuide';

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
  const [status, setStatus] = useState<VoiceStatus>('loading');
  const [guideOpen, setGuideOpen] = useState(false);

  const recheckVoices = useCallback(() => setStatus(voiceStatus()), []);

  // 목소리 목록은 늦게 로드되고, 사용자가 음성을 설치하고 돌아올 수도 있다.
  // 목록 변경·화면 복귀 때마다 다시 확인한다.
  useEffect(() => {
    recheckVoices();
    const off = onVoicesChanged(recheckVoices);
    const timers = [300, 1200, 3000].map((ms) => window.setTimeout(recheckVoices, ms));
    const onVisible = () => {
      if (document.visibilityState === 'visible') recheckVoices();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      off();
      timers.forEach((t) => window.clearTimeout(t));
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [recheckVoices]);

  const voiceGuide = useMemo(
    () => ({ status, openGuide: () => setGuideOpen(true) }),
    [status]
  );

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
  const voiceMissing = status === 'no-voice' || status === 'unsupported';

  return (
    <VoiceGuideContext.Provider value={voiceGuide}>
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
              voiceMissing={voiceMissing}
            />
          )}
          {tab === 'exam' && (
            <ExamView
              learned={learned}
              listening={status === 'ok'}
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

        <VoiceGuide
          open={guideOpen}
          status={status}
          onClose={() => setGuideOpen(false)}
          onRecheck={recheckVoices}
        />
      </div>
    </VoiceGuideContext.Provider>
  );
}

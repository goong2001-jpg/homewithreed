import React, { useState } from 'react';
import { findLesson, LESSONS } from '../data/lessons';
import { ExamRecord, QuizQuestion } from '../data/types';
import { buildExam, EXAM_SIZE, MIN_LEARNED, scoreExam, wrongSetIds } from '../quiz';
import { stopSpeaking } from '../speech';
import SpeakButton from './SpeakButton';

interface Props {
  learned: number[];
  listening: boolean;
  /** 결과 화면에서 "복습하기"를 눌렀을 때 학습 탭으로 이동 */
  onReview: (setId: number) => void;
  onFinished: (record: ExamRecord) => void;
}

type Phase = 'intro' | 'running' | 'result';

function comment(correct: number): string {
  if (correct === EXAM_SIZE) return '만점입니다! 이제 실전에서 써 보세요 👏';
  if (correct >= 8) return '아주 좋아요. 틀린 것만 한 번 더 보면 완벽합니다.';
  if (correct >= 5) return '절반은 넘겼어요. 틀린 세트를 다시 듣고 재도전!';
  return '괜찮아요. 학습 탭에서 소리 내어 따라 읽고 다시 봐요.';
}

export default function ExamView({ learned, listening, onReview, onFinished }: Props) {
  const [phase, setPhase] = useState<Phase>('intro');
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [current, setCurrent] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);

  const learnedSets = LESSONS.filter((l) => learned.includes(l.id));
  const canStart = learnedSets.length >= MIN_LEARNED;

  const start = () => {
    const exam = buildExam(learnedSets, { listening });
    if (!exam.length) return;
    setQuestions(exam);
    setAnswers(new Array(exam.length).fill(null));
    setCurrent(0);
    setPicked(null);
    setPhase('running');
  };

  const pick = (choiceIndex: number) => {
    if (picked !== null) return; // 한 문제에 한 번만 고를 수 있다
    setPicked(choiceIndex);
    setAnswers((prev) => {
      const next = [...prev];
      next[current] = choiceIndex;
      return next;
    });
  };

  const next = () => {
    stopSpeaking();
    setPicked(null);
    if (current + 1 < questions.length) {
      setCurrent(current + 1);
      return;
    }
    const filled = answers.map((a, i) => (i === current ? picked : a));
    const record: ExamRecord = {
      takenAt: new Date().toISOString(),
      total: questions.length,
      correct: scoreExam(questions, filled),
      wrongSetIds: wrongSetIds(questions, filled),
    };
    setAnswers(filled);
    onFinished(record);
    setPhase('result');
  };

  /* ── 시작 화면 ── */
  if (phase === 'intro') {
    return (
      <div className="card">
        <div className="card-head">
          <span className="label">시험</span>
          <span className="badge">10문제</span>
        </div>
        <p style={{ marginTop: 0 }}>
          <b>학습 완료로 표시한 세트</b>에서만 문제가 나옵니다.
          지금 시험 범위는 <b>{learnedSets.length}세트</b>예요.
        </p>
        <ul style={{ paddingLeft: 18, fontSize: 14, color: '#7d7168' }}>
          <li>한자 뜻 맞히기, 병음 보고 한자 고르기</li>
          <li>회화 문장 뜻 맞히기, 빈칸 채우기</li>
          {listening && <li>🔊 소리만 듣고 뜻 맞히기</li>}
        </ul>
        {canStart ? (
          <button type="button" className="btn primary wide" onClick={start}>
            시험 시작하기
          </button>
        ) : (
          <div className="notice" style={{ marginBottom: 0 }}>
            먼저 학습 탭에서 <b>{MIN_LEARNED}세트 이상</b>을 "학습 완료"로 표시해 주세요.
            (현재 {learnedSets.length}세트)
          </div>
        )}
      </div>
    );
  }

  /* ── 결과 화면 ── */
  if (phase === 'result') {
    const correct = scoreExam(questions, answers);
    const wrongIds = wrongSetIds(questions, answers);
    return (
      <>
        <div className="card">
          <div className="score">
            <div className="num">
              {correct}
              <small> / {questions.length}</small>
            </div>
            <div className="comment">{comment(correct)}</div>
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <span className="label">다시 볼 세트</span>
            <span className="label">{wrongIds.length}개</span>
          </div>
          {wrongIds.length === 0 ? (
            <div className="empty">틀린 문제가 없어요 🎉</div>
          ) : (
            wrongIds.map((id) => {
              const l = findLesson(id);
              if (!l) return null;
              return (
                <div key={id} className="review-item">
                  <div>
                    <div className="w" lang="zh-CN">
                      {l.word.hanzi} <span className="m">{l.word.pinyin}</span>
                    </div>
                    <div className="m">{l.word.meaning}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <SpeakButton text={l.word.hanzi} className="small">🔊</SpeakButton>
                    <button type="button" className="btn small" onClick={() => onReview(id)}>
                      복습
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="nav-row">
          <button type="button" className="btn" onClick={() => setPhase('intro')}>
            시험 화면으로
          </button>
          <button type="button" className="btn primary" onClick={start}>
            다시 풀기
          </button>
        </div>
      </>
    );
  }

  /* ── 문제 풀이 화면 ── */
  const q = questions[current];
  const answered = picked !== null;
  const isCorrect = picked === q.answerIndex;

  return (
    <>
      <div className="quiz-meta">
        <span>{current + 1} / {questions.length} 문제</span>
        <span>세트 {q.setId}</span>
      </div>

      <div className="card">
        <div className="quiz-prompt">
          {q.hidePrompt && !answered ? (
            <div className="hanzi quiz-hidden">🎧</div>
          ) : (
            <div className={`hanzi ${q.prompt.length > 6 ? 'sentence' : ''}`} lang="zh-CN">
              {q.prompt}
            </div>
          )}
          {q.promptSub && <div className="sub">{q.promptSub}</div>}
          {q.speakText && (
            <div className="speak-row" style={{ justifyContent: 'center' }}>
              <SpeakButton text={q.speakText} className="primary">🔊 듣기</SpeakButton>
              <SpeakButton text={q.speakText} rate={0.5}>🐢 천천히</SpeakButton>
            </div>
          )}
        </div>
      </div>

      {q.choices.map((c, i) => {
        let cls = '';
        if (answered && i === q.answerIndex) cls = 'correct';
        else if (answered && i === picked) cls = 'wrong';
        return (
          <button
            key={c.label}
            type="button"
            className={`choice ${cls}`}
            disabled={answered}
            onClick={() => pick(i)}
          >
            {c.label}
            {c.sub && <span className="sub">{c.sub}</span>}
          </button>
        );
      })}

      {answered && (
        <>
          <div className={`verdict ${isCorrect ? 'ok' : 'no'}`}>
            {isCorrect ? '정답입니다!' : '아쉬워요, 틀렸어요.'}
            <span className="explain" lang="zh-CN">{q.explanation}</span>
          </div>
          <button type="button" className="btn primary wide" onClick={next}>
            {current + 1 < questions.length ? '다음 문제 →' : '결과 보기'}
          </button>
        </>
      )}
    </>
  );
}

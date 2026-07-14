import { useEffect, useMemo, useState } from 'react';
import { SUBJECTS, SubjectScore, WrittenQuestion } from '../data/types';
import { getAllWritten } from '../data/questionBank';
import { addHistory, addWrongNotes } from '../storage';

const QUESTIONS_PER_SUBJECT = 20;
const EXAM_SECONDS = 180 * 60;

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function buildExam(): WrittenQuestion[] {
  const bank = getAllWritten();
  return SUBJECTS.flatMap((subject) =>
    shuffle(bank.filter((q) => q.subject === subject)).slice(0, QUESTIONS_PER_SUBJECT)
  );
}

function formatTime(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

interface Props {
  onExit: () => void;
}

type ReviewFilter = 'all' | 'wrong';

export default function CbtExam({ onExit }: Props) {
  const [questions] = useState<WrittenQuestion[]>(buildExam);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [current, setCurrent] = useState(0);
  const [remaining, setRemaining] = useState(EXAM_SECONDS);
  const [submitted, setSubmitted] = useState(false);
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>('wrong');

  useEffect(() => {
    if (submitted) return;
    const timer = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setSubmitted(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [submitted]);

  const scores: SubjectScore[] = useMemo(() => {
    return SUBJECTS.map((subject) => {
      const subjectQuestions = questions.filter((q) => q.subject === subject);
      const correct = subjectQuestions.filter((q) => answers[q.id] === q.answer).length;
      return { subject, correct, total: subjectQuestions.length };
    });
  }, [questions, answers]);

  const avgScore = useMemo(() => {
    const total = scores.reduce((sum, s) => sum + s.total, 0);
    const correct = scores.reduce((sum, s) => sum + s.correct, 0);
    return total === 0 ? 0 : (correct / total) * 100;
  }, [scores]);

  const hasSubjectFail = scores.some((s) => (s.correct / s.total) * 100 < 40);
  const passed = avgScore >= 60 && !hasSubjectFail;

  // 제출 시 기록 저장 (오답노트 + 응시 이력)
  useEffect(() => {
    if (!submitted) return;
    const wrong = questions
      .filter((q) => answers[q.id] !== q.answer)
      .map((q) => ({
        questionId: q.id,
        myAnswer: answers[q.id] ?? -1,
        savedAt: new Date().toISOString(),
      }));
    addWrongNotes(wrong);
    addHistory({ date: new Date().toISOString(), scores, passed });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submitted]);

  if (submitted) {
    const reviewQuestions =
      reviewFilter === 'all' ? questions : questions.filter((q) => answers[q.id] !== q.answer);
    return (
      <div>
        <div className="result-summary">
          <div className={`headline ${passed ? 'pass' : 'fail'}`}>
            {passed ? '합격 🎉' : '불합격'}
          </div>
          <div className="avg">
            평균 {avgScore.toFixed(1)}점 · 합격 기준: 평균 60점 이상 &amp; 전 과목 40점 이상
          </div>
        </div>

        <table className="score-table">
          <thead>
            <tr>
              <th>과목</th>
              <th>정답</th>
              <th>점수</th>
            </tr>
          </thead>
          <tbody>
            {scores.map((s) => {
              const score = (s.correct / s.total) * 100;
              const fail = score < 40;
              return (
                <tr key={s.subject} className={fail ? 'fail-row' : ''}>
                  <td>{s.subject}</td>
                  <td>
                    {s.correct} / {s.total}
                  </td>
                  <td className="score">
                    {score.toFixed(0)}점 {fail && <span className="fail-note">과락</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="review-filters">
          <button
            className={reviewFilter === 'wrong' ? 'active' : ''}
            onClick={() => setReviewFilter('wrong')}
          >
            틀린 문제만 ({questions.filter((q) => answers[q.id] !== q.answer).length})
          </button>
          <button
            className={reviewFilter === 'all' ? 'active' : ''}
            onClick={() => setReviewFilter('all')}
          >
            전체 해설 보기
          </button>
        </div>

        {reviewQuestions.length === 0 && <div className="empty-note">틀린 문제가 없습니다! 👏</div>}
        {reviewQuestions.map((q, i) => {
          const my = answers[q.id];
          return (
            <div key={q.id} className="question-card">
              <span className="subject-label" style={{ marginTop: 0 }}>
                {q.subject}
              </span>
              <p className="q-text" style={{ marginTop: 10 }}>
                {i + 1}. {q.question}
              </p>
              <div className="choices">
                {q.choices.map((choice, ci) => {
                  let cls = 'choice';
                  if (ci === q.answer) cls += ' correct';
                  else if (ci === my) cls += ' wrong';
                  return (
                    <div key={ci} className={cls}>
                      <span className="num">{ci + 1}</span>
                      <span>{choice}</span>
                    </div>
                  );
                })}
              </div>
              <div className="explanation-box">💡 {q.explanation}</div>
            </div>
          );
        })}

        <div className="exam-nav">
          <button className="btn secondary" onClick={onExit}>
            홈으로
          </button>
        </div>
      </div>
    );
  }

  const q = questions[current];
  const answeredCount = Object.keys(answers).length;

  return (
    <div>
      <div className="exam-topbar">
        <span className={`timer ${remaining < 600 ? 'warning' : ''}`}>
          ⏱ {formatTime(remaining)}
        </span>
        <span className="progress">
          {answeredCount} / {questions.length} 답안 표시
        </span>
        <button
          className="btn danger"
          onClick={() => {
            const unanswered = questions.length - answeredCount;
            const message =
              unanswered > 0
                ? `아직 ${unanswered}문제를 풀지 않았습니다. 제출하시겠습니까?`
                : '답안을 제출하시겠습니까?';
            if (window.confirm(message)) setSubmitted(true);
          }}
        >
          답안 제출
        </button>
      </div>

      <span className="subject-label">
        {q.subject} · {(current % QUESTIONS_PER_SUBJECT) + 1}/{QUESTIONS_PER_SUBJECT}
      </span>
      <div className="question-card">
        <p className="q-text">
          {current + 1}. {q.question}
        </p>
        <div className="choices">
          {q.choices.map((choice, ci) => (
            <button
              key={ci}
              className={`choice ${answers[q.id] === ci ? 'selected' : ''}`}
              onClick={() => setAnswers((prev) => ({ ...prev, [q.id]: ci }))}
            >
              <span className="num">{ci + 1}</span>
              <span>{choice}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="exam-nav">
        <button
          className="btn secondary"
          disabled={current === 0}
          onClick={() => setCurrent((c) => c - 1)}
        >
          ← 이전
        </button>
        <button className="btn secondary" onClick={onExit}>
          시험 종료
        </button>
        <button
          className="btn"
          disabled={current === questions.length - 1}
          onClick={() => setCurrent((c) => c + 1)}
        >
          다음 →
        </button>
      </div>

      <div className="question-grid">
        {questions.map((question, i) => (
          <button
            key={question.id}
            className={`${answers[question.id] !== undefined ? 'answered' : ''} ${
              i === current ? 'current' : ''
            }`}
            onClick={() => setCurrent(i)}
          >
            {i + 1}
          </button>
        ))}
      </div>
    </div>
  );
}

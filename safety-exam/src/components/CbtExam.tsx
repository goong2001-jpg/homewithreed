import { useEffect, useMemo, useState } from 'react';
import { SUBJECTS, SubjectScore, WrittenQuestion } from '../data/types';
import { buildFullExam, buildQuickExam, QUESTIONS_PER_SUBJECT } from '../data/questionBank';
import { addHistory, addWrongNotes } from '../storage';

const FULL_EXAM_SECONDS = 180 * 60;
const QUICK_EXAM_SECONDS = 10 * 60;

export type ExamMode = 'full' | 'quick';

function formatTime(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h === 0) return `${m}:${String(s).padStart(2, '0')}`;
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

interface Props {
  onExit: () => void;
  mode?: ExamMode;
  onGoWrongNote?: () => void;
}

type ReviewFilter = 'all' | 'wrong';

export default function CbtExam({ onExit, mode = 'full', onGoWrongNote }: Props) {
  const isQuick = mode === 'quick';
  const examSeconds = isQuick ? QUICK_EXAM_SECONDS : FULL_EXAM_SECONDS;

  const [questions, setQuestions] = useState<WrittenQuestion[]>(
    isQuick ? buildQuickExam : buildFullExam
  );
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [current, setCurrent] = useState(0);
  const [remaining, setRemaining] = useState(examSeconds);
  const [submitted, setSubmitted] = useState(false);
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>(isQuick ? 'all' : 'wrong');

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

  const correctCount = useMemo(
    () => questions.filter((q) => answers[q.id] === q.answer).length,
    [questions, answers]
  );

  const avgScore = questions.length === 0 ? 0 : (correctCount / questions.length) * 100;
  const hasSubjectFail = scores.some((s) => s.total > 0 && (s.correct / s.total) * 100 < 40);
  const passed = isQuick ? avgScore >= 60 : avgScore >= 60 && !hasSubjectFail;

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
    addHistory({ date: new Date().toISOString(), scores, passed, mode });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submitted]);

  const restart = () => {
    setQuestions(isQuick ? buildQuickExam() : buildFullExam());
    setAnswers({});
    setCurrent(0);
    setRemaining(examSeconds);
    setReviewFilter(isQuick ? 'all' : 'wrong');
    setSubmitted(false);
  };

  const wrongCount = questions.length - correctCount;

  if (submitted) {
    const reviewQuestions =
      reviewFilter === 'all' ? questions : questions.filter((q) => answers[q.id] !== q.answer);

    const reviewList = (
      <>
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
      </>
    );

    if (isQuick) {
      return (
        <div>
          <div className="result-summary">
            <div className={`headline ${passed ? 'pass' : 'fail'}`}>
              {correctCount} / {questions.length} 정답
            </div>
            <div className="avg">
              {avgScore.toFixed(0)}점 ·{' '}
              {wrongCount === 0
                ? '전부 맞혔어요! 완벽합니다 🎉'
                : `틀린 ${wrongCount}문제는 오답노트에 저장했어요`}
            </div>
          </div>

          <div className="review-filters">
            <button
              className={reviewFilter === 'all' ? 'active' : ''}
              onClick={() => setReviewFilter('all')}
            >
              전체 해설 ({questions.length})
            </button>
            <button
              className={reviewFilter === 'wrong' ? 'active' : ''}
              onClick={() => setReviewFilter('wrong')}
            >
              틀린 문제만 ({wrongCount})
            </button>
          </div>

          {reviewList}

          <div className="exam-nav">
            <button className="btn" onClick={restart}>
              새 문제로 다시 풀기
            </button>
            {onGoWrongNote && wrongCount > 0 && (
              <button className="btn secondary" onClick={onGoWrongNote}>
                오답노트 보기
              </button>
            )}
            <button className="btn secondary" onClick={onExit}>
              홈으로
            </button>
          </div>
        </div>
      );
    }

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
              const score = s.total === 0 ? 0 : (s.correct / s.total) * 100;
              const fail = s.total > 0 && score < 40;
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
            틀린 문제만 ({wrongCount})
          </button>
          <button
            className={reviewFilter === 'all' ? 'active' : ''}
            onClick={() => setReviewFilter('all')}
          >
            전체 해설 보기
          </button>
        </div>

        {reviewList}

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

  // 답을 고르면: 간이시험은 다음 미응답 문제로 자동 이동, 마지막까지 풀면 바로 채점
  const pickChoice = (choiceIndex: number) => {
    const next = { ...answers, [q.id]: choiceIndex };
    setAnswers(next);
    if (!isQuick) return;

    const unansweredAfter = questions.filter((item) => next[item.id] === undefined);
    if (unansweredAfter.length === 0) {
      setSubmitted(true);
      return;
    }
    const order = questions.map((_, i) => i);
    const rotated = [...order.slice(current + 1), ...order.slice(0, current)];
    const nextIndex = rotated.find((i) => next[questions[i].id] === undefined);
    if (nextIndex !== undefined) setCurrent(nextIndex);
  };

  const timerWarning = isQuick ? remaining < 60 : remaining < 600;

  return (
    <div>
      <div className="exam-topbar">
        <span className={`timer ${timerWarning ? 'warning' : ''}`}>⏱ {formatTime(remaining)}</span>
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
          {isQuick ? '바로 채점' : '답안 제출'}
        </button>
      </div>

      {isQuick && (
        <div className="quick-hint">
          ⚡ {questions.length}문제 간이시험 · 마지막 문제까지 풀면 바로 채점되고, 틀린 문제는
          오답노트에 저장됩니다.
        </div>
      )}

      <span className="subject-label">
        {q.subject}
        {isQuick
          ? ` · ${current + 1}/${questions.length}`
          : ` · ${(current % QUESTIONS_PER_SUBJECT) + 1}/${QUESTIONS_PER_SUBJECT}`}
      </span>
      <div className="question-card">
        <p className="q-text">
          {current + 1}. {q.question}
        </p>
        <div className="choices">
          {q.choices.map((choice, ci) => (
            <button
              // 문제가 바뀌면 새 버튼으로 그린다. 같은 버튼을 재사용하면
              // 탭한 흔적(포커스)이 다음 문제의 같은 자리에 남는다.
              key={`${q.id}-${ci}`}
              className={`choice ${answers[q.id] === ci ? 'selected' : ''}`}
              onClick={(e) => {
                e.currentTarget.blur();
                pickChoice(ci);
              }}
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

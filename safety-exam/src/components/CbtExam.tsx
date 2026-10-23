import { useEffect, useMemo, useRef, useState } from 'react';
import { InProgressExam, SUBJECTS, SubjectScore, WrittenQuestion } from '../data/types';
import {
  buildFullExam,
  buildQuickExam,
  findWrittenByIds,
  isValidChoiceOrder,
  QUESTIONS_PER_SUBJECT,
  shuffledChoiceOrder,
} from '../data/questionBank';
import {
  addHistory,
  addWrongNotes,
  clearInProgressExam,
  loadInProgressExam,
  saveInProgressExam,
} from '../storage';

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

/** 마감 시각까지 남은 초 — 기기 시계 기준이라 백그라운드에 있어도 어긋나지 않는다 */
function secondsLeft(deadlineAt: number, now: number = Date.now()): number {
  return Math.max(0, Math.ceil((deadlineAt - now) / 1000));
}

/** 시험 한 회차의 상태 (문제·보기 순서·답안·마감) */
interface Session {
  questions: WrittenQuestion[];
  choiceOrders: Record<string, number[]>;
  answers: Record<string, number>;
  current: number;
  deadlineAt: number;
  /** 풀다 만 시험을 이어서 푸는 중인지 */
  resumed: boolean;
}

function toSaved(session: Session, mode: ExamMode): InProgressExam {
  return {
    mode,
    questionIds: session.questions.map((q) => q.id),
    choiceOrders: session.choiceOrders,
    answers: session.answers,
    deadlineAt: session.deadlineAt,
    current: session.current,
  };
}

/** 새 시험지 — 문제마다 보기 순서도 새로 섞는다 */
function startSession(mode: ExamMode, examSeconds: number): Session {
  const questions = mode === 'quick' ? buildQuickExam() : buildFullExam();
  const choiceOrders: Record<string, number[]> = {};
  questions.forEach((q) => {
    choiceOrders[q.id] = shuffledChoiceOrder(q);
  });
  return {
    questions,
    choiceOrders,
    answers: {},
    current: 0,
    deadlineAt: Date.now() + examSeconds * 1000,
    resumed: false,
  };
}

/** 풀다 만 시험이 있으면 그대로 되살린다. 없거나 못 쓰면 null */
function resumeSession(mode: ExamMode): Session | null {
  const saved = loadInProgressExam();
  if (!saved || saved.mode !== mode) return null;
  const questions = findWrittenByIds(saved.questionIds);
  if (!questions) {
    clearInProgressExam(); // 문제은행이 바뀌어 되살릴 수 없다
    return null;
  }
  const choiceOrders: Record<string, number[]> = {};
  questions.forEach((q) => {
    const order = saved.choiceOrders[q.id];
    choiceOrders[q.id] = isValidChoiceOrder(q, order) ? order : shuffledChoiceOrder(q);
  });
  const answers: Record<string, number> = {};
  questions.forEach((q) => {
    const a = saved.answers[q.id];
    if (typeof a === 'number' && a >= 0 && a < q.choices.length) answers[q.id] = a;
  });
  return {
    questions,
    choiceOrders,
    answers,
    current: Math.min(Math.max(0, Math.floor(saved.current)), questions.length - 1),
    deadlineAt: saved.deadlineAt,
    resumed: true,
  };
}

/** 과목별 점수와 합격 여부 (채점 기준은 그대로) */
function evaluate(questions: WrittenQuestion[], answers: Record<string, number>, isQuick: boolean) {
  const scores: SubjectScore[] = SUBJECTS.map((subject) => {
    const subjectQuestions = questions.filter((q) => q.subject === subject);
    const correct = subjectQuestions.filter((q) => answers[q.id] === q.answer).length;
    return { subject, correct, total: subjectQuestions.length };
  });
  const correctCount = questions.filter((q) => answers[q.id] === q.answer).length;
  const avgScore = questions.length === 0 ? 0 : (correctCount / questions.length) * 100;
  const hasSubjectFail = scores.some((s) => s.total > 0 && (s.correct / s.total) * 100 < 40);
  const passed = isQuick ? avgScore >= 60 : avgScore >= 60 && !hasSubjectFail;
  return { scores, correctCount, avgScore, passed };
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

  // 풀다 만 시험이 있으면 이어서, 없으면 새로 시작한다 (처음 그릴 때 한 번만)
  const [session, setSession] = useState<Session>(
    () => resumeSession(mode) ?? startSession(mode, examSeconds)
  );
  const { questions, choiceOrders, answers, current, deadlineAt } = session;
  const [remaining, setRemaining] = useState(() => secondsLeft(deadlineAt));
  const [submitted, setSubmitted] = useState(false);
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>(isQuick ? 'all' : 'wrong');

  const { scores, correctCount, avgScore, passed } = useMemo(
    () => evaluate(questions, answers, isQuick),
    [questions, answers, isQuick]
  );

  /** 답안 제출 — 기록 저장(오답노트 + 응시 이력)과 진행 중 시험 삭제를 한 번에 */
  const submit = (finalAnswers: Record<string, number> = answers) => {
    if (submitted) return;
    const result = evaluate(questions, finalAnswers, isQuick);
    const wrong = questions
      .filter((q) => finalAnswers[q.id] !== q.answer)
      .map((q) => ({
        questionId: q.id,
        myAnswer: finalAnswers[q.id] ?? -1,
        savedAt: new Date().toISOString(),
      }));
    addWrongNotes(wrong);
    addHistory({ date: new Date().toISOString(), scores: result.scores, passed: result.passed, mode });
    clearInProgressExam();
    if (finalAnswers !== answers) setSession((prev) => ({ ...prev, answers: finalAnswers }));
    setSubmitted(true);
  };
  // 타이머 콜백에서 항상 최신 submit 을 부르도록
  const submitRef = useRef(submit);
  submitRef.current = submit;

  // 남은 시간은 마감 시각에서 계산한다 — 백그라운드로 갔다 와도 정확하다
  useEffect(() => {
    if (submitted) return;
    const tick = () => {
      const left = secondsLeft(deadlineAt);
      setRemaining(left);
      if (left <= 0) submitRef.current();
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    document.addEventListener('visibilitychange', tick);
    window.addEventListener('focus', tick);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', tick);
      window.removeEventListener('focus', tick);
    };
  }, [submitted, deadlineAt]);

  // 답을 고르거나 문제를 옮길 때마다 저장해 두어, 나갔다 와도 이어서 풀 수 있다
  useEffect(() => {
    if (!submitted) saveInProgressExam(toSaved(session, mode));
  }, [session, mode, submitted]);

  const updateSession = (patch: Partial<Session>) => setSession((prev) => ({ ...prev, ...patch }));
  const setCurrent = (index: number) => updateSession({ current: index });

  const restart = () => {
    const s = startSession(mode, examSeconds);
    setSession(s);
    setRemaining(secondsLeft(s.deadlineAt));
    setReviewFilter(isQuick ? 'all' : 'wrong');
    setSubmitted(false);
  };

  /** 아직 다 풀지 않은 시험을 떠날 때 — 답안은 저장돼 있어 다음에 이어서 풀 수 있다 */
  const confirmExit = () => {
    if (
      window.confirm(
        '시험을 종료할까요?\n지금까지 푼 답안과 남은 시간은 저장되어 다음에 이어서 풀 수 있습니다.'
      )
    ) {
      onExit();
    }
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
                {choiceOrders[q.id].map((orig, ci) => {
                  let cls = 'choice';
                  if (orig === q.answer) cls += ' correct';
                  else if (orig === my) cls += ' wrong';
                  return (
                    <div key={ci} className={cls}>
                      <span className="num">{ci + 1}</span>
                      <span>{q.choices[orig]}</span>
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

  // 답을 고르면(원래 보기 인덱스로 기록): 간이시험은 다음 미응답 문제로 자동 이동,
  // 마지막까지 풀면 바로 채점. 고를 때마다 저장해 두어 이어서 풀 수 있다.
  const pickChoice = (choiceIndex: number) => {
    const next = { ...answers, [q.id]: choiceIndex };
    if (!isQuick) {
      updateSession({ answers: next });
      return;
    }

    const unansweredAfter = questions.filter((item) => next[item.id] === undefined);
    if (unansweredAfter.length === 0) {
      submit(next);
      return;
    }
    const order = questions.map((_, i) => i);
    const rotated = [...order.slice(current + 1), ...order.slice(0, current)];
    const nextIndex = rotated.find((i) => next[questions[i].id] === undefined);
    updateSession({ answers: next, current: nextIndex ?? current });
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
            if (window.confirm(message)) submit();
          }}
        >
          {isQuick ? '바로 채점' : '답안 제출'}
        </button>
      </div>

      {session.resumed && (
        <div className="quick-hint">⏯ 풀다 만 시험을 이어서 풉니다. 답안과 남은 시간이 그대로예요.</div>
      )}

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
          {/* 보기는 문제마다 섞인 순서로 보여주되, 답은 원래 보기 인덱스로 기록한다 */}
          {choiceOrders[q.id].map((orig, ci) => (
            <button
              // 문제가 바뀌면 새 버튼으로 그린다. 같은 버튼을 재사용하면
              // 탭한 흔적(포커스)이 다음 문제의 같은 자리에 남는다.
              key={`${q.id}-${ci}`}
              className={`choice ${answers[q.id] === orig ? 'selected' : ''}`}
              onClick={(e) => {
                e.currentTarget.blur();
                pickChoice(orig);
              }}
            >
              <span className="num">{ci + 1}</span>
              <span>{q.choices[orig]}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="exam-nav">
        <button
          className="btn secondary"
          disabled={current === 0}
          onClick={() => setCurrent(current - 1)}
        >
          ← 이전
        </button>
        <button className="btn secondary" onClick={confirmExit}>
          시험 종료
        </button>
        <button
          className="btn"
          disabled={current === questions.length - 1}
          onClick={() => setCurrent(current + 1)}
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

import { useState } from 'react';
import { WrongNoteEntry } from '../data/types';
import { getQuestionById } from '../data/writtenQuestions';
import { loadWrongNotes, removeWrongNote } from '../storage';

interface Props {
  onExit: () => void;
}

type Mode = 'list' | 'retry';

export default function WrongNote({ onExit }: Props) {
  const [notes, setNotes] = useState<WrongNoteEntry[]>(loadWrongNotes);
  const [mode, setMode] = useState<Mode>('list');
  const [current, setCurrent] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);

  const refresh = () => setNotes(loadWrongNotes());

  const validNotes = notes.filter((n) => getQuestionById(n.questionId));

  if (validNotes.length === 0) {
    return (
      <div>
        <div className="empty-note" style={{ marginTop: 20 }}>
          저장된 오답이 없습니다.
          <br />
          CBT 모의고사에서 틀린 문제가 자동으로 이곳에 저장됩니다.
        </div>
        <div className="back-row">
          <button className="btn secondary" onClick={onExit}>
            홈으로
          </button>
        </div>
      </div>
    );
  }

  if (mode === 'list') {
    return (
      <div>
        <div className="list-toolbar">
          <span className="section-title" style={{ margin: 0 }}>
            오답노트 · {validNotes.length}문제
          </span>
          <button
            className="btn"
            onClick={() => {
              setCurrent(0);
              setPicked(null);
              setMode('retry');
            }}
          >
            오답 다시 풀기
          </button>
        </div>
        {validNotes.map((note) => {
          const q = getQuestionById(note.questionId)!;
          return (
            <div key={note.questionId} className="question-card">
              <span className="subject-label" style={{ marginTop: 0 }}>
                {q.subject}
              </span>
              <p className="q-text" style={{ marginTop: 10 }}>
                {q.question}
              </p>
              <div className="choices">
                {q.choices.map((choice, ci) => {
                  let cls = 'choice';
                  if (ci === q.answer) cls += ' correct';
                  else if (ci === note.myAnswer) cls += ' wrong';
                  return (
                    <div key={ci} className={cls}>
                      <span className="num">{ci + 1}</span>
                      <span>{choice}</span>
                    </div>
                  );
                })}
              </div>
              <div className="explanation-box">💡 {q.explanation}</div>
              <div className="exam-nav">
                <button
                  className="btn secondary"
                  onClick={() => {
                    removeWrongNote(note.questionId);
                    refresh();
                  }}
                >
                  이 문제 삭제
                </button>
              </div>
            </div>
          );
        })}
        <div className="back-row">
          <button className="btn secondary" onClick={onExit}>
            홈으로
          </button>
        </div>
      </div>
    );
  }

  // 다시 풀기 모드
  const note = validNotes[Math.min(current, validNotes.length - 1)];
  const q = getQuestionById(note.questionId)!;
  const answered = picked !== null;
  const correct = picked === q.answer;

  const goNext = () => {
    setPicked(null);
    if (current >= validNotes.length - 1) {
      setMode('list');
      setCurrent(0);
    } else {
      setCurrent((c) => c + 1);
    }
  };

  return (
    <div>
      <div className="list-toolbar">
        <span className="section-title" style={{ margin: 0 }}>
          오답 다시 풀기 · {current + 1} / {validNotes.length}
        </span>
        <button className="btn secondary" onClick={() => setMode('list')}>
          목록으로
        </button>
      </div>

      <span className="subject-label">{q.subject}</span>
      <div className="question-card">
        <p className="q-text">{q.question}</p>
        <div className="choices">
          {q.choices.map((choice, ci) => {
            let cls = 'choice';
            if (answered) {
              if (ci === q.answer) cls += ' correct';
              else if (ci === picked) cls += ' wrong';
            } else if (ci === picked) {
              cls += ' selected';
            }
            return (
              <button key={ci} className={cls} disabled={answered} onClick={() => setPicked(ci)}>
                <span className="num">{ci + 1}</span>
                <span>{choice}</span>
              </button>
            );
          })}
        </div>
        {answered && (
          <>
            <div className="explanation-box">
              {correct ? '⭕ 정답입니다!' : '❌ 오답입니다.'} 💡 {q.explanation}
            </div>
            <div className="exam-nav">
              {correct ? (
                <>
                  <button
                    className="btn"
                    onClick={() => {
                      removeWrongNote(note.questionId);
                      refresh();
                      setPicked(null);
                      if (current >= validNotes.length - 1) {
                        setMode('list');
                        setCurrent(0);
                      }
                    }}
                  >
                    오답노트에서 제거
                  </button>
                  <button className="btn secondary" onClick={goNext}>
                    유지하고 다음 →
                  </button>
                </>
              ) : (
                <button className="btn" onClick={goNext}>
                  다음 →
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

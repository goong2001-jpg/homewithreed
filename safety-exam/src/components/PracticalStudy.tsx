import { useMemo, useState } from 'react';
import { getAllPractical } from '../data/questionBank';
import { loadPracticalProgress, PracticalMark, savePracticalProgress } from '../storage';

interface Props {
  onExit: () => void;
}

const ALL = '전체';

export default function PracticalStudy({ onExit }: Props) {
  const allQuestions = useMemo(() => getAllPractical(), []);
  const categories = useMemo(
    () => [ALL, ...Array.from(new Set(allQuestions.map((q) => q.category)))],
    [allQuestions]
  );
  const [category, setCategory] = useState(ALL);
  const [onlyUnknown, setOnlyUnknown] = useState(false);
  const [progress, setProgress] = useState<Record<string, PracticalMark>>(loadPracticalProgress);
  const [index, setIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);

  const cards = useMemo(() => {
    let list = allQuestions;
    if (category !== ALL) list = list.filter((q) => q.category === category);
    if (onlyUnknown) list = list.filter((q) => progress[q.id] !== 'known');
    return list;
    // progress를 의존성에서 제외: 채점 직후 카드가 즉시 빠져나가 순서가 흔들리는 것 방지
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allQuestions, category, onlyUnknown]);

  const knownCount = allQuestions.filter((q) => progress[q.id] === 'known').length;
  const unknownCount = allQuestions.filter((q) => progress[q.id] === 'unknown').length;

  const mark = (value: PracticalMark) => {
    const card = cards[index];
    const next = { ...progress, [card.id]: value };
    setProgress(next);
    savePracticalProgress(next);
    setShowAnswer(false);
    setIndex((i) => (i + 1 < cards.length ? i + 1 : 0));
  };

  const selectFilter = (nextCategory: string, nextOnlyUnknown: boolean) => {
    setCategory(nextCategory);
    setOnlyUnknown(nextOnlyUnknown);
    setIndex(0);
    setShowAnswer(false);
  };

  if (cards.length === 0) {
    return (
      <div>
        <div className="chip-row" style={{ marginTop: 12 }}>
          {categories.map((c) => (
            <button
              key={c}
              className={`chip ${category === c ? 'active' : ''}`}
              onClick={() => selectFilter(c, onlyUnknown)}
            >
              {c}
            </button>
          ))}
          <button
            className={`chip ${onlyUnknown ? 'active' : ''}`}
            onClick={() => selectFilter(category, !onlyUnknown)}
          >
            모르는 문제만
          </button>
        </div>
        <div className="empty-note" style={{ marginTop: 20 }}>
          조건에 해당하는 문제가 없습니다. 모든 문제를 알고 있어요! 👏
        </div>
        <div className="back-row">
          <button className="btn secondary" onClick={onExit}>
            홈으로
          </button>
        </div>
      </div>
    );
  }

  const card = cards[Math.min(index, cards.length - 1)];

  return (
    <div>
      <div className="chip-row" style={{ marginTop: 12 }}>
        {categories.map((c) => (
          <button
            key={c}
            className={`chip ${category === c ? 'active' : ''}`}
            onClick={() => selectFilter(c, onlyUnknown)}
          >
            {c}
          </button>
        ))}
        <button
          className={`chip ${onlyUnknown ? 'active' : ''}`}
          onClick={() => selectFilter(category, !onlyUnknown)}
        >
          모르는 문제만
        </button>
      </div>

      <div className="progress-bar">
        <div className="fill" style={{ width: `${((index + 1) / cards.length) * 100}%` }} />
      </div>
      <div className="stat-row">
        <span>
          {index + 1} / {cards.length} 문제
        </span>
        <span className="known">아는 문제 {knownCount}</span>
        <span className="unknown">모르는 문제 {unknownCount}</span>
      </div>

      <div className="flash-card">
        <span className="category">{card.category}</span>
        <p className="q-text">{card.question}</p>
        {showAnswer ? (
          <>
            <div className="answer">
              ✅ {card.answer}
              {card.explanation && (
                <>
                  <br />
                  <br />💡 {card.explanation}
                </>
              )}
            </div>
            <div className="flash-actions">
              <button className="know" onClick={() => mark('known')}>
                ⭕ 맞혔어요
              </button>
              <button className="dontknow" onClick={() => mark('unknown')}>
                ❌ 틀렸어요
              </button>
            </div>
          </>
        ) : (
          <div className="flash-actions">
            <button className="btn" onClick={() => setShowAnswer(true)}>
              정답 보기
            </button>
          </div>
        )}
      </div>

      <div className="exam-nav">
        <button
          className="btn secondary"
          disabled={index === 0}
          onClick={() => {
            setIndex((i) => i - 1);
            setShowAnswer(false);
          }}
        >
          ← 이전
        </button>
        <button className="btn secondary" onClick={onExit}>
          홈으로
        </button>
        <button
          className="btn secondary"
          disabled={index >= cards.length - 1}
          onClick={() => {
            setIndex((i) => i + 1);
            setShowAnswer(false);
          }}
        >
          건너뛰기 →
        </button>
      </div>
    </div>
  );
}

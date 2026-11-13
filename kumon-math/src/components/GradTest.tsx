import React, { useEffect, useState } from 'react';
import { WORD_BANK, Word } from '../words/wordBank';
import { wordsOfSound } from '../words/dailySet';
import { UNITS } from '../words/units';
import { pickRandom } from '../words/pool';
import { speakWord } from '../alphabet/speech';
import { playClick, playCorrect, playStreak, playWrong } from '../utils/sounds';

/** 졸업 시험 문제 수와 통과 점수 */
export const GRAD_QUESTIONS = 5;
export const GRAD_PASS = 4;
/** 통과하면 받는 별 */
export const GRAD_STARS = 10;

interface Q { word: Word; choices: Word[] }

/** 그 단계 두 소리의 단어로 문제를 만든다 (보기는 그림이 겹치지 않는 다른 단어 셋) */
export function gradQuestions(unit: number): Q[] {
  const [a, b] = UNITS[unit % UNITS.length];
  const own = [...wordsOfSound(a), ...wordsOfSound(b)].filter((w, i, all) => all.findIndex(x => x.en === w.en) === i);
  return pickRandom(own, GRAD_QUESTIONS).map(word => {
    const others: Word[] = [];
    for (const w of pickRandom(WORD_BANK, WORD_BANK.length)) {
      if (others.length >= 3) break;
      if (w.en !== word.en && w.emoji !== word.emoji && !others.some(o => o.emoji === w.emoji)) others.push(w);
    }
    return { word, choices: pickRandom([word, ...others], 4) };
  });
}

/** 상장 한 장 */
export function Certificate({ unit, date, name }: { unit: number; date: string; name: string }) {
  const [a, b] = UNITS[unit % UNITS.length];
  return (
    <div style={{
      background: 'linear-gradient(160deg,#fffbe6,#fff1c9)', borderRadius: 18, padding: '16px 12px',
      border: '4px double #e0b040', textAlign: 'center',
    }}>
      <div style={{ fontSize: 34 }}>🎓</div>
      <div style={{ fontSize: 19, fontWeight: 900, color: '#8a5a00' }}>{unit + 1}단계 졸업장</div>
      <div style={{ fontSize: 26, fontWeight: 900, color: '#5b4b8a', margin: '6px 0' }}>
        {a.label} <span style={{ color: '#e67e22' }}>{a.ko}</span> · {b.label} <span style={{ color: '#e67e22' }}>{b.ko}</span>
      </div>
      <div style={{ fontSize: 14, fontWeight: 800, color: '#6b5b3a', lineHeight: 1.5 }}>
        {name ? `${name}은(는) ` : ''}이 소리의 단어를<br />잘 듣고 잘 골랐어요. 참 잘했어요! 👏
      </div>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#a08a5a', marginTop: 6 }}>{date} · 요정 선생님 🧚</div>
    </div>
  );
}

/**
 * 단계 졸업 시험 — 한 소리 단계를 다 배우면 볼 수 있다.
 * 요정이 말하는 단어를 듣고 그림을 고른다. 5문제 중 4문제를 맞히면 졸업장을 받는다.
 * 떨어져도 언제든 다시 볼 수 있다.
 */
export default function GradTest({ unit, name, today, onPass, onClose }: {
  unit: number; name: string; today: string;
  /** 통과했을 때 한 번 부른다 */
  onPass: () => void;
  onClose: () => void;
}) {
  const [qs, setQs] = useState<Q[]>(() => gradQuestions(unit));
  const [idx, setIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const q = qs[idx];
  const done = idx >= qs.length;
  const passed = done && score >= Math.min(GRAD_PASS, qs.length);

  useEffect(() => {
    if (q) { const t = setTimeout(() => speakWord(q.word.en), 350); return () => clearTimeout(t); }
  }, [q]);
  useEffect(() => { if (passed) { playStreak(); onPass(); } }, [passed]); // eslint-disable-line react-hooks/exhaustive-deps

  const choose = (w: Word) => {
    if (picked) return;
    setPicked(w.en);
    const right = w.en === q.word.en;
    if (right) { playCorrect(); setScore(s => s + 1); } else playWrong();
    setTimeout(() => { setPicked(null); setIdx(i => i + 1); }, right ? 900 : 1800);
  };
  const retry = () => { playClick(); setQs(gradQuestions(unit)); setIdx(0); setScore(0); setPicked(null); };

  const [a, b] = UNITS[unit % UNITS.length];

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 240, padding: 16,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Nunito','Noto Sans KR',sans-serif",
    }}>
      <div style={{
        background: 'white', borderRadius: 24, padding: '20px 16px', maxWidth: 360, width: '100%',
        textAlign: 'center', boxShadow: '0 25px 80px rgba(0,0,0,0.35)', maxHeight: '92vh', overflowY: 'auto',
      }}>
        {!done && (
          <>
            <div style={{ fontSize: 17, fontWeight: 900, color: '#44405e' }}>
              🎓 {unit + 1}단계 졸업 시험 ({idx + 1} / {qs.length})
            </div>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#8a7a9a', margin: '2px 0 10px' }}>
              {a.label} {a.ko} · {b.label} {b.ko} — {GRAD_PASS}개 맞히면 졸업!
            </div>
            <button onClick={() => { speakWord(q.word.en); playClick(); }} style={{
              width: '100%', padding: '14px 0', borderRadius: 16, border: 'none', marginBottom: 6,
              background: 'linear-gradient(135deg,#667eea,#764ba2)', color: 'white',
              fontSize: 18, fontWeight: 900, cursor: 'pointer', fontFamily: 'inherit',
            }}>🔊 다시 듣기</button>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#e67e22', marginBottom: 10 }}>
              잘 듣고 알맞은 그림을 골라봐! 👂
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {q.choices.map(c => {
                const isAnswer = c.en === q.word.en;
                const showRight = picked && isAnswer;
                const showWrong = picked === c.en && !isAnswer;
                return (
                  <button key={c.en} onClick={() => choose(c)} style={{
                    padding: '10px 0', borderRadius: 18, fontSize: 54, lineHeight: 1.2, fontFamily: 'inherit',
                    border: `3px solid ${showRight ? '#27ae60' : showWrong ? '#e74c3c' : '#e6e1f5'}`,
                    background: showRight ? '#eafaf1' : showWrong ? '#fdecea' : 'white',
                    cursor: picked ? 'default' : 'pointer',
                  }}>
                    {c.emoji}
                    {showRight && <div style={{ fontSize: 15, fontWeight: 900, color: '#27ae60' }}>{c.en}</div>}
                  </button>
                );
              })}
            </div>
            <button onClick={() => { playClick(); onClose(); }} style={{
              marginTop: 12, border: 'none', background: 'none', color: '#999', fontSize: 13, fontWeight: 800,
              cursor: 'pointer', fontFamily: 'inherit',
            }}>나중에 볼래요</button>
          </>
        )}

        {done && passed && (
          <>
            <div style={{ fontSize: 20, fontWeight: 900, color: '#27ae60', marginBottom: 10 }}>
              🎉 졸업을 축하해! ({score} / {qs.length})
            </div>
            <Certificate unit={unit} date={today} name={name} />
            <div style={{ fontSize: 15, fontWeight: 800, color: '#f39c12', margin: '10px 0' }}>+{GRAD_STARS} ⭐</div>
            <button onClick={() => { playClick(); onClose(); }} style={{
              width: '100%', padding: '13px 0', borderRadius: 14, border: 'none',
              background: 'linear-gradient(135deg,#667eea,#764ba2)', color: 'white',
              fontSize: 16, fontWeight: 900, cursor: 'pointer', fontFamily: 'inherit',
            }}>좋아! 👍</button>
          </>
        )}

        {done && !passed && (
          <>
            <div style={{ fontSize: 50 }}>💪</div>
            <div style={{ fontSize: 19, fontWeight: 900, color: '#e67e22', marginBottom: 6 }}>
              아쉬워! {score}개 맞혔어
            </div>
            <div style={{ fontSize: 14, color: '#888', marginBottom: 14 }}>
              {GRAD_PASS}개를 맞히면 졸업이야. 한 번 더 해 볼까?
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => { playClick(); onClose(); }} style={{
                flex: 1, padding: '12px 0', borderRadius: 14, border: '2px solid #ccc', background: 'white',
                color: '#777', fontSize: 15, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit',
              }}>나중에</button>
              <button onClick={retry} style={{
                flex: 1, padding: '12px 0', borderRadius: 14, border: 'none',
                background: 'linear-gradient(135deg,#667eea,#764ba2)', color: 'white',
                fontSize: 15, fontWeight: 900, cursor: 'pointer', fontFamily: 'inherit',
              }}>다시 도전! 🔁</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

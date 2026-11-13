import React, { useEffect, useState } from 'react';
import { Word } from '../../words/wordBank';
import { pickRandom } from '../../words/pool';
import { speakWord } from '../../alphabet/speech';
import { playClick, playCorrect, playStreak, playWrong } from '../../utils/sounds';
import { bigBtn, card, Finish, GameProps, lineBtn } from './common';

/**
 * 특별 훈련 — 자주 틀리는 단어만 모아서 연습한다.
 * 단어마다 먼저 카드를 보고 외운 다음, 소리를 듣고 그림을 고른다.
 * 틀린 단어는 뒤로 가서 맞힐 때까지 다시 나온다.
 */
export const TRAIN_MAX = 6;

function choicesFor(word: Word, others: Word[]): Word[] {
  const picked: Word[] = [];
  for (const w of pickRandom(others, others.length)) {
    if (picked.length >= 3) break;
    if (w.en !== word.en && w.emoji !== word.emoji && !picked.some(p => p.emoji === w.emoji)) picked.push(w);
  }
  return pickRandom([word, ...picked], picked.length + 1);
}

export default function TrainGame({ pool, others, onStars, onBack }: GameProps & {
  /** 보기에 섞을 다른 단어들 */
  others: Word[];
}) {
  const [queue, setQueue] = useState<Word[]>(() => pool.slice(0, TRAIN_MAX));
  const [step, setStep] = useState<'study' | 'quiz'>('study');
  const [choices, setChoices] = useState<Word[]>([]);
  const [picked, setPicked] = useState<string | null>(null);
  const [finished, setFinished] = useState(false);
  const word = queue[0];
  const total = Math.min(pool.length, TRAIN_MAX);

  useEffect(() => {
    if (word && !finished) { const t = setTimeout(() => speakWord(word.en), 300); return () => clearTimeout(t); }
  }, [word, step, finished]);
  useEffect(() => { if (finished) { playStreak(); onStars(3); } }, [finished, onStars]);

  if (!pool.length) {
    return (
      <div style={card}>
        <div style={{ fontSize: 50 }}>🌟</div>
        <div style={{ fontSize: 18, fontWeight: 900, color: '#27ae60', margin: '6px 0' }}>틀린 단어가 없어요!</div>
        <div style={{ fontSize: 14, color: '#888', marginBottom: 14 }}>문제에서 틀린 단어가 생기면 여기서 연습할 수 있어요.</div>
        <button onClick={onBack} style={lineBtn()}>돌아가기</button>
      </div>
    );
  }
  if (finished) {
    return <Finish emoji="🎯" title="특별 훈련 끝! 이제 잘 알겠지?" stars={3}
      onAgain={() => { setQueue(pool.slice(0, TRAIN_MAX)); setStep('study'); setFinished(false); }} onBack={onBack} />;
  }

  const startQuiz = () => { playClick(); setChoices(choicesFor(word, others)); setPicked(null); setStep('quiz'); };
  const choose = (w: Word) => {
    if (picked) return;
    setPicked(w.en);
    const right = w.en === word.en;
    if (right) playCorrect(); else playWrong();
    setTimeout(() => {
      setPicked(null);
      setStep('study');
      // 맞히면 빼고, 틀리면 맨 뒤로 보낸다
      const rest = queue.slice(1);
      const next = right ? rest : [...rest, word];
      if (!next.length) setFinished(true); else setQueue(next);
    }, right ? 900 : 1800);
  };

  return (
    <div style={card}>
      <div style={{ fontSize: 17, fontWeight: 900, color: '#44405e' }}>🎯 특별 훈련</div>
      <div style={{ fontSize: 13, color: '#888', margin: '4px 0 10px' }}>
        남은 단어 {queue.length} / {total}
      </div>

      {step === 'study' ? (
        <>
          <div style={{ background: '#fff8e7', borderRadius: 18, padding: '12px 10px', marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#a35f12' }}>잘 보고, 잘 듣고, 따라 말해 봐!</div>
            <div style={{ fontSize: 90, lineHeight: 1.15 }}>{word.emoji}</div>
            <div style={{ fontSize: 32, fontWeight: 900, color: '#5b4b8a' }}>{word.en}</div>
            <div style={{ fontSize: 16, color: '#888', fontWeight: 700 }}>{word.ko}</div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => { speakWord(word.en); playClick(); }} style={{ ...lineBtn(), flex: '0 0 70px', fontSize: 20 }}>🔊</button>
            <button onClick={startQuiz} style={{ ...bigBtn(), flex: 1 }}>외웠어! 문제 풀기 →</button>
          </div>
        </>
      ) : (
        <>
          <button onClick={() => { speakWord(word.en); playClick(); }} style={{ ...bigBtn(), fontSize: 18, marginBottom: 6 }}>
            🔊 다시 듣기
          </button>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#e67e22', marginBottom: 10 }}>방금 본 단어의 그림을 골라봐! 👂</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {choices.map(c => {
              const isAnswer = c.en === word.en;
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
        </>
      )}
    </div>
  );
}

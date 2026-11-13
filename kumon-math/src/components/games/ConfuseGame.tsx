import React, { useEffect, useState } from 'react';
import { Word } from '../../words/wordBank';
import { firstSoundKo, firstSoundPhrase } from '../../words/phonics';
import { speakPhonics, speakWord } from '../../alphabet/speech';
import { playClick, playCorrect, playStreak, playWrong } from '../../utils/sounds';
import { bigBtn, card, Finish, lineBtn } from './common';

/** 한 짝마다 묻는 횟수 */
const TRIALS = 4;

export interface WordPair { a: Word; b: Word }

/**
 * 헷갈리는 짝 — 문제에서 서로 바꿔 고른 적이 있는 두 단어를 나란히 놓고 비교한다.
 * 먼저 두 단어의 소리와 첫소리를 들어 보고, 그다음 소리만 듣고 둘 중 하나를 고른다.
 */
export default function ConfuseGame({ pairs, onStars, onBack }: {
  pairs: WordPair[]; onStars: (n: number) => void; onBack: () => void;
}) {
  const [pi, setPi] = useState(0);
  const [step, setStep] = useState<'study' | 'quiz'>('study');
  const [trial, setTrial] = useState(0);
  const [target, setTarget] = useState<Word | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const pair = pairs[pi];
  const done = pi >= pairs.length;

  useEffect(() => { if (done && pairs.length) { playStreak(); onStars(2); } }, [done, pairs.length, onStars]);
  useEffect(() => {
    if (step === 'quiz' && target) { const t = setTimeout(() => speakWord(target.en), 350); return () => clearTimeout(t); }
  }, [step, target, trial]);

  if (!pairs.length) {
    return (
      <div style={card}>
        <div style={{ fontSize: 50 }}>🌟</div>
        <div style={{ fontSize: 18, fontWeight: 900, color: '#27ae60', margin: '6px 0' }}>헷갈린 단어가 없어요!</div>
        <div style={{ fontSize: 14, color: '#888', marginBottom: 14 }}>
          문제에서 다른 단어를 잘못 고르면, 그 두 단어를 여기서 비교해 볼 수 있어요.
        </div>
        <button onClick={onBack} style={lineBtn()}>돌아가기</button>
      </div>
    );
  }
  if (done) {
    return <Finish emoji="🔀" title="이제 안 헷갈려!" sub={`${score} / ${pairs.length * TRIALS} 맞혔어요`} stars={2}
      onAgain={() => { setPi(0); setStep('study'); setTrial(0); setScore(0); }} onBack={onBack} />;
  }

  const pickTarget = () => (Math.random() < 0.5 ? pair.a : pair.b);
  const startQuiz = () => { playClick(); setTrial(0); setTarget(pickTarget()); setPicked(null); setStep('quiz'); };
  const choose = (w: Word) => {
    if (picked || !target) return;
    setPicked(w.en);
    const right = w.en === target.en;
    if (right) { playCorrect(); setScore(s => s + 1); } else playWrong();
    setTimeout(() => {
      setPicked(null);
      if (trial + 1 >= TRIALS) { setStep('study'); setPi(i => i + 1); }
      else { setTrial(t => t + 1); setTarget(pickTarget()); }
    }, right ? 800 : 1700);
  };

  const wordCard = (w: Word, quiz: boolean) => {
    const isAnswer = quiz && target?.en === w.en;
    const showRight = quiz && picked && isAnswer;
    const showWrong = quiz && picked === w.en && !isAnswer;
    return (
      <button key={w.en}
        onClick={() => (quiz ? choose(w) : (speakWord(w.en), playClick()))}
        style={{
          flex: 1, padding: '10px 4px', borderRadius: 18, fontFamily: 'inherit', cursor: 'pointer',
          border: `3px solid ${showRight ? '#27ae60' : showWrong ? '#e74c3c' : '#e6e1f5'}`,
          background: showRight ? '#eafaf1' : showWrong ? '#fdecea' : 'white',
        }}>
        <div style={{ fontSize: 56, lineHeight: 1.15 }}>{w.emoji}</div>
        <div style={{ fontSize: 22, fontWeight: 900, color: '#5b4b8a' }}>
          <span style={{ color: '#e67e22' }}>{w.en[0]}</span>{w.en.slice(1)}
        </div>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#888' }}>{w.ko}</div>
      </button>
    );
  };

  return (
    <div style={card}>
      <div style={{ fontSize: 17, fontWeight: 900, color: '#44405e' }}>🔀 헷갈리는 짝 ({pi + 1} / {pairs.length})</div>

      {step === 'study' ? (
        <>
          <div style={{ fontSize: 13, color: '#888', margin: '4px 0 10px' }}>두 단어를 눌러서 소리를 비교해 봐!</div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 8 }}>{[pair.a, pair.b].map(w => wordCard(w, false))}</div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
            {[pair.a, pair.b].map(w => (
              <button key={w.en} onClick={() => { speakPhonics(firstSoundPhrase(w.en)); playClick(); }}
                style={{ ...lineBtn('#e67e22'), fontSize: 14 }}>
                🔉 첫소리 {firstSoundKo(w.en)}
              </button>
            ))}
          </div>
          <button onClick={startQuiz} style={bigBtn()}>들어봤어! 문제 풀기 →</button>
        </>
      ) : (
        <>
          <div style={{ fontSize: 13, color: '#888', margin: '4px 0 8px' }}>문제 {trial + 1} / {TRIALS}</div>
          <button onClick={() => { if (target) speakWord(target.en); playClick(); }} style={{ ...bigBtn(), fontSize: 18, marginBottom: 6 }}>
            🔊 다시 듣기
          </button>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#e67e22', marginBottom: 10 }}>어느 쪽일까? 잘 듣고 골라봐! 👂</div>
          <div style={{ display: 'flex', gap: 10 }}>{[pair.a, pair.b].map(w => wordCard(w, true))}</div>
        </>
      )}
    </div>
  );
}

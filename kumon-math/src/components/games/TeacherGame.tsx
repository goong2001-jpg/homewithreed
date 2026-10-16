import React, { useEffect, useState } from 'react';
import { Word } from '../../words/wordBank';
import { pickRandom } from '../../words/pool';
import { speakWord } from '../../alphabet/speech';
import { playClick, playCorrect, playStreak } from '../../utils/sounds';
import { card, Finish, GameProps, lineBtn } from './common';

/**
 * 선생님 놀이 — 아이가 선생님이 되어 엄마·아빠에게 문제를 낸다.
 * 아이 화면에는 정답이 보이고, 부모님이 틀리면 아이가 정답을 알려 준다.
 * 가르치면서 가장 잘 외워진다.
 */
const ROUND = 5;

export default function TeacherGame({ pool, onStars, onBack }: GameProps) {
  const [words, setWords] = useState<Word[]>(() => pickRandom(pool, ROUND));
  const [idx, setIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [teaching, setTeaching] = useState(false);
  const word = words[idx];
  const done = idx >= words.length;

  useEffect(() => { if (done) { playStreak(); onStars(2); } }, [done, onStars]);

  const next = () => { setTeaching(false); setIdx(i => i + 1); };
  const again = () => { setWords(pickRandom(pool, ROUND)); setIdx(0); setScore(0); setTeaching(false); };

  if (done) {
    return <Finish emoji="👩‍🏫" title="수업 끝! 선생님 최고!"
      sub={`엄마·아빠 점수: ${score} / ${words.length}`} stars={2} onAgain={again} onBack={onBack} />;
  }

  return (
    <div style={card}>
      <div style={{ fontSize: 17, fontWeight: 900, color: '#44405e' }}>👩‍🏫 선생님 놀이 ({idx + 1} / {words.length})</div>
      <div style={{ fontSize: 13, color: '#888', margin: '4px 0 10px' }}>
        엄마·아빠 점수 {score}점
      </div>

      <div style={{ background: '#fff8e7', borderRadius: 18, padding: '12px 10px', marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: '#a35f12' }}>
          그림을 보여주고 물어봐: <b>"이건 영어로 뭘까?"</b>
        </div>
        <div style={{ fontSize: 86, lineHeight: 1.15 }}>{word.emoji}</div>
        <div style={{ fontSize: 13, color: '#999' }}>정답 (선생님만 봐요 🤫)</div>
        <div style={{ fontSize: 30, fontWeight: 900, color: '#5b4b8a' }}>{word.en}</div>
        <div style={{ fontSize: 15, color: '#888', fontWeight: 700 }}>{word.ko}</div>
      </div>

      {!teaching ? (
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => { playCorrect(); setScore(s => s + 1); speakWord(word.en); next(); }}
            style={lineBtn('#27ae60')}>⭕ 맞혔어</button>
          <button onClick={() => { playClick(); setTeaching(true); speakWord(word.en); }}
            style={lineBtn('#e74c3c')}>❌ 틀렸어</button>
        </div>
      ) : (
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#e74c3c', marginBottom: 10 }}>
            선생님이 정답을 알려 줘! "<span style={{ color: '#5b4b8a' }}>{word.en}</span>" 같이 말해 봐 🗣️
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => { speakWord(word.en); playClick(); }} style={lineBtn()}>🔊 다시 듣기</button>
            <button onClick={() => { playClick(); next(); }} style={lineBtn('#27ae60')}>알려 줬어 →</button>
          </div>
        </div>
      )}
    </div>
  );
}

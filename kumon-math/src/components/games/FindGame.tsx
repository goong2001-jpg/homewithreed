import React, { useEffect, useState } from 'react';
import { WORD_BANK, Word } from '../../words/wordBank';
import { FINDABLE, pickRandom } from '../../words/pool';
import { speakSentence } from '../../alphabet/speech';
import { playClick, playCorrect, playStreak } from '../../utils/sounds';
import { card, Finish, GameProps, lineBtn, bigBtn } from './common';

/**
 * 집 안 물건 찾기 — "Find a cup!" 미션을 듣고 실제 물건을 찾아 온다.
 * 화면 밖에서 몸을 움직이며 단어를 익힌다.
 */
const ROUND = 5;
const PAIRS = new Set(['socks', 'shoes', 'glasses', 'scissors', 'pants']);
const SOME = new Set(['milk', 'water']);

function missionText(w: Word): string {
  if (PAIRS.has(w.en)) return `Find your ${w.en}!`;
  if (SOME.has(w.en)) return `Find some ${w.en}!`;
  return `Find ${/^[aeiou]/.test(w.en) ? 'an' : 'a'} ${w.en}!`;
}

function deal(pool: Word[]): Word[] {
  const all = WORD_BANK.filter(w => FINDABLE.includes(w.en));
  // 배운 단어를 먼저, 모자라면 다른 물건으로
  const learned = all.filter(w => pool.some(p => p.en === w.en));
  const first = pickRandom(learned, ROUND);
  return [...first, ...pickRandom(all.filter(w => !first.includes(w)), ROUND - first.length)];
}

export default function FindGame({ pool, onStars, onBack }: GameProps) {
  const [words, setWords] = useState<Word[]>(() => deal(pool));
  const [idx, setIdx] = useState(0);
  const [found, setFound] = useState(0);
  const [cheer, setCheer] = useState(false);
  const word = words[idx];
  const done = idx >= words.length;

  useEffect(() => { if (word) setTimeout(() => speakSentence(missionText(word)), 300); }, [word]);
  useEffect(() => { if (done && found) playStreak(); }, [done, found]);

  const gotIt = () => {
    playCorrect();
    setCheer(true);
    setFound(f => f + 1);
    onStars(1);
    setTimeout(() => { setCheer(false); setIdx(i => i + 1); }, 1400);
  };
  const skip = () => { playClick(); setIdx(i => i + 1); };
  const again = () => { setWords(deal(pool)); setIdx(0); setFound(0); };

  if (done) {
    return <Finish emoji="🏠" title="미션 성공!" sub={`${found}개를 찾았어요`} stars={found} onAgain={again} onBack={onBack} />;
  }

  return (
    <div style={card}>
      <div style={{ fontSize: 17, fontWeight: 900, color: '#44405e' }}>🏠 물건 찾기 미션 ({idx + 1} / {words.length})</div>
      <div style={{ fontSize: 13, color: '#888', margin: '4px 0 10px' }}>집에서 진짜로 찾아서 가져와 봐!</div>
      <div style={{ fontSize: 96, lineHeight: 1.15 }}>{cheer ? '🎉' : word.emoji}</div>
      <div style={{ fontSize: 30, fontWeight: 900, color: '#5b4b8a', margin: '6px 0' }}>{missionText(word)}</div>
      <div style={{ fontSize: 15, color: '#888', fontWeight: 700, marginBottom: 14 }}>{word.ko} 찾아오기</div>
      <button onClick={() => { speakSentence(missionText(word)); playClick(); }}
        style={{ ...lineBtn(), flex: 'none', width: '100%', marginBottom: 10 }}>🔊 미션 다시 듣기</button>
      <button onClick={gotIt} disabled={cheer} style={{ ...bigBtn(!cheer), marginBottom: 8 }}>찾았어! ✋</button>
      <button onClick={skip} disabled={cheer}
        style={{ border: 'none', background: 'none', color: '#999', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
        우리 집엔 없어요 → 다음
      </button>
    </div>
  );
}

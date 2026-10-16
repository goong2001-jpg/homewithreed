import React, { useEffect, useMemo, useState } from 'react';
import { Word } from '../../words/wordBank';
import { pickRandom } from '../../words/pool';
import { speakWord } from '../../alphabet/speech';
import { playClick, playCorrect, playWrong, playStreak } from '../../utils/sounds';
import { card, Finish, GameProps, lineBtn } from './common';

/**
 * 철자 맞추기 — 그림을 보고, 흩어진 글자 조각을 순서대로 눌러 단어를 만든다.
 * 짧은 단어부터 낸다 (7살이 할 수 있게 6글자까지).
 */
const ROUND = 5;

function spellable(pool: Word[]): Word[] {
  const ok = pool.filter(w => /^[a-z]+$/.test(w.en) && w.en.length >= 2 && w.en.length <= 6);
  // 짧은 단어를 먼저 고른다
  const short = pickRandom(ok.filter(w => w.en.length <= 4), ROUND);
  return short.length >= ROUND ? short : [...short, ...pickRandom(ok.filter(w => w.en.length > 4), ROUND - short.length)];
}

interface Tile { id: number; ch: string }

function scramble(en: string): Tile[] {
  const tiles = en.split('').map((ch, id) => ({ id, ch }));
  let out = pickRandom(tiles, tiles.length);
  // 처음부터 정답 순서로 놓이지 않게
  for (let k = 0; k < 5 && out.map(t => t.ch).join('') === en; k++) out = pickRandom(tiles, tiles.length);
  return out;
}

export default function SpellGame({ pool, onStars, onBack }: GameProps) {
  const [words, setWords] = useState<Word[]>(() => spellable(pool));
  const [idx, setIdx] = useState(0);
  const [built, setBuilt] = useState<number[]>([]);
  const [shake, setShake] = useState<number | null>(null);
  const word = words[idx];
  const tiles = useMemo(() => (word ? scramble(word.en) : []), [word]);
  const typed = built.map(id => tiles.find(t => t.id === id)!.ch).join('');
  const complete = !!word && typed === word.en;
  const done = idx >= words.length;

  useEffect(() => { if (word) setTimeout(() => speakWord(word.en), 300); }, [word]);
  useEffect(() => {
    if (!complete) return;
    playCorrect();
    speakWord(word.en);
    onStars(1);
    const t = setTimeout(() => { setIdx(i => i + 1); setBuilt([]); }, 1500);
    return () => clearTimeout(t);
  }, [complete, word, onStars]);
  useEffect(() => { if (done && words.length) playStreak(); }, [done, words.length]);

  const tap = (t: Tile) => {
    if (complete || built.includes(t.id)) return;
    if (t.ch === word.en[built.length]) {
      playClick();
      setBuilt(b => [...b, t.id]);
    } else {
      playWrong();
      setShake(t.id);
      setTimeout(() => setShake(null), 400);
    }
  };

  const again = () => { setWords(spellable(pool)); setIdx(0); setBuilt([]); };

  if (!words.length) {
    return <div style={card}>아직 철자 놀이를 할 단어가 없어요. 단어를 먼저 배워 볼까요?<br /><br />
      <button onClick={onBack} style={lineBtn()}>돌아가기</button></div>;
  }
  if (done) return <Finish emoji="🔤" title="단어를 다 만들었어!" stars={words.length} onAgain={again} onBack={onBack} />;

  return (
    <div style={card}>
      <div style={{ fontSize: 17, fontWeight: 900, color: '#44405e' }}>🔤 철자 맞추기 ({idx + 1} / {words.length})</div>
      <div style={{ fontSize: 80, lineHeight: 1.15, marginTop: 6 }}>{word.emoji}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: '#888' }}>{word.ko}</div>
      <button onClick={() => { speakWord(word.en); playClick(); }}
        style={{ border: 'none', background: 'none', color: '#7c4dff', fontWeight: 800, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', margin: '4px 0 10px' }}>
        🔊 다시 듣기
      </button>

      {/* 만든 글자 칸 */}
      <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 16 }}>
        {word.en.split('').map((_, i) => (
          <div key={i} style={{
            width: 42, height: 50, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 28, fontWeight: 900,
            background: complete ? '#e8fff0' : i === built.length ? '#fff3e0' : '#f2f0fa',
            border: i === built.length && !complete ? '3px solid #f0a868' : '3px solid transparent',
            color: complete ? '#27ae60' : '#5b4b8a',
          }}>
            {typed[i] ?? ''}
          </div>
        ))}
      </div>

      {/* 글자 조각 */}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
        {tiles.map(t => {
          const used = built.includes(t.id);
          return (
            <button key={t.id} onClick={() => tap(t)} disabled={used}
              style={{
                width: 52, height: 56, borderRadius: 14, border: 'none', fontFamily: 'inherit',
                fontSize: 28, fontWeight: 900, cursor: used ? 'default' : 'pointer',
                background: used ? '#eee' : 'linear-gradient(135deg,#ffe29f,#ffa99f)',
                color: used ? '#ccc' : '#5b3a1a', boxShadow: used ? 'none' : '0 3px 8px rgba(0,0,0,0.15)',
                transform: shake === t.id ? 'translateX(-4px) rotate(-6deg)' : 'none', transition: 'transform 0.1s',
              }}>
              {t.ch}
            </button>
          );
        })}
      </div>
      {!complete && built.length === 0 && (
        <div style={{ fontSize: 12, color: '#a35f12', marginTop: 12 }}>👆 첫 글자부터 순서대로 눌러봐!</div>
      )}
    </div>
  );
}

import React, { useCallback, useEffect, useState } from 'react';
import { Word } from '../../words/wordBank';
import { pickRandom } from '../../words/pool';
import { speakWord } from '../../alphabet/speech';
import { playClick, playCorrect, playStreak } from '../../utils/sounds';
import { card, Finish, GameProps } from './common';

/**
 * 짝 맞추기 — 카드를 두 장씩 뒤집어서 그림과 영어 단어의 짝을 찾는다.
 */
const PAIRS = 6;

interface Card { id: number; word: Word; face: 'pic' | 'word' }

function deal(pool: Word[]): Card[] {
  const words = pickRandom(pool, PAIRS);
  const cards: Card[] = [];
  words.forEach((w, i) => {
    cards.push({ id: i * 2, word: w, face: 'pic' });
    cards.push({ id: i * 2 + 1, word: w, face: 'word' });
  });
  return pickRandom(cards, cards.length);
}

export default function MatchGame({ pool, onStars, onBack }: GameProps) {
  const [cards, setCards] = useState<Card[]>(() => deal(pool));
  const [open, setOpen] = useState<number[]>([]);
  const [found, setFound] = useState<string[]>([]);
  const [tries, setTries] = useState(0);
  const done = found.length === PAIRS;

  useEffect(() => { if (done) { playStreak(); onStars(3); } }, [done, onStars]);

  const flip = useCallback((c: Card) => {
    // 이미 찾은 짝은 누르면 다시 읽어만 준다
    if (found.includes(c.word.en)) { speakWord(c.word.en); return; }
    if (open.length >= 2 || open.includes(c.id)) return;
    playClick();
    const next = [...open, c.id];
    setOpen(next);
    // 그림 카드든 단어 카드든 뒤집으면 읽어 준다 — 글자를 못 읽어도 소리로 짝을 찾을 수 있게
    speakWord(c.word.en);
    if (next.length === 2) {
      setTries(t => t + 1);
      const [a, b] = next.map(id => cards.find(x => x.id === id)!);
      if (a.word.en === b.word.en) {
        setTimeout(() => {
          playCorrect();
          setFound(f => [...f, a.word.en]);
          setOpen([]);
        }, 400);
      } else {
        setTimeout(() => setOpen([]), 1000);
      }
    }
  }, [open, found, cards]);

  const again = () => { setCards(deal(pool)); setOpen([]); setFound([]); setTries(0); };

  if (done) {
    return <Finish emoji="🃏" title="짝을 다 찾았어!" sub={`${tries}번 만에 찾았어요`} stars={3} onAgain={again} onBack={onBack} />;
  }

  return (
    <div style={card}>
      <div style={{ fontSize: 17, fontWeight: 900, color: '#44405e' }}>🃏 짝 맞추기</div>
      <div style={{ fontSize: 13, color: '#888', margin: '4px 0 12px' }}>
        그림과 영어 단어 짝을 찾아봐! ({found.length} / {PAIRS})
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        {cards.map(c => {
          const isFound = found.includes(c.word.en);
          const shown = isFound || open.includes(c.id);
          return (
            <button
              key={c.id}
              onClick={() => flip(c)}
              style={{
                aspectRatio: '1 / 1', borderRadius: 14, border: 'none', cursor: 'pointer',
                fontFamily: 'inherit', padding: 4,
                background: isFound ? 'linear-gradient(135deg,#84fab0,#8fd3f4)'
                  : shown ? '#fff8e7' : 'linear-gradient(135deg,#a18cd1,#fbc2eb)',
                boxShadow: '0 3px 8px rgba(0,0,0,0.12)',
                transition: 'background 0.2s',
              }}
            >
              {shown ? (
                c.face === 'pic'
                  ? <span style={{ fontSize: 40 }}>{c.word.emoji}</span>
                  : <span style={{ fontSize: c.word.en.length > 7 ? 14 : 18, fontWeight: 900, color: '#5b4b8a' }}>{c.word.en}</span>
              ) : (
                <span style={{ fontSize: 28 }}>⭐</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

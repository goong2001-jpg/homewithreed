import React, { useEffect, useMemo, useState } from 'react';
import { Word } from '../../words/wordBank';
import { pickRandom } from '../../words/pool';
import { Sentence, sentencesFor } from '../../words/sentences';
import { speakSentence } from '../../alphabet/speech';
import { playClick, playCorrect, playStreak, playWrong } from '../../utils/sounds';
import { card, Finish, GameProps, lineBtn } from './common';

/**
 * 문장 만들기 — 요정이 말한 문장을 듣고, 흩어진 낱말 조각을 순서대로 눌러 문장을 만든다.
 * 단어에서 문장으로 넘어가는 연습이라 3~5낱말짜리 짧은 문장만 낸다.
 */
const ROUND = 5;
const MIN_TOKENS = 3;
const MAX_TOKENS = 5;

interface Item { word: Word; sentence: Sentence; tokens: string[] }
interface Tile { id: number; text: string }

/** 이 단어로 만들 수 있는 알맞은 길이의 문장 하나 (없으면 null) */
export function buildable(word: Word): Item | null {
  const ok = sentencesFor(word)
    .map(sentence => ({ word, sentence, tokens: sentence.en.split(' ') }))
    .filter(it => it.tokens.length >= MIN_TOKENS && it.tokens.length <= MAX_TOKENS);
  return ok.length ? pickRandom(ok, 1)[0] : null;
}

function makeItems(pool: Word[]): Item[] {
  const out: Item[] = [];
  for (const w of pickRandom(pool, pool.length)) {
    if (out.length >= ROUND) break;
    const it = buildable(w);
    if (it) out.push(it);
  }
  return out;
}

function scramble(tokens: string[]): Tile[] {
  const tiles = tokens.map((text, id) => ({ id, text }));
  let out = pickRandom(tiles, tiles.length);
  for (let k = 0; k < 5 && out.map(t => t.text).join(' ') === tokens.join(' '); k++) out = pickRandom(tiles, tiles.length);
  return out;
}

export default function SentenceGame({ pool, onStars, onBack }: GameProps) {
  const [items, setItems] = useState<Item[]>(() => makeItems(pool));
  const [idx, setIdx] = useState(0);
  const [built, setBuilt] = useState<number[]>([]);
  const [shake, setShake] = useState<number | null>(null);
  const item = items[idx];
  const tiles = useMemo(() => (item ? scramble(item.tokens) : []), [item]);
  const complete = !!item && built.length === item.tokens.length;
  const done = idx >= items.length;

  useEffect(() => { if (item) { const t = setTimeout(() => speakSentence(item.sentence.en), 300); return () => clearTimeout(t); } }, [item]);
  useEffect(() => {
    if (!complete) return;
    playCorrect();
    speakSentence(item.sentence.en);
    onStars(1);
    const t = setTimeout(() => { setIdx(i => i + 1); setBuilt([]); }, 2300);
    return () => clearTimeout(t);
  }, [complete, item, onStars]);
  useEffect(() => { if (done && items.length) playStreak(); }, [done, items.length]);

  const tap = (t: Tile) => {
    if (complete || built.includes(t.id)) return;
    // 같은 낱말이 두 번 나오는 문장도 있으니 글자가 같으면 맞는 것으로 본다
    if (t.text === item.tokens[built.length]) { playClick(); setBuilt(b => [...b, t.id]); }
    else { playWrong(); setShake(t.id); setTimeout(() => setShake(null), 400); }
  };

  if (!items.length) {
    return <div style={card}>아직 문장을 만들 단어가 없어요. 단어를 먼저 배워 볼까요?<br /><br />
      <button onClick={onBack} style={lineBtn()}>돌아가기</button></div>;
  }
  if (done) {
    return <Finish emoji="🧩" title="문장을 다 만들었어!" stars={items.length}
      onAgain={() => { setItems(makeItems(pool)); setIdx(0); setBuilt([]); }} onBack={onBack} />;
  }

  return (
    <div style={card}>
      <div style={{ fontSize: 17, fontWeight: 900, color: '#44405e' }}>🧩 문장 만들기 ({idx + 1} / {items.length})</div>
      <div style={{ fontSize: 64, lineHeight: 1.15, marginTop: 6 }}>{item.word.emoji}</div>
      <div style={{ fontSize: 15, fontWeight: 800, color: '#888' }}>{item.sentence.ko}</div>
      <button onClick={() => { speakSentence(item.sentence.en); playClick(); }}
        style={{ border: 'none', background: 'none', color: '#7c4dff', fontWeight: 800, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', margin: '4px 0 10px' }}>
        🔊 문장 다시 듣기
      </button>

      {/* 만든 문장 */}
      <div style={{
        minHeight: 52, display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap', alignItems: 'center',
        background: complete ? '#e8fff0' : '#f2f0fa', borderRadius: 14, padding: '8px 8px', marginBottom: 14,
        border: complete ? '3px solid #27ae60' : '3px dashed #d5cff0',
      }}>
        {built.length === 0 && <span style={{ fontSize: 13, color: '#aaa', fontWeight: 700 }}>👇 낱말을 순서대로 눌러봐!</span>}
        {built.map(id => (
          <span key={id} style={{ fontSize: 20, fontWeight: 900, color: complete ? '#27ae60' : '#5b4b8a' }}>
            {tiles.find(t => t.id === id)!.text}
          </span>
        ))}
      </div>

      {/* 낱말 조각 */}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
        {tiles.map(t => {
          const used = built.includes(t.id);
          return (
            <button key={t.id} onClick={() => tap(t)} disabled={used}
              style={{
                padding: '10px 14px', borderRadius: 14, border: 'none', fontFamily: 'inherit',
                fontSize: 20, fontWeight: 900, cursor: used ? 'default' : 'pointer',
                background: used ? '#eee' : 'linear-gradient(135deg,#c2e9fb,#a1c4fd)',
                color: used ? '#ccc' : '#2b3a67', boxShadow: used ? 'none' : '0 3px 8px rgba(0,0,0,0.15)',
                transform: shake === t.id ? 'translateX(-4px) rotate(-4deg)' : 'none', transition: 'transform 0.1s',
              }}>
              {t.text}
            </button>
          );
        })}
      </div>
    </div>
  );
}

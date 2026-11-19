import React from 'react';
import { tokenize, SIGHT_WORDS } from '../words/books';
import { UNITS } from '../words/units';
import { speakWord } from '../alphabet/speech';

/**
 * 책 한 쪽의 글 — 낱말마다 눌러서 들을 수 있다.
 *  - 지금 읽어 주는 낱말은 노란 형광펜
 *  - 이 책 단계의 새 소리 글자는 주황색
 *  - 외워서 읽는 단어(the, is …)는 점선 밑줄
 */
export default function BookText({ text, unit, highlight = -1, size = 30 }: {
  text: string;
  unit: number;
  /** 지금 읽는 글자 위치 (없으면 -1) */
  highlight?: number;
  size?: number;
}) {
  const sounds = UNITS[unit % UNITS.length].flatMap(s => s.letters.join(' ').split(/\s+/));
  let pos = 0;
  const tokens = tokenize(text).map(t => {
    const start = text.indexOf(t.word, pos);
    pos = start + t.word.length;
    return { ...t, start, end: pos };
  });

  // 낱말 안에서 새 소리 글자를 색칠한다 (sh, ch 같은 두 글자 소리를 먼저 본다)
  const longFirst = sounds.slice().sort((a, b) => b.length - a.length);
  const soundAt = (lower: string, at: number) => longFirst.find(l => lower.startsWith(l, at));
  const paint = (word: string) => {
    const out: React.ReactNode[] = [];
    const lower = word.toLowerCase();
    let i = 0;
    while (i < word.length) {
      const hit = soundAt(lower, i);
      if (hit) { out.push(<span key={i} style={{ color: '#e67e22' }}>{word.slice(i, i + hit.length)}</span>); i += hit.length; }
      else { out.push(word[i]); i++; }
    }
    return out;
  };

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '4px 10px', lineHeight: 1.35 }}>
      {tokens.map((t, i) => {
        const on = highlight >= t.start && highlight < t.end;
        const sight = SIGHT_WORDS.has(t.clean);
        return (
          <button key={i} onClick={() => speakWord(t.clean)} style={{
            border: 'none', background: on ? '#fff3a3' : 'transparent', borderRadius: 8, padding: '0 3px',
            fontSize: size, fontWeight: 900, color: '#44405e', cursor: 'pointer', fontFamily: 'inherit',
            textDecoration: sight ? 'underline dotted #b9a6e8' : 'none', textUnderlineOffset: 6,
            transition: 'background 0.15s',
          }}>{paint(t.word)}</button>
        );
      })}
    </div>
  );
}

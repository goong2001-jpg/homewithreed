import React, { useState } from 'react';
import { WORD_BANK, Word } from '../../words/wordBank';
import { wordsOfSound } from '../../words/dailySet';
import { UNITS } from '../../words/units';
import FairyBubble from '../FairyBubble';
import { speakWord } from '../../alphabet/speech';
import { playClick } from '../../utils/sounds';
import { card, lineBtn } from './common';

/**
 * 단어 그림책 — 배운 단어가 소리별 페이지에 한 칸씩 채워진다.
 * 아직 안 배운 칸은 ❓로 남아 있어 모으는 재미가 있다.
 * 문제에서 한 번에 맞힌 만큼 별(최대 3개)이 붙는다.
 */
interface Page { title: string; ko: string; words: Word[] }

function buildPages(seen: Record<string, number>): Page[] {
  const pages: Page[] = [];
  const used = new Set<string>();
  for (const pair of UNITS) {
    for (const s of pair) {
      if (pages.some(p => p.title === s.label)) continue; // f 처럼 두 번 나오는 소리
      const ws = wordsOfSound(s);
      ws.forEach(w => used.add(w.en));
      pages.push({ title: s.label, ko: s.ko, words: ws });
    }
  }
  const others = WORD_BANK.filter(w => !used.has(w.en) && seen[w.en]);
  if (others.length) pages.push({ title: '+', ko: '그 밖의 단어', words: others });
  return pages;
}

export default function PictureBook({ seen, known, onBack }: {
  seen: Record<string, number>; known: Record<string, number>; onBack: () => void;
}) {
  const pages = buildPages(seen);
  const [pi, setPi] = useState(0);
  const [picked, setPicked] = useState<Word | null>(null);
  const page = pages[pi];
  const total = pages.reduce((n, p) => n + p.words.length, 0);
  const collected = pages.reduce((n, p) => n + p.words.filter(w => seen[w.en]).length, 0);

  const open = (w: Word) => {
    if (!seen[w.en]) { playClick(); return; }
    setPicked(w);
    speakWord(w.en);
  };

  return (
    <div style={card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button onClick={onBack} style={{ ...lineBtn(), flex: 'none', padding: '6px 10px', fontSize: 13 }}>← 놀이</button>
        <div style={{ fontSize: 17, fontWeight: 900, color: '#44405e' }}>📚 나의 단어 그림책</div>
        <div style={{ width: 54 }} />
      </div>
      <div style={{ fontSize: 13, color: '#9b59b6', fontWeight: 800, margin: '6px 0 10px' }}>
        모은 단어 {collected} / {total}
      </div>

      <div style={{ background: '#faf8ff', borderRadius: 18, padding: 12, minHeight: 260 }}>
        <div style={{ fontSize: 36, fontWeight: 900, color: '#e67e22', lineHeight: 1 }}>
          {page.title === '+' ? '✨' : page.title}
          <span style={{ fontSize: 18, color: '#5b4b8a', marginLeft: 8 }}>{page.ko}</span>
        </div>
        <div style={{ fontSize: 12, color: '#999', marginBottom: 10 }}>
          {page.words.filter(w => seen[w.en]).length} / {page.words.length} 모음
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {page.words.map(w => {
            const has = !!seen[w.en];
            const stars = Math.min(3, known[w.en] ?? 0);
            return (
              <button key={w.en} onClick={() => open(w)}
                style={{
                  borderRadius: 14, border: picked?.en === w.en ? '3px solid #7c4dff' : '2px solid #eee',
                  background: has ? 'white' : '#f0f0f0', padding: '8px 2px', cursor: 'pointer', fontFamily: 'inherit',
                }}>
                <div style={{ fontSize: 30, filter: has ? 'none' : 'grayscale(1) opacity(0.25)' }}>{has ? w.emoji : '❓'}</div>
                <div style={{ fontSize: 12, fontWeight: 800, color: has ? '#5b4b8a' : '#bbb' }}>{has ? w.en : '???'}</div>
                <div style={{ fontSize: 10, height: 12 }}>{'⭐'.repeat(stars)}</div>
              </button>
            );
          })}
        </div>
      </div>

      {picked && (
        <FairyBubble word={picked} style={{ marginTop: 10 }}
          label={`🧚 ${picked.emoji} ${picked.ko} — 눌러서 문장 듣기 🔊`} />
      )}

      <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
        <button disabled={pi === 0} onClick={() => { setPi(pi - 1); setPicked(null); playClick(); }}
          style={{ ...lineBtn(), opacity: pi === 0 ? 0.4 : 1 }}>← 앞 장</button>
        <div style={{ alignSelf: 'center', fontSize: 13, color: '#888', fontWeight: 800 }}>{pi + 1} / {pages.length}</div>
        <button disabled={pi === pages.length - 1} onClick={() => { setPi(pi + 1); setPicked(null); playClick(); }}
          style={{ ...lineBtn(), opacity: pi === pages.length - 1 ? 0.4 : 1 }}>다음 장 →</button>
      </div>
    </div>
  );
}

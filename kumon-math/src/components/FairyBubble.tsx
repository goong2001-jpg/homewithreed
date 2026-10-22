import React, { useEffect, useState } from 'react';
import { Word } from '../words/wordBank';
import { sentencesFor, splitSentence } from '../words/sentences';
import { speakSentence } from '../alphabet/speech';
import { playClick } from '../utils/sounds';

/**
 * 요정 말풍선 — 단어를 넣은 문장을 보여주고, 누르면 읽어 준다.
 * 단어마다 문장이 여러 개라 "🔄 다른 말"을 누르면 새 문장을 들려준다.
 * 처음 보여줄 문장도 무작위로 골라 볼 때마다 다른 말을 한다.
 *
 * note 가 있으면(요정의 기억 — words/fairy.ts) 평소 제목 대신 그 말을 보여준다.
 * 어떤 말을 할지는 밖에서 정한다. 이 컴포넌트는 보여주기만 한다.
 */
export default function FairyBubble({ word, label = '🧚 요정이 말해요 (눌러서 듣기 🔊)', note, style }: {
  word: Word; label?: string; note?: string | null; style?: React.CSSProperties;
}) {
  const all = sentencesFor(word);
  const [i, setI] = useState(() => Math.floor(Math.random() * all.length));

  // 다른 단어로 바뀌면 그 단어의 문장 중에서 새로 고른다
  useEffect(() => {
    setI(Math.floor(Math.random() * sentencesFor(word).length));
  }, [word]);

  const s = all[i % all.length];
  const [pre, mid, post] = splitSentence(s.en, word.en);

  const another = () => {
    const next = (i + 1) % all.length;
    setI(next);
    speakSentence(all[next].en);
    playClick();
  };

  return (
    <div style={{
      display: 'flex', gap: 6, alignItems: 'stretch', width: '100%',
      ...style,
    }}>
      <button
        onClick={() => { speakSentence(s.en); playClick(); }}
        style={{
          flex: 1, padding: '10px 12px', borderRadius: 16,
          border: '2px dashed #f3c4e3', background: '#fff5fb', cursor: 'pointer',
          fontFamily: 'inherit', textAlign: 'left',
        }}
      >
        {note ? (
          <div style={{ fontSize: 13, fontWeight: 900, color: '#b5478f', marginBottom: 4, lineHeight: 1.35 }}>
            🧚 {note}
          </div>
        ) : (
          <div style={{ fontSize: 11, fontWeight: 800, color: '#c06aa0', marginBottom: 2 }}>{label}</div>
        )}
        <div style={{ fontSize: 18, fontWeight: 800, color: '#5b4b8a' }}>
          {pre}<span style={{ color: '#e67e22' }}>{mid}</span>{post}
        </div>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#999', marginTop: 2 }}>{s.ko}</div>
      </button>
      {all.length > 1 && (
        <button
          onClick={another}
          aria-label="다른 말"
          style={{
            width: 56, borderRadius: 16, border: '2px solid #f3c4e3', background: 'white',
            color: '#c06aa0', fontSize: 11, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit',
            padding: '4px 2px',
          }}
        >
          <div style={{ fontSize: 22 }}>🔄</div>
          다른 말
        </button>
      )}
    </div>
  );
}

import React from 'react';
import { UNITS, DAYS_PER_UNIT, SoundDef } from '../words/units';
import { wordsOfSound } from '../words/dailySet';
import { firstLetters } from '../words/phonics';
import { speakPhonics, speakWord } from '../alphabet/speech';
import { playClick } from '../utils/sounds';
import { Word } from '../words/wordBank';

/** 단어의 첫 글자(소리 글자)만 색을 달리해서 보여준다 (예: [s]un) */
export function ColoredWord({ en, color = '#e67e22' }: { en: string; color?: string }) {
  const head = firstLetters(en);
  if (!en.toLowerCase().startsWith(head)) return <>{en}</>;
  return (
    <>
      <span style={{ color }}>{en.slice(0, head.length)}</span>
      {en.slice(head.length)}
    </>
  );
}

function sayTheSound(sound: SoundDef, example?: Word) {
  speakPhonics(`${sound.key}, ${sound.key}, ${sound.key}`);
  if (example) setTimeout(() => speakWord(example.en), 2600);
}

interface IntroProps {
  unit: number;
  unitDay: number;
  onStart: () => void;
}

/** 오늘의 소리 소개 — 글자 모양과 소리를 먼저 익히고 단어로 넘어간다 */
export function SoundIntro({ unit, unitDay, onStart }: IntroProps) {
  const pair = UNITS[unit % UNITS.length];
  return (
    <div style={{
      background: 'white', borderRadius: 24, padding: '20px 18px',
      width: '100%', maxWidth: 360, textAlign: 'center',
      boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
    }}>
      <div style={{ fontSize: 13, fontWeight: 800, color: '#9b59b6' }}>
        {unit % UNITS.length + 1}단계 · {DAYS_PER_UNIT}일 중 {unitDay + 1}일째
      </div>
      <div style={{ fontSize: 21, fontWeight: 900, color: '#44405e', margin: '4px 0 14px' }}>
        오늘의 소리 🔤
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        {pair.map(sound => {
          const examples = wordsOfSound(sound).slice(0, 3);
          return (
            <button
              key={sound.key + sound.label}
              onClick={() => { playClick(); sayTheSound(sound, examples[0]); }}
              style={{
                flex: 1, border: '3px solid #ede7ff', background: '#faf8ff',
                borderRadius: 20, padding: '14px 6px', cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              <div style={{ fontSize: 46, fontWeight: 900, color: '#e67e22', lineHeight: 1 }}>
                {sound.label}
              </div>
              <div style={{ fontSize: 22, fontWeight: 900, color: '#5b4b8a', margin: '6px 0' }}>
                {sound.ko} 🔉
              </div>
              <div style={{ fontSize: 13, color: '#666', fontWeight: 700, lineHeight: 1.6 }}>
                {examples.map(w => (
                  <div key={w.en}>{w.emoji} <ColoredWord en={w.en} /></div>
                ))}
              </div>
            </button>
          );
        })}
      </div>
      <div style={{ fontSize: 12, color: '#999', margin: '10px 0 14px' }}>
        글자 카드를 누르면 소리를 들려줘요
      </div>
      <button
        onClick={() => { playClick(); onStart(); }}
        style={{
          width: '100%', padding: '14px 0', borderRadius: 16, border: 'none',
          background: 'linear-gradient(135deg,#667eea,#764ba2)', color: 'white',
          fontSize: 16, fontWeight: 900, cursor: 'pointer', fontFamily: 'inherit',
        }}
      >
        단어 배우러 가기 →
      </button>
    </div>
  );
}

interface PickerProps {
  current: number;
  onChoose: (unit: number) => void;
  onClose: () => void;
}

/** 소리 단계 고르기 — 어려우면 앞 단계로 돌아가거나, 아는 단계는 건너뛸 수 있다 */
export function UnitPicker({ current, onChoose, onClose }: PickerProps) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 160,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }}>
      <div style={{
        background: 'white', borderRadius: 24, padding: 20, maxWidth: 380, width: '100%',
        maxHeight: '85vh', overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <div style={{ fontSize: 20, fontWeight: 900 }}>🔤 소리 단계</div>
          <button onClick={onClose} style={{
            background: 'rgba(0,0,0,0.12)', border: 'none', borderRadius: '50%',
            width: 34, height: 34, fontSize: 17, cursor: 'pointer', fontWeight: 700,
          }}>✕</button>
        </div>
        <div style={{ fontSize: 12, color: '#888', marginBottom: 12 }}>
          단계를 고르면 오늘 단어가 그 소리로 바뀌어요. 한 단계는 {DAYS_PER_UNIT}일 동안 해요.
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {UNITS.map(([a, b], i) => {
            const isCur = i === current % UNITS.length;
            const done = i < current % UNITS.length;
            return (
              <button
                key={i}
                onClick={() => { playClick(); onChoose(i); onClose(); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
                  borderRadius: 14, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                  border: isCur ? '3px solid #7c4dff' : '2px solid #eee',
                  background: isCur ? '#ede7ff' : done ? '#f1fbf4' : 'white',
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 800, color: '#999', minWidth: 38 }}>{i + 1}단계</span>
                <span style={{ flex: 1, fontSize: 17, fontWeight: 900, color: '#44405e' }}>
                  {a.label} <span style={{ color: '#e67e22' }}>{a.ko}</span>
                  {'  ·  '}
                  {b.label} <span style={{ color: '#e67e22' }}>{b.ko}</span>
                </span>
                <span style={{ fontSize: 13, fontWeight: 800, color: done ? '#27ae60' : '#7c4dff' }}>
                  {isCur ? '지금' : done ? '✓' : ''}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

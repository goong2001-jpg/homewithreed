import React, { useCallback, useEffect, useState } from 'react';
import { LETTERS } from '../alphabet/letters';
import {
  speakLetter, speakWord, speakLetterAndWord, warmUpVoices, speechSupported,
} from '../alphabet/speech';
import { useAlphabetProgress } from '../hooks/useAlphabetProgress';
import { useGameState } from '../hooks/useGameState';
import TracingCanvas from '../components/TracingCanvas';
import StrokeOrderCanvas from '../components/StrokeOrderCanvas';
import Avatar from '../components/Avatar';
import Shop from '../components/Shop';
import { playCorrect, playStreak, playClick } from '../utils/sounds';

export default function AlphabetScreen() {
  const { progress, completeLetter, setIndex, setLetterCase, setMode } = useAlphabetProgress();
  // 별(포인트)과 아바타는 수학놀이와 같은 지갑을 쓴다
  const { gameState, items, buyItem, equipItem, addPoints } = useGameState();
  const [resetKey, setResetKey] = useState(0);
  const [celebrate, setCelebrate] = useState<{ earned: number; isFirst: boolean } | null>(null);
  const [showList, setShowList] = useState(false);
  const [showShop, setShowShop] = useState(false);
  const [happy, setHappy] = useState(false);

  const idx = Math.min(progress.index, LETTERS.length - 1);
  const info = LETTERS[idx];
  const isUpper = progress.letterCase === 'upper';
  const glyph = isUpper ? info.upper : info.lower;
  const isMastered = progress.mastered.includes(glyph);

  useEffect(() => { warmUpVoices(); }, []);

  const goTo = useCallback((next: number) => {
    const clamped = (next + LETTERS.length) % LETTERS.length;
    setIndex(clamped);
    setCelebrate(null);
    setResetKey(k => k + 1);
    playClick();
  }, [setIndex]);

  const handleComplete = useCallback(() => {
    const result = completeLetter(glyph);
    setCelebrate(result);
    addPoints(result.earned);          // 수학놀이와 같은 별로 적립
    setHappy(true);
    setTimeout(() => setHappy(false), 1200);
    if (result.isFirst) playStreak(); else playCorrect();
    // 다 그리면 글자와 단어를 읽어준다
    setTimeout(() => speakLetterAndWord(info.upper, info.word), 350);
  }, [completeLetter, glyph, info.upper, info.word, addPoints]);

  const masteredCount = progress.mastered.filter(m =>
    isUpper ? m === m.toUpperCase() : m === m.toLowerCase()
  ).length;

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(160deg, #e0c3fc 0%, #b3e5fc 45%, #ffe0f0 100%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '12px 16px 40px',
      fontFamily: "'Nunito', 'Noto Sans KR', sans-serif",
    }}>
      {/* 상단 바 */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        width: '100%', maxWidth: 380, marginBottom: 12,
      }}>
        <div style={{ fontSize: 22, fontWeight: 900, color: '#4a3070' }}>🔤 알파벳 놀이</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            background: 'white', borderRadius: 14, padding: '7px 14px',
            fontSize: 15, fontWeight: 800, color: '#f39c12',
            boxShadow: '0 3px 10px rgba(0,0,0,0.1)',
          }}>
            ⭐ {gameState.points}
          </div>
          <button
            onClick={() => { setShowShop(true); playClick(); }}
            style={{
              background: 'linear-gradient(135deg, #f093fb, #f5576c)',
              color: 'white', border: 'none', borderRadius: 14,
              padding: '9px 14px', fontSize: 14, fontWeight: 800,
              cursor: 'pointer', fontFamily: 'inherit',
              boxShadow: '0 4px 12px rgba(240,147,251,0.45)',
            }}
          >
            🛍️
          </button>
        </div>
      </div>

      {/* 연습 방식: 획순 쓰기 / 색칠하기 */}
      <div style={{ display: 'flex', gap: 8, width: '100%', maxWidth: 380, marginBottom: 8 }}>
        {([
          { id: 'stroke' as const, label: '✏️ 획순 쓰기', desc: '순서대로' },
          { id: 'trace' as const, label: '🎨 색칠하기', desc: '자유롭게' },
        ]).map(m => {
          const on = progress.mode === m.id;
          return (
            <button
              key={m.id}
              onClick={() => { setMode(m.id); setResetKey(k => k + 1); setCelebrate(null); playClick(); }}
              style={{
                flex: 1, padding: '9px 4px', borderRadius: 14, border: 'none',
                background: on ? 'linear-gradient(135deg,#667eea,#764ba2)' : 'white',
                color: on ? 'white' : '#666',
                fontSize: 14, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit',
                boxShadow: on ? '0 4px 12px rgba(118,75,162,0.35)' : '0 2px 6px rgba(0,0,0,0.08)',
                lineHeight: 1.3,
              }}
            >
              {m.label}
              <div style={{ fontSize: 10, fontWeight: 700, opacity: 0.75 }}>{m.desc}</div>
            </button>
          );
        })}
      </div>

      {/* 대문자 / 소문자 + 모아보기 */}
      <div style={{ display: 'flex', gap: 8, width: '100%', maxWidth: 380, marginBottom: 12 }}>
        {(['upper', 'lower'] as const).map(c => (
          <button
            key={c}
            onClick={() => { setLetterCase(c); setResetKey(k => k + 1); setCelebrate(null); playClick(); }}
            style={{
              flex: 1, padding: '10px 4px', borderRadius: 14, border: 'none',
              background: progress.letterCase === c ? '#7c4dff' : 'white',
              color: progress.letterCase === c ? 'white' : '#666',
              fontSize: 14, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit',
              boxShadow: progress.letterCase === c
                ? '0 4px 12px rgba(124,77,255,0.4)' : '0 2px 6px rgba(0,0,0,0.08)',
            }}
          >
            {c === 'upper' ? 'ABC 대문자' : 'abc 소문자'}
          </button>
        ))}
        <button
          onClick={() => { setShowList(true); playClick(); }}
          style={{
            padding: '10px 14px', borderRadius: 14, border: 'none', background: 'white',
            fontSize: 16, cursor: 'pointer', boxShadow: '0 2px 6px rgba(0,0,0,0.08)',
          }}
        >
          📋
        </button>
      </div>

      {/* 진행 상황 */}
      <div style={{
        width: '100%', maxWidth: 380, marginBottom: 14,
        background: 'white', borderRadius: 16, padding: '10px 16px',
        display: 'flex', alignItems: 'center', gap: 12,
        boxShadow: '0 4px 14px rgba(0,0,0,0.08)',
      }}>
        <span style={{ fontSize: 20 }}>🏅</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>
            {isUpper ? '대문자' : '소문자'} {masteredCount} / 26 완성
          </div>
          <div style={{ background: '#eee', borderRadius: 99, height: 8, overflow: 'hidden' }}>
            <div style={{
              width: `${(masteredCount / 26) * 100}%`, height: '100%',
              background: 'linear-gradient(90deg, #a18cd1, #fbc2eb)',
              borderRadius: 99, transition: 'width 0.4s ease',
            }} />
          </div>
        </div>
      </div>

      {/* 아바타 — 수학놀이에서 꾸민 그대로 응원해준다 */}
      <div
        className={happy ? 'avatar-bounce' : ''}
        style={{ marginBottom: 10 }}
      >
        <Avatar items={items} mood={happy ? 'happy' : 'idle'} size="small" />
      </div>

      {/* 글자 + 단어 카드 */}
      <div style={{
        width: '100%', maxWidth: 340, background: 'white', borderRadius: 20,
        padding: '12px 16px', marginBottom: 14,
        display: 'flex', alignItems: 'center', gap: 14,
        boxShadow: '0 6px 20px rgba(0,0,0,0.1)',
      }}>
        <button
          onClick={() => { speakLetter(info.upper); }}
          style={{
            fontSize: 40, fontWeight: 900, color: '#7c4dff',
            background: 'none', border: 'none', cursor: 'pointer',
            fontFamily: 'inherit', lineHeight: 1, padding: '0 6px',
          }}
        >
          {info.upper}{info.lower}
        </button>
        <button
          onClick={() => speakWord(info.word)}
          style={{
            flex: 1, textAlign: 'left', background: 'none', border: 'none',
            cursor: 'pointer', fontFamily: 'inherit', padding: 0,
          }}
        >
          <div style={{ fontSize: 20, fontWeight: 800, color: '#2c3e50' }}>
            {info.emoji} {info.word} {isMastered && <span title="이미 완성한 글자">⭐</span>}
          </div>
          <div style={{ fontSize: 13, color: '#888' }}>
            {info.meaning} · 눌러서 들어보기 🔊
          </div>
        </button>
      </div>

      {/* 연습 영역 */}
      {progress.mode === 'stroke' ? (
        <StrokeOrderCanvas letter={glyph} onComplete={handleComplete} resetKey={resetKey} />
      ) : (
        <TracingCanvas letter={glyph} onComplete={handleComplete} resetKey={resetKey} />
      )}

      {/* 완성 축하 */}
      {celebrate && (
        <div style={{
          marginTop: 14, background: 'white', borderRadius: 20,
          padding: '14px 22px', textAlign: 'center', maxWidth: 340, width: '100%',
          boxShadow: '0 6px 20px rgba(0,0,0,0.12)', animation: 'fadeIn 0.3s ease',
        }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: '#27ae60', marginBottom: 4 }}>
            {celebrate.isFirst ? `${glyph} 완성! 처음이야! 🎉` : `${glyph} 또 잘했어! 👏`}
          </div>
          <div style={{ fontSize: 14, color: '#f39c12', fontWeight: 800, marginBottom: 10 }}>
            +{celebrate.earned} ⭐
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
            <button
              onClick={() => speakLetterAndWord(info.upper, info.word)}
              style={{
                background: 'white', color: '#7c4dff', border: '2px solid #7c4dff',
                borderRadius: 12, padding: '10px 16px', fontSize: 14, fontWeight: 800,
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              🔊 다시 듣기
            </button>
            <button
              onClick={() => goTo(idx + 1)}
              style={{
                background: 'linear-gradient(135deg, #7c4dff, #b388ff)',
                color: 'white', border: 'none', borderRadius: 12,
                padding: '10px 20px', fontSize: 14, fontWeight: 800,
                cursor: 'pointer', fontFamily: 'inherit',
                boxShadow: '0 4px 12px rgba(124,77,255,0.4)',
              }}
            >
              다음 글자 →
            </button>
          </div>
        </div>
      )}

      {/* 이전 / 다음 */}
      <div style={{
        display: 'flex', gap: 10, marginTop: 14, width: '100%', maxWidth: 340,
      }}>
        <button
          onClick={() => goTo(idx - 1)}
          style={{
            flex: 1, padding: '12px 0', borderRadius: 14, border: 'none',
            background: 'white', color: '#666', fontSize: 15, fontWeight: 800,
            cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 3px 10px rgba(0,0,0,0.08)',
          }}
        >
          ← 이전
        </button>
        <button
          onClick={() => { setResetKey(k => k + 1); setCelebrate(null); playClick(); }}
          style={{
            padding: '12px 18px', borderRadius: 14, border: 'none',
            background: 'white', color: '#666', fontSize: 15, fontWeight: 800,
            cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 3px 10px rgba(0,0,0,0.08)',
          }}
        >
          다시 ↺
        </button>
        <button
          onClick={() => goTo(idx + 1)}
          style={{
            flex: 1, padding: '12px 0', borderRadius: 14, border: 'none',
            background: 'linear-gradient(135deg, #7c4dff, #b388ff)', color: 'white',
            fontSize: 15, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit',
            boxShadow: '0 4px 12px rgba(124,77,255,0.4)',
          }}
        >
          다음 →
        </button>
      </div>

      {!speechSupported() && (
        <div style={{ marginTop: 12, fontSize: 12, color: '#8a7aa8', textAlign: 'center' }}>
          이 브라우저는 읽어주기를 지원하지 않아요. (그리기는 정상 동작해요)
        </div>
      )}

      {showShop && (
        <Shop
          items={items}
          points={gameState.points}
          totalCorrect={gameState.totalCorrect}
          onBuy={buyItem}
          onEquip={equipItem}
          onClose={() => setShowShop(false)}
        />
      )}

      {/* 글자 모아보기 */}
      {showList && (
        <div
          onClick={() => setShowList(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 150, padding: 16,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'white', borderRadius: 24, padding: 20,
              maxWidth: 420, width: '100%', maxHeight: '85vh', overflowY: 'auto',
              boxShadow: '0 25px 80px rgba(0,0,0,0.3)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ fontSize: 20, fontWeight: 800 }}>📋 글자 고르기</div>
              <button onClick={() => setShowList(false)} style={{
                background: 'rgba(0,0,0,0.12)', border: 'none', borderRadius: '50%',
                width: 34, height: 34, fontSize: 17, cursor: 'pointer', fontWeight: 700,
              }}>✕</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
              {LETTERS.map((l, i) => {
                const g = isUpper ? l.upper : l.lower;
                const doneL = progress.mastered.includes(g);
                const cur = i === idx;
                return (
                  <button
                    key={l.upper}
                    onClick={() => { goTo(i); setShowList(false); }}
                    style={{
                      aspectRatio: '1 / 1', borderRadius: 14,
                      border: cur ? '3px solid #7c4dff' : '2px solid transparent',
                      background: doneL ? 'linear-gradient(135deg,#84fab0,#8fd3f4)' : '#f4f2fb',
                      fontSize: 22, fontWeight: 900,
                      color: doneL ? '#1e5c40' : '#7a6a9a',
                      cursor: 'pointer', fontFamily: 'inherit',
                      display: 'flex', flexDirection: 'column',
                      alignItems: 'center', justifyContent: 'center', gap: 0,
                    }}
                  >
                    <span>{g}</span>
                    <span style={{ fontSize: 11 }}>{doneL ? '⭐' : ' '}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

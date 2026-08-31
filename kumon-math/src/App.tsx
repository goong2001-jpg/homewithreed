import React, { useState } from 'react';
import './App.css';
import MathScreen from './screens/MathScreen';
import AlphabetScreen from './screens/AlphabetScreen';
import { playClick } from './utils/sounds';

/**
 * ─────────────────────────────────────────────────────────────
 *  수학놀이를 다시 보이게 하려면 아래 값을 true 로만 바꾸면 됩니다.
 *  (코드는 그대로 남아 있어 언제든 되살릴 수 있습니다)
 * ─────────────────────────────────────────────────────────────
 */
const SHOW_MATH = false;

type Tab = 'math' | 'alphabet';

const TAB_KEY = 'active_tab';

const ALL_TABS: { id: Tab; label: string; emoji: string }[] = [
  { id: 'math', label: '수학놀이', emoji: '🧮' },
  { id: 'alphabet', label: '알파벳', emoji: '🔤' },
];

// 지금 보여줄 탭만 골라둔다
const TABS = ALL_TABS.filter(t => t.id !== 'math' || SHOW_MATH);
const DEFAULT_TAB: Tab = SHOW_MATH ? 'math' : 'alphabet';

export default function App() {
  const [tab, setTab] = useState<Tab>(() => {
    try {
      const saved = localStorage.getItem(TAB_KEY);
      // 감춘 탭이 저장돼 있어도 무시하고 보이는 탭으로 시작한다
      if (TABS.some(t => t.id === saved)) return saved as Tab;
    } catch {}
    return DEFAULT_TAB;
  });

  const select = (id: Tab) => {
    setTab(id);
    playClick();
    try { localStorage.setItem(TAB_KEY, id); } catch {}
  };

  return (
    <div style={{ fontFamily: "'Nunito', 'Noto Sans KR', sans-serif" }}>
      {/* 상단 탭 — 보여줄 놀이가 둘 이상일 때만 표시 */}
      {TABS.length > 1 && (
        <div style={{
          position: 'sticky', top: 0, zIndex: 90,
          background: 'rgba(255,255,255,0.92)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
          padding: '8px 12px',
          display: 'flex', justifyContent: 'center',
        }}>
          <div style={{ display: 'flex', gap: 8, width: '100%', maxWidth: 380 }}>
            {TABS.map(t => {
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => select(t.id)}
                  style={{
                    flex: 1, padding: '11px 4px', borderRadius: 14, border: 'none',
                    background: active
                      ? 'linear-gradient(135deg, #667eea, #764ba2)'
                      : '#f0eef8',
                    color: active ? 'white' : '#6b6b7d',
                    fontSize: 15, fontWeight: 800, cursor: 'pointer',
                    fontFamily: 'inherit',
                    boxShadow: active ? '0 4px 12px rgba(118,75,162,0.35)' : 'none',
                    transition: 'all 0.2s',
                  }}
                >
                  {t.emoji} {t.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 화면 — 각 놀이는 서로 독립적으로 동작 */}
      {SHOW_MATH && tab === 'math' ? <MathScreen /> : <AlphabetScreen />}
    </div>
  );
}

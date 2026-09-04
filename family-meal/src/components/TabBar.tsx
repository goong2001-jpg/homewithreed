import React from 'react';
import { View } from '../types';
import { C } from '../theme';

interface Props {
  active: View;
  onChange: (v: View) => void;
}

const TABS: { view: View; icon: string; label: string }[] = [
  { view: 'plan', icon: '🍽️', label: '식단' },
  { view: 'fridge', icon: '🧊', label: '냉장고' },
  { view: 'shopping', icon: '🛒', label: '장보기' },
  { view: 'balance', icon: '🥗', label: '영양' },
  { view: 'settings', icon: '⚙️', label: '설정' },
];

export const TAB_BAR_HEIGHT = 62;

export default function TabBar({ active, onChange }: Props) {
  return (
    <nav
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: TAB_BAR_HEIGHT,
        background: '#fff',
        borderTop: `1px solid ${C.border}`,
        display: 'flex',
        boxShadow: '0 -2px 10px rgba(0,0,0,0.05)',
        paddingBottom: 'env(safe-area-inset-bottom)',
        zIndex: 20,
      }}
    >
      {TABS.map((t) => {
        const on = active === t.view;
        return (
          <button
            key={t.view}
            onClick={() => onChange(t.view)}
            aria-current={on ? 'page' : undefined}
            style={{
              flex: 1,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 3,
              padding: 0,
              color: on ? C.accent : C.muted,
              fontWeight: on ? 700 : 500,
            }}
          >
            <span style={{ fontSize: 20, lineHeight: 1, filter: on ? 'none' : 'grayscale(0.6)' }}>{t.icon}</span>
            <span style={{ fontSize: 11 }}>{t.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

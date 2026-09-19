import React from 'react';
import { View } from '../types';

interface Props {
  active: View;
  onChange: (v: View) => void;
}

const TABS: { view: View; icon: string; label: string }[] = [
  { view: 'home', icon: '🐷', label: '저금통' },
  { view: 'add', icon: '➕', label: '입력' },
  { view: 'history', icon: '📋', label: '내역' },
  { view: 'top', icon: '🏆', label: 'TOP5' },
  { view: 'gifts', icon: '🧧', label: '경조사' },
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
        borderTop: '1px solid #eceff1',
        display: 'flex',
        boxShadow: '0 -2px 10px rgba(0,0,0,0.05)',
        paddingBottom: 'env(safe-area-inset-bottom)',
        zIndex: 20,
      }}
    >
      {TABS.map(t => {
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
              color: on ? '#27ae60' : '#9aa5ab',
              fontWeight: on ? 700 : 500,
            }}
          >
            <span style={{ fontSize: 19, lineHeight: 1, filter: on ? 'none' : 'grayscale(0.6)' }}>
              {t.icon}
            </span>
            {/* 탭이 여섯 개라 작은 폰에서도 글자가 안 잘리게 줄바꿈을 막는다 */}
            <span style={{ fontSize: 10.5, whiteSpace: 'nowrap' }}>{t.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

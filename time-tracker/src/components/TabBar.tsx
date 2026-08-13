import React from 'react';
import { View } from '../types';
import { COLOR } from './ui';

interface Props {
  active: View;
  onChange: (v: View) => void;
  /** 타이머가 돌고 있으면 '오늘' 탭에 점을 찍는다 — 다른 탭에 있어도 보이게 */
  live?: boolean;
}

const TABS: { view: View; icon: string; label: string }[] = [
  { view: 'today', icon: '⏱', label: '오늘' },
  { view: 'stats', icon: '📊', label: '돌아보기' },
  { view: 'categories', icon: '🗂', label: '분류' },
  { view: 'settings', icon: '⚙️', label: '설정' },
];

export const TAB_BAR_HEIGHT = 62;

export default function TabBar({ active, onChange, live }: Props) {
  return (
    <nav
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: TAB_BAR_HEIGHT,
        background: '#fff',
        borderTop: `1px solid ${COLOR.line}`,
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
              color: on ? COLOR.accent : COLOR.faint,
              fontWeight: on ? 700 : 500,
            }}
          >
            <span style={{ position: 'relative', fontSize: 20, lineHeight: 1, filter: on ? 'none' : 'grayscale(0.6)' }}>
              {t.icon}
              {live && t.view === 'today' && (
                <span
                  aria-hidden
                  style={{
                    position: 'absolute', top: -2, right: -6,
                    width: 7, height: 7, borderRadius: '50%',
                    background: COLOR.live,
                    animation: 'live-pulse 1.6s ease-in-out infinite',
                  }}
                />
              )}
            </span>
            <span style={{ fontSize: 11 }}>{t.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

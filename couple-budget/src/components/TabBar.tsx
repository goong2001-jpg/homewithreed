import React from 'react';
import { View } from '../types';

interface Props {
  active: View;
  onChange: (v: View) => void;
}

/** 탭 아이콘 — 24×24, 한 가지 색으로 채운 도형 (이모지는 폰마다 모양·색이 달라서 쓰지 않는다) */
const ICONS: Record<string, string> = {
  home: 'M11.3 3.3a1 1 0 0 1 1.4 0l8 7.4a1 1 0 0 1 .3.7V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-8.600a1 1 0 0 1 .3-.7z',
  add: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm1 5v3h3v2h-3v3h-2v-3H8v-2h3V8z',
  history: 'M6 3h12a1 1 0 0 1 1 1v17l-3.500-2-3.500 2-3.500-2L5 21V4a1 1 0 0 1 1-1zm3 5v2h6V8zm0 4v2h6v-2z',
  gifts: 'M4 9h16v3H4zm1 4h6v8H6a1 1 0 0 1-1-1zm8 0h6v7a1 1 0 0 1-1 1h-5zM12 8C9 3 5 6 8 8zm0 0c3-5 7-2 4 0z',
  settings: 'M10.200 3h3.600l.5 2.500 1.700.9 2.400-.9 1.800 3.100-1.900 1.700v1.900l1.900 1.700-1.800 3.100-2.400-.9-1.700.9-.5 2.500h-3.600l-.5-2.500-1.700-.9-2.400.9-1.800-3.100 1.900-1.700v-1.900L3.800 8.600l1.800-3.100 2.400.9 1.700-.9zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
};

const TABS: { view: View; label: string }[] = [
  { view: 'home', label: '저금통' },
  { view: 'add', label: '입력' },
  { view: 'history', label: '내역' },
  { view: 'gifts', label: '경조사' },
  { view: 'settings', label: '설정' },
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
        borderTop: '1px solid #EEF0F2',
        display: 'flex',
        paddingBottom: 'env(safe-area-inset-bottom)',
        zIndex: 20,
      }}
    >
      {TABS.map(t => {
        // TOP5 는 내역 탭 안의 보기다 — 보고 있는 동안 '내역'에 불이 들어온다
        const on = active === t.view || (t.view === 'history' && active === 'top');
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
              color: on ? '#191F28' : '#B0B8C1',
              fontWeight: 600,
            }}
          >
            <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
              <path d={ICONS[t.view]} fill="currentColor" fillRule="evenodd" />
            </svg>
            <span style={{ fontSize: 10.5, whiteSpace: 'nowrap' }}>{t.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

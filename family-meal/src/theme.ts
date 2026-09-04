import type { CSSProperties } from 'react';

/** 화면 전체가 같은 색을 쓰도록 한곳에 모아 둔다. */
export const C = {
  bg: '#fff8f0',
  card: '#ffffff',
  accent: '#ff8a3d',
  accentSoft: '#fff0e2',
  text: '#2b2018',
  muted: '#9a8b7e',
  border: '#f2e6da',
  good: '#2f9e6f',
  warn: '#e0603c',
} as const;

export const CARD: CSSProperties = {
  background: C.card,
  border: `1px solid ${C.border}`,
  borderRadius: 14,
  padding: 14,
};

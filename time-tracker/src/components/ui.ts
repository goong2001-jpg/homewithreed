import React from 'react';

/**
 * 화면 전체가 공유하는 스타일 값.
 *
 * 이 저장소는 Tailwind도 CSS 모듈도 안 쓰고 인라인 style로만 그린다.
 * 그래서 같은 값이 스무 군데로 흩어지지 않게 여기 모아둔다.
 */

export const COLOR = {
  bg: '#f8f9fa',
  card: '#ffffff',
  line: '#eceff1',
  text: '#222222',
  sub: '#7b8794',
  faint: '#9aa5ab',
  accent: '#6c5ce7',
  /** 진행 중인 타이머 */
  live: '#6c5ce7',
  /** 목표를 지키고 있음 */
  good: '#27ae60',
  /** 넘겼거나 모자람 */
  warn: '#e67e22',
  danger: '#e74c3c',
  /** 아직 아무것도 안 적힌 시간 */
  blank: '#dde3e8',
} as const;

export const card: React.CSSProperties = {
  background: COLOR.card,
  borderRadius: 12,
  boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
  margin: '12px 16px',
  padding: 16,
};

export const sectionTitle: React.CSSProperties = {
  margin: '20px 16px 8px',
  fontSize: 13,
  fontWeight: 700,
  color: COLOR.sub,
  letterSpacing: '-0.2px',
};

/** 목록의 한 줄 — 탭하면 편집 시트가 열린다 */
export const row: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  width: '100%',
  padding: '13px 16px',
  background: 'none',
  border: 'none',
  borderBottom: `1px solid ${COLOR.line}`,
  textAlign: 'left',
  cursor: 'pointer',
  color: COLOR.text,
  font: 'inherit',
};

export const primaryButton: React.CSSProperties = {
  width: '100%',
  padding: '14px 16px',
  borderRadius: 10,
  border: 'none',
  background: COLOR.accent,
  color: '#fff',
  fontSize: 16,
  fontWeight: 700,
  cursor: 'pointer',
};

export const ghostButton: React.CSSProperties = {
  ...primaryButton,
  background: '#eef0fb',
  color: COLOR.accent,
};

export const dangerButton: React.CSSProperties = {
  ...primaryButton,
  background: 'none',
  color: COLOR.danger,
  fontWeight: 600,
  fontSize: 15,
};

/** 점선 테두리의 '＋ 추가' 버튼 */
export const addButton: React.CSSProperties = {
  width: '100%',
  padding: 13,
  borderRadius: 10,
  border: `1px dashed ${COLOR.line}`,
  background: '#fff',
  color: COLOR.sub,
  fontSize: 14,
  cursor: 'pointer',
  font: 'inherit',
};

/** 빈 화면 안내 */
export const empty: React.CSSProperties = {
  padding: '32px 16px',
  textAlign: 'center',
  color: COLOR.faint,
  fontSize: 14,
  lineHeight: 1.7,
};

/** 숫자는 자리가 흔들리지 않게 — 타이머가 1초마다 덜컹거리면 눈에 거슬린다 */
export const tabular: React.CSSProperties = {
  fontVariantNumeric: 'tabular-nums',
};

/** 분류 이름 앞의 색 점 */
export function dot(color: string, size = 9): React.CSSProperties {
  return {
    width: size, height: size, borderRadius: '50%',
    background: color, flexShrink: 0,
  };
}

/** 작은 뱃지 — 목표 달성/미달, '진행 중' 같은 표시 */
export function badge(color: string, background: string): React.CSSProperties {
  return {
    fontSize: 11,
    fontWeight: 700,
    padding: '2px 7px',
    borderRadius: 999,
    whiteSpace: 'nowrap',
    color,
    background,
  };
}

export const okBadge = badge('#1e7e45', '#e8f6ee');
export const missBadge = badge('#b9770e', '#fdf3e3');
export const liveBadge = badge('#4b3fbb', '#eeecfd');

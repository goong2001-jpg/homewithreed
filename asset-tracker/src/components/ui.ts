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
  /** 자산 · 순자산 */
  asset: '#2c3e50',
  /** 부채 · 위험 */
  debt: '#e74c3c',
  /** 이익 */
  plus: '#27ae60',
  accent: '#2c3e50',
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
  background: '#eef1f4',
  color: COLOR.asset,
};

export const dangerButton: React.CSSProperties = {
  ...primaryButton,
  background: 'none',
  color: COLOR.debt,
  fontWeight: 600,
  fontSize: 15,
};

/** 빈 화면 안내 */
export const empty: React.CSSProperties = {
  padding: '32px 16px',
  textAlign: 'center',
  color: COLOR.faint,
  fontSize: 14,
  lineHeight: 1.7,
};

/** D-day 뱃지. 임박할수록 붉어진다 */
export function ddayStyle(dday: number): React.CSSProperties {
  const urgent = dday <= 30;
  const soon = dday <= 90;
  return {
    fontSize: 11,
    fontWeight: 700,
    padding: '2px 7px',
    borderRadius: 999,
    whiteSpace: 'nowrap',
    color: urgent ? '#c0392b' : soon ? '#b9770e' : COLOR.sub,
    background: urgent ? '#fdecea' : soon ? '#fdf3e3' : '#eef1f4',
  };
}

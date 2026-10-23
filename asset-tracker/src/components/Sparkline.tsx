import React from 'react';
import { COLOR } from './ui';

/**
 * 목록 한 줄에 들어가는 작은 추세선 (기본 60×16).
 * 숫자 없이 모양만 보여준다 — 오르는지 내리는지가 한눈에 들어오면 충분하다.
 */
export default function Sparkline(
  { values, width = 60, height = 16 }:
  { values: number[]; width?: number; height?: number },
) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pad = 1.5;
  const pts = values.map((v, i) => {
    const x = pad + (i / (values.length - 1)) * (width - pad * 2);
    const y = pad + (1 - (v - min) / span) * (height - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const up = values[values.length - 1] >= values[0];
  const color = up ? COLOR.plus : COLOR.debt;
  return (
    <svg
      width={width} height={height} viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true" style={{ display: 'block', flexShrink: 0 }}
    >
      <polyline
        points={pts.join(' ')} fill="none" stroke={color}
        strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round"
      />
    </svg>
  );
}

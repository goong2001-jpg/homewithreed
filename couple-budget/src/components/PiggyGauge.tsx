import React, { useId } from 'react';
import { MonthBudget } from '../types';
import { LEVEL_COLOR } from '../utils/budget';
import { signedWon } from '../utils/format';
import {
  BODY_BOTTOM, BODY_H, BODY_TOP, NOSTRIL_DX, NOSTRIL_DY, PIG_BODY, PIG_CRACK,
  PIG_EARS, PIG_EYE, PIG_LEGS, PIG_SLOT, PIG_SNOUT, PIG_TAIL, VIEWBOX, WAVE_PATH,
} from './piggyShapes';

interface Props {
  budget: MonthBudget;
}

/** 채워지는 실루엣(몸통 + 주둥이).
 *  clipPath · 빈 배경 · 외곽선 세 곳에 같은 도형이 필요하다.
 *  (<use href>로 <g>를 clipPath에서 참조하는 건 스펙상 불안정해서 그냥 세 번 그린다) */
function FillShape() {
  return (
    <>
      <ellipse cx={PIG_BODY.cx} cy={PIG_BODY.cy} rx={PIG_BODY.rx} ry={PIG_BODY.ry} />
      <ellipse cx={PIG_SNOUT.cx} cy={PIG_SNOUT.cy} rx={PIG_SNOUT.rx} ry={PIG_SNOUT.ry} />
    </>
  );
}

export default function PiggyGauge({ budget }: Props) {
  // useId 결과에는 콜론이 들어갈 수 있고 url(#...) 참조에서 문제가 되므로 지운다
  const uid = useId().replace(/:/g, '');
  const clipId = `pg-clip-${uid}`;
  const gradId = `pg-grad-${uid}`;

  const color = LEVEL_COLOR[budget.level];
  const over = budget.hasIncome && budget.freeCash < 0;
  const ratio = budget.fillRatio;
  const outline = over ? '#e74c3c' : '#cfd8dc';

  // 채움: 몸통 전체를 덮는 rect를 아래로 밀어 내린다.
  // y/height를 직접 애니메이션하는 것보다 transform 전환이 어디서나 안정적이다.
  const slide = (1 - ratio) * BODY_H;
  const slideStyle: React.CSSProperties = {
    transform: `translateY(${slide}px)`,
    transition: 'transform 650ms cubic-bezier(.22,1,.36,1)',
  };

  const paceY = BODY_BOTTOM - BODY_H * budget.paceRatio;
  const showPace = budget.hasIncome && budget.phase === 'current';

  const label = budget.hasIncome
    ? `저금통 ${Math.round(ratio * 100)}% 남음, 여유돈 ${signedWon(budget.freeCash)}`
    : '수입이 입력되지 않아 저금통이 비어 있습니다';

  return (
    <svg
      viewBox={`0 0 ${VIEWBOX.w} ${VIEWBOX.h}`}
      role="img"
      aria-label={label}
      style={{ width: '100%', display: 'block' }}
    >
      <defs>
        <clipPath id={clipId}><FillShape /></clipPath>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.97" />
          <stop offset="100%" stopColor={color} stopOpacity="0.72" />
        </linearGradient>
      </defs>

      {/* 장식(귀·다리·꼬리) — 몸통 뒤에 먼저 깔아서 자연스럽게 붙어 보이게 */}
      <path d={PIG_EARS} fill={over ? '#fadbd8' : '#e3e8ea'} stroke={outline} strokeWidth="2.4" strokeLinejoin="round" />
      <path d={PIG_LEGS} fill={over ? '#fadbd8' : '#e3e8ea'} stroke={outline} strokeWidth="2.4" strokeLinejoin="round" />
      <path d={PIG_TAIL} fill="none" stroke={outline} strokeWidth="3.4" strokeLinecap="round" />

      {/* 1) 빈 저금통 */}
      <g fill="#eceff1"><FillShape /></g>

      {/* 2) 채워지는 돈 */}
      <g clipPath={`url(#${clipId})`}>
        <g style={slideStyle}>
          <rect x="0" y={BODY_TOP} width={VIEWBOX.w} height={BODY_H + 44} fill={`url(#${gradId})`} />
          {/* 수면 물결 — '돈이 담겨 있다'는 느낌을 준다 */}
          <g style={{ animation: 'piggy-wave 3.6s ease-in-out infinite' }}>
            <path d={WAVE_PATH} transform={`translate(0 ${BODY_TOP - 4})`} fill={color} opacity="0.38" />
          </g>
        </g>

        {/* 3) 오늘까지의 목표선 — 물높이가 이 선보다 위에 있으면 잘하고 있는 것.
               가운데 금액과 겹치지 않게 양쪽 끝에만 짧게 그린다. */}
        {showPace && (
          <>
            <line x1="0" x2="48" y1={paceY} y2={paceY} stroke="#455a64" strokeWidth="2" strokeDasharray="4 3" opacity="0.55" />
            <line x1={VIEWBOX.w - 48} x2={VIEWBOX.w} y1={paceY} y2={paceY} stroke="#455a64" strokeWidth="2" strokeDasharray="4 3" opacity="0.55" />
          </>
        )}
      </g>

      {/* 4) 외곽선 — 채움 위에 덮어 테두리를 항상 선명하게 */}
      <g
        fill="none"
        stroke={outline}
        strokeWidth="3.4"
        style={{ animation: over ? 'piggy-pulse 1.6s ease-in-out infinite' : 'none' }}
      >
        <FillShape />
      </g>

      {/* 5) 얼굴과 투입구 */}
      <rect x={PIG_SLOT.x} y={PIG_SLOT.y} width={PIG_SLOT.w} height={PIG_SLOT.h} rx={PIG_SLOT.r} fill={outline} />
      <circle cx={PIG_EYE.cx} cy={PIG_EYE.cy} r={PIG_EYE.r} fill={over ? '#c0392b' : '#546e7a'} />
      <circle cx={PIG_SNOUT.cx - NOSTRIL_DX} cy={PIG_SNOUT.cy + NOSTRIL_DY} r="2.3" fill={over ? '#c0392b' : '#8fa3ac'} />
      <circle cx={PIG_SNOUT.cx + NOSTRIL_DX} cy={PIG_SNOUT.cy + NOSTRIL_DY} r="2.3" fill={over ? '#c0392b' : '#8fa3ac'} />

      {over && (
        <path d={PIG_CRACK} fill="none" stroke="#e74c3c" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
      )}
    </svg>
  );
}

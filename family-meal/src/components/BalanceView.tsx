import React, { useMemo } from 'react';
import { WeekPlan } from '../types';
import { DAY_NAMES } from '../utils/planner';
import { weekBalance } from '../utils/nutrition';
import { C, CARD } from '../theme';

export default function BalanceView({ plan }: { plan: WeekPlan }) {
  const { checks, proteinCount, minutesPerDay } = useMemo(() => weekBalance(plan), [plan]);
  const maxProtein = Math.max(1, ...proteinCount.map((p) => p.count));
  const maxMinutes = Math.max(1, ...minutesPerDay);

  return (
    <div>
      <h1 style={{ fontSize: 21, margin: '0 0 4px' }}>영양 균형</h1>
      <p style={{ margin: '0 0 14px', fontSize: 12.5, color: C.muted }}>
        칼로리 대신 식품군이 골고루 들어갔는지를 봅니다. 가정식은 계량 오차가 커서 숫자로 재면 오히려 틀립니다.
      </p>

      <div style={{ ...CARD, marginBottom: 12 }}>
        {checks.map((c, i) => (
          <div
            key={c.label}
            style={{
              padding: '11px 0',
              borderTop: i === 0 ? 'none' : `1px solid ${C.border}`,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 15 }}>{c.ok ? '✅' : '⚠️'}</span>
              <span style={{ flex: 1, fontSize: 14.5, fontWeight: 600 }}>{c.label}</span>
              <span style={{ fontSize: 13.5, color: c.ok ? C.good : C.warn, fontWeight: 700 }}>
                {c.value}
                <span style={{ color: C.muted, fontWeight: 500 }}>
                  {' '}
                  / {c.target} {c.direction === 'min' ? '이상' : '이하'}
                </span>
              </span>
            </div>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 4, lineHeight: 1.5 }}>{c.why}</div>
          </div>
        ))}
      </div>

      <div style={{ ...CARD, marginBottom: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>단백질원 (국·메인 14끼)</div>
        {proteinCount.map((p) => (
          <div key={p.protein} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}>
            <span style={{ width: 56, fontSize: 12.5, color: C.muted, flexShrink: 0 }}>{p.label}</span>
            <div style={{ flex: 1, height: 16, background: C.bg, borderRadius: 4, overflow: 'hidden' }}>
              <div
                style={{
                  width: `${(p.count / maxProtein) * 100}%`,
                  height: '100%',
                  background: C.accent,
                  borderRadius: 4,
                }}
              />
            </div>
            <span style={{ width: 24, fontSize: 12.5, textAlign: 'right', flexShrink: 0 }}>{p.count}</span>
          </div>
        ))}
      </div>

      <div style={CARD}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>하루 조리 시간</div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 110 }}>
          {minutesPerDay.map((m, i) => (
            <div key={i} style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: C.muted, marginBottom: 3 }}>{m}</div>
              <div
                style={{
                  height: (m / maxMinutes) * 70,
                  background: m > 90 ? C.warn : C.accent,
                  borderRadius: '4px 4px 0 0',
                }}
              />
              <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>{DAY_NAMES[i]}</div>
            </div>
          ))}
        </div>
        <p style={{ fontSize: 12, color: C.muted, lineHeight: 1.6, margin: '10px 0 0' }}>
          세 끼를 다 만들었을 때 기준입니다. 아침을 사 먹거나 점심 도시락을 쓰면 그만큼 줄어듭니다.
        </p>
      </div>
    </div>
  );
}

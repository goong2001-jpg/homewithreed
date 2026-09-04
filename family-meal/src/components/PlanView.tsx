import React, { useState } from 'react';
import DayCard from './DayCard';
import { getRecipe } from '../data/recipes';
import { Settings, Slot, WeekPlan } from '../types';
import { todayIndex } from '../utils/planner';
import { C } from '../theme';

interface Props {
  plan: WeekPlan;
  settings: Settings;
  onRegenerate: () => void;
  onSwap: (dayIndex: number, slot: Slot) => void;
  onPick: (recipeId: string) => void;
}

export default function PlanView({ plan, settings, onRegenerate, onSwap, onPick }: Props) {
  const today = todayIndex();
  const [open, setOpen] = useState<number | null>(today);

  const totalMinutes = plan.days.reduce(
    (sum, d) =>
      sum +
      [d.breakfast, d.lunch, d.soup, d.main, d.side].reduce(
        (m, id) => m + (getRecipe(id)?.minutes ?? 0),
        0
      ),
    0
  );

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 10,
          marginBottom: 14,
        }}
      >
        <div>
          <h1 style={{ fontSize: 21, margin: 0 }}>이번 주 식단</h1>
          <p style={{ margin: '4px 0 0', fontSize: 12.5, color: C.muted }}>
            {settings.servings}인분 · 일주일 조리 {Math.round(totalMinutes / 60)}시간 남짓
          </p>
        </div>
        <button
          onClick={onRegenerate}
          style={{
            background: C.accent,
            color: '#fff',
            border: 'none',
            borderRadius: 10,
            padding: '9px 13px',
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          다시 추천
        </button>
      </div>

      {plan.days.map((d, i) => (
        <DayCard
          key={d.day}
          plan={d}
          today={i === today}
          open={open === i}
          onToggle={() => setOpen(open === i ? null : i)}
          onPick={onPick}
          onSwap={(slot) => onSwap(i, slot)}
        />
      ))}

      <p style={{ fontSize: 12, color: C.muted, lineHeight: 1.6, margin: '4px 2px 0' }}>
        메뉴를 누르면 재료와 순서, 아기 몫 만드는 법이 나옵니다. 🔄 는 그 한 끼만 다른 메뉴로 바꿉니다.
      </p>
    </div>
  );
}

import React from 'react';
import { getRecipe } from '../data/recipes';
import { DayPlan, Slot } from '../types';
import { cookedRecipeIds, DAY_NAMES, dayRecipeIds } from '../utils/planner';
import { C, CARD } from '../theme';

interface Props {
  plan: DayPlan;
  today: boolean;
  open: boolean;
  onToggle: () => void;
  onPick: (recipeId: string) => void;
  onSwap: (slot: Slot) => void;
  favorites: string[];
}

const ROW_LABEL: Record<Slot, string> = {
  breakfast: '아침',
  onedish: '점심',
  soup: '국',
  main: '메인',
  side: '곁들임',
};

export default function DayCard({ plan, today, open, onToggle, onPick, onSwap, favorites }: Props) {
  const rows = dayRecipeIds(plan);
  // 어제 만들어 둔 반찬은 오늘 조리 시간에 넣지 않는다.
  const minutes = cookedRecipeIds(plan).reduce((sum, r) => sum + (getRecipe(r.id)?.minutes ?? 0), 0);
  const reused = (slot: string) =>
    (slot === 'side' && plan.reusedSide) || (slot === 'breakfast' && plan.reusedBreakfast);
  // 카드를 접었을 때는 그날 저녁 상만 보이면 충분하다.
  const dinner = rows
    .filter((r) => r.slot === 'main' || r.slot === 'soup')
    .map((r) => getRecipe(r.id)?.name)
    .filter(Boolean)
    .join(' · ');

  return (
    <div
      style={{
        ...CARD,
        padding: 0,
        overflow: 'hidden',
        marginBottom: 10,
        borderColor: today ? C.accent : C.border,
      }}
    >
      <button
        onClick={onToggle}
        aria-expanded={open}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '13px 14px',
          background: today ? C.accentSoft : '#fff',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <span
          style={{
            width: 30,
            height: 30,
            borderRadius: 9,
            background: today ? C.accent : C.bg,
            color: today ? '#fff' : C.text,
            fontWeight: 700,
            fontSize: 14,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          {DAY_NAMES[plan.day]}
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: 15, fontWeight: 700 }}>
            {dinner}
            {today && <span style={{ color: C.accent, fontSize: 12, marginLeft: 6 }}>오늘</span>}
          </span>
          <span style={{ display: 'block', fontSize: 12, color: C.muted, marginTop: 2 }}>
            하루 조리 {minutes}분
          </span>
        </span>
        <span style={{ color: C.muted, fontSize: 13 }}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div style={{ padding: '2px 14px 12px' }}>
          {rows.map(({ slot, id }) => {
            const r = getRecipe(id);
            if (!r) return null;
            return (
              <div
                key={slot}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '9px 0',
                  borderTop: `1px solid ${C.border}`,
                }}
              >
                <span style={{ fontSize: 11, color: C.muted, width: 38, flexShrink: 0 }}>{ROW_LABEL[slot]}</span>
                <button
                  onClick={() => onPick(id)}
                  style={{
                    flex: 1,
                    textAlign: 'left',
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    cursor: 'pointer',
                    fontSize: 14.5,
                    color: C.text,
                  }}
                >
                  {r.name}
                  {favorites.includes(r.id) && <span title="잘 먹는 메뉴"> ⭐</span>}
                  {r.spicy && <span title="매운 메뉴"> 🌶</span>}
                  <span style={{ color: C.muted, fontSize: 12 }}>
                    {reused(slot) ? ' · 만들어 둔 것' : ` · ${r.minutes}분`}
                  </span>
                </button>
                <button
                  onClick={() => onSwap(slot)}
                  aria-label={`${ROW_LABEL[slot]} 메뉴 바꾸기`}
                  style={{
                    background: C.bg,
                    border: `1px solid ${C.border}`,
                    borderRadius: 8,
                    width: 30,
                    height: 28,
                    cursor: 'pointer',
                    fontSize: 13,
                    flexShrink: 0,
                  }}
                >
                  🔄
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

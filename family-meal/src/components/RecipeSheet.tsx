import React from 'react';
import { Recipe, SLOT_LABEL } from '../types';
import { formatQty, scaleQty } from '../utils/shopping';
import { C } from '../theme';

interface Props {
  recipe: Recipe;
  servings: number;
  onClose: () => void;
}

const EASE_LABEL = ['', '아주 쉬움', '보통', '손이 좀 감'];

export default function RecipeSheet({ recipe, servings, onClose }: Props) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        zIndex: 40,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        animation: 'fade-in 0.15s ease-out',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={`${recipe.name} 레시피`}
        style={{
          background: '#fff',
          width: '100%',
          maxWidth: 480,
          maxHeight: '88vh',
          overflowY: 'auto',
          borderRadius: '18px 18px 0 0',
          padding: '10px 18px 30px',
          animation: 'sheet-up 0.22s ease-out',
        }}
      >
        <div style={{ width: 40, height: 4, background: C.border, borderRadius: 2, margin: '0 auto 14px' }} />

        <div style={{ fontSize: 12, color: C.accent, fontWeight: 700 }}>{SLOT_LABEL[recipe.slot]}</div>
        <h2 style={{ margin: '4px 0 8px', fontSize: 22 }}>{recipe.name}</h2>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
          <Chip>⏱ {recipe.minutes}분</Chip>
          <Chip>🔪 {EASE_LABEL[recipe.ease]}</Chip>
          {recipe.spicy && <Chip warn>🌶 매움</Chip>}
          {recipe.calcium && <Chip>🦴 칼슘</Chip>}
        </div>

        <Section title={`재료 (${servings}인분)`}>
          <ul style={{ margin: 0, paddingLeft: 0, listStyle: 'none' }}>
            {recipe.ingredients.map((ing) => (
              <li
                key={ing.name}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '7px 0',
                  borderBottom: `1px solid ${C.border}`,
                  fontSize: 14,
                }}
              >
                <span>
                  {ing.name}
                  {ing.pantry && <span style={{ color: C.muted, fontSize: 12 }}> · 양념</span>}
                </span>
                <span style={{ color: C.muted }}>{formatQty(scaleQty(ing.qty, ing.unit, servings), ing.unit)}</span>
              </li>
            ))}
          </ul>
        </Section>

        <Section title="만드는 순서">
          <ol style={{ margin: 0, paddingLeft: 20, lineHeight: 1.7, fontSize: 14 }}>
            {recipe.steps.map((s, i) => (
              <li key={i} style={{ marginBottom: 6 }}>
                {s}
              </li>
            ))}
          </ol>
        </Section>

        <Note icon="👶" title="아기(16개월) 몫" body={recipe.babyTip} bg="#f1f8f4" />
        {recipe.kidTip && <Note icon="🧒" title="7살 팁" body={recipe.kidTip} bg={C.accentSoft} />}

        <button
          onClick={onClose}
          style={{
            width: '100%',
            marginTop: 18,
            padding: '13px 0',
            background: C.accent,
            color: '#fff',
            border: 'none',
            borderRadius: 12,
            fontSize: 15,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          닫기
        </button>
      </div>
    </div>
  );
}

function Chip({ children, warn }: { children: React.ReactNode; warn?: boolean }) {
  return (
    <span
      style={{
        fontSize: 12,
        padding: '4px 9px',
        borderRadius: 20,
        background: warn ? '#fdeceb' : C.accentSoft,
        color: warn ? C.warn : '#b5622c',
        fontWeight: 600,
      }}
    >
      {children}
    </span>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <h3 style={{ fontSize: 14, margin: '0 0 8px', color: C.muted }}>{title}</h3>
      {children}
    </div>
  );
}

function Note({ icon, title, body, bg }: { icon: string; title: string; body: string; bg: string }) {
  return (
    <div style={{ background: bg, borderRadius: 12, padding: 12, marginBottom: 10 }}>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>
        {icon} {title}
      </div>
      <div style={{ fontSize: 13.5, lineHeight: 1.6 }}>{body}</div>
    </div>
  );
}

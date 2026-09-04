import React, { useState } from 'react';
import { QUICK_PICKS } from '../utils/ingredients';
import { C } from '../theme';

interface Props {
  have: string[];
  onChange: (next: string[]) => void;
}

/** 냉장고에 있는 재료를 넣고 빼는 칸. 냉장고 탭이 쓴다. */
export default function IngredientPicker({ have, onChange }: Props) {
  const [draft, setDraft] = useState('');

  const add = (name: string) => {
    const clean = name.trim();
    if (clean.length < 2 || have.includes(clean)) return;
    onChange([...have, clean]);
  };

  const quickPicks = QUICK_PICKS.filter((n) => !have.includes(n));

  return (
    <div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          add(draft);
          setDraft('');
        }}
        style={{ display: 'flex', gap: 7 }}
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="예: 애호박"
          aria-label="냉장고에 있는 재료 추가"
          style={{
            flex: 1,
            padding: '11px 12px',
            borderRadius: 10,
            border: `1px solid ${C.border}`,
            fontSize: 15,
            minWidth: 0,
          }}
        />
        <button
          type="submit"
          style={{
            padding: '0 16px',
            borderRadius: 10,
            border: 'none',
            background: C.accent,
            color: '#fff',
            fontSize: 14,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          추가
        </button>
      </form>

      {have.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: 10 }}>
          {have.map((name) => (
            <button
              key={name}
              onClick={() => onChange(have.filter((n) => n !== name))}
              aria-label={`${name} 빼기`}
              style={{
                padding: '7px 10px 7px 12px',
                borderRadius: 20,
                border: 'none',
                background: C.good,
                color: '#fff',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {name} <span style={{ opacity: 0.75 }}>×</span>
            </button>
          ))}
        </div>
      )}

      {quickPicks.length > 0 && (
        <>
          <div style={{ fontSize: 12, color: C.muted, margin: '12px 0 6px' }}>자주 쓰는 재료</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {quickPicks.map((name) => (
              <button
                key={name}
                onClick={() => add(name)}
                style={{
                  padding: '6px 10px',
                  borderRadius: 20,
                  border: `1px solid ${C.border}`,
                  background: '#fff',
                  color: C.text,
                  fontSize: 12.5,
                  cursor: 'pointer',
                }}
              >
                + {name}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

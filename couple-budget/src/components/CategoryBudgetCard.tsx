import React, { useEffect, useState } from 'react';
import {
  CATEGORIES, CATEGORY_EMOJI, CategoryBudget, ExpenseCategory, budgetIdOf,
} from '../types';
import { formatAmountInput, parseAmountInput } from '../utils/format';

interface Props {
  budgets: CategoryBudget[];
  onSet: (category: ExpenseCategory, monthlyLimit: number) => void;
  cardStyle: React.CSSProperties;
}

/** 저장된 상한을 입력칸 글자로 — 상한이 없으면 빈 칸 */
function textOf(budgets: CategoryBudget[], c: ExpenseCategory): string {
  const b = budgets.find(x => x.id === budgetIdOf(c));
  return b && !b.deleted && b.monthlyLimit > 0 ? formatAmountInput(String(b.monthlyLimit)) : '';
}

/**
 * 설정 — 카테고리마다 한 달 상한. 빈 칸 = 상한 없음.
 * 글자를 칠 때마다 올리지 않고 칸을 벗어날 때(blur) 한 번만 저장한다 —
 * 안 그러면 '2' '20' '200' … 이 전부 클라우드로 올라간다.
 */
export default function CategoryBudgetCard({ budgets, onSet, cardStyle }: Props) {
  const [texts, setTexts] = useState<Record<string, string>>(
    () => Object.fromEntries(CATEGORIES.map(c => [c, textOf(budgets, c)])),
  );
  const [savedAt, setSavedAt] = useState<ExpenseCategory | null>(null);

  // 상대 폰에서 바꾼 값이 넘어오면 입력칸도 따라간다 (치고 있는 칸은 blur 때 덮인다)
  useEffect(() => {
    setTexts(Object.fromEntries(CATEGORIES.map(c => [c, textOf(budgets, c)])));
  }, [budgets]);

  useEffect(() => {
    if (!savedAt) return;
    const t = setTimeout(() => setSavedAt(null), 1500);
    return () => clearTimeout(t);
  }, [savedAt]);

  function commit(c: ExpenseCategory) {
    const next = parseAmountInput(texts[c] ?? '');
    const b = budgets.find(x => x.id === budgetIdOf(c));
    const cur = b && !b.deleted ? b.monthlyLimit : 0;
    if (next === cur) return;
    onSet(c, next);
    setSavedAt(c);
  }

  const setCount = CATEGORIES.filter(c => (texts[c] ?? '') !== '').length;

  return (
    <div style={cardStyle}>
      <h3 style={{ margin: '0 0 4px', fontSize: 15, color: '#333' }}>카테고리 예산</h3>
      <p style={{ margin: '0 0 12px', fontSize: 12.5, color: '#95a5a6', lineHeight: 1.6 }}>
        한 달에 이만큼까지만 쓰고 싶은 카테고리에 금액을 넣어두세요.
        <b> 80%를 넘으면 주황, 넘치면 빨강</b>으로 홈에 보이고, 입력할 때도 알려드려요.
        빈 칸은 상한 없음이에요.
      </p>

      {CATEGORIES.map(c => {
        const on = (texts[c] ?? '') !== '';
        return (
          <div key={c} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '7px 0', borderBottom: '1px solid #f5f5f5',
          }}>
            <label
              htmlFor={`budget-${c}`}
              style={{ flex: 1, fontSize: 14, fontWeight: on ? 600 : 500, color: on ? '#2c3e50' : '#78909c' }}
            >
              {CATEGORY_EMOJI[c]} {c}
              {savedAt === c && (
                <span style={{ fontSize: 11, color: '#27ae60', marginLeft: 6, fontWeight: 600 }}>저장됨</span>
              )}
            </label>
            <div style={{ position: 'relative', width: 150 }}>
              <input
                id={`budget-${c}`}
                type="text"
                inputMode="numeric"
                value={texts[c] ?? ''}
                placeholder="없음"
                onChange={e => setTexts(t => ({ ...t, [c]: formatAmountInput(e.target.value) }))}
                onBlur={() => commit(c)}
                onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                style={{
                  width: '100%', padding: '9px 30px 9px 10px', boxSizing: 'border-box',
                  border: `1.5px solid ${on ? '#cfe9da' : '#e8ecef'}`, borderRadius: 8,
                  fontSize: 14, fontWeight: 700, textAlign: 'right', outline: 'none',
                  color: '#2c3e50', background: on ? '#fff' : '#fafbfc',
                }}
              />
              <span style={{
                position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                fontSize: 12, color: '#b0bec5', pointerEvents: 'none',
              }}>
                원
              </span>
            </div>
          </div>
        );
      })}

      <div style={{ fontSize: 11, color: '#b0bec5', marginTop: 10, lineHeight: 1.6 }}>
        {setCount === 0
          ? '아직 정한 상한이 없어요. 금액을 넣으면 홈에 막대가 생겨요.'
          : `${setCount}개 카테고리에 상한이 있어요. 지우려면 칸을 비우면 돼요.`}
      </div>
    </div>
  );
}

import React, { useState } from 'react';
import { Expense, FixedExpense, IncomeEntry, PERSON_COLORS, Person } from '../types';

interface Props {
  persons: Person[];
  incomes: IncomeEntry[];
  fixed: FixedExpense[];
  expenses: Expense[];
  onSave: (input: { id?: string; name: string; color: string; order: number }) => void;
  onDelete: (id: string) => void;
  cardStyle: React.CSSProperties;
}

export default function PersonsCard({
  persons, incomes, fixed, expenses, onSave, onDelete, cardStyle,
}: Props) {
  const [note, setNote] = useState('');
  const sorted = [...persons].sort((a, b) => a.order - b.order);

  /** 기록이 하나라도 있으면 삭제를 막는다 — 지우면 과거 내역의 주인이 사라진다 */
  function hasRecords(id: string): boolean {
    return incomes.some(r => r.personId === id && !r.deleted)
      || fixed.some(r => r.personId === id && !r.deleted)
      || expenses.some(r => r.personId === id && !r.deleted);
  }

  function rename(p: Person, name: string) {
    onSave({ id: p.id, name, color: p.color, order: p.order });
  }

  function recolor(p: Person, color: string) {
    onSave({ id: p.id, name: p.name, color, order: p.order });
  }

  function add() {
    const used = new Set(persons.map(p => p.color));
    const color = PERSON_COLORS.find(c => !used.has(c)) ?? PERSON_COLORS[0];
    onSave({ name: '새 사람', color, order: persons.length });
  }

  function remove(id: string) {
    if (persons.length <= 1) {
      setNote('최소 한 사람은 있어야 해요.');
      return;
    }
    if (hasRecords(id)) {
      setNote('이 사람의 기록이 있어서 지울 수 없어요. 이름을 바꿔서 쓰세요.');
      return;
    }
    onDelete(id);
    setNote('');
  }

  return (
    <div style={cardStyle}>
      <h3 style={{ margin: '0 0 4px', fontSize: 15, color: '#333' }}>우리 부부</h3>
      <p style={{ margin: '0 0 14px', fontSize: 12.5, color: '#95a5a6', lineHeight: 1.6 }}>
        이름을 바꿔도 지금까지 기록한 내역은 그대로 남아요. 자녀도 추가할 수 있고, 추가하면 배우자 폰에도 넘어갑니다.
      </p>

      {sorted.map(p => (
        <div key={p.id} style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="text"
              value={p.name}
              onChange={e => rename(p, e.target.value)}
              maxLength={10}
              style={{
                flex: 1, padding: '10px 12px', border: '1.5px solid #e0e0e0',
                borderRadius: 8, fontSize: 15, fontWeight: 600, color: p.color,
                boxSizing: 'border-box', outline: 'none',
              }}
            />
            <button
              onClick={() => remove(p.id)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 15, color: '#d0d7da', padding: '6px 8px',
              }}
              aria-label={`${p.name} 삭제`}
            >
              ✕
            </button>
          </div>
          <div style={{ display: 'flex', gap: 7, marginTop: 8 }}>
            {PERSON_COLORS.map(c => (
              <button
                key={c}
                onClick={() => recolor(p, c)}
                aria-label={`색 ${c}`}
                style={{
                  width: 24, height: 24, borderRadius: '50%', background: c,
                  border: p.color === c ? '3px solid #2c3e50' : '2px solid #fff',
                  boxShadow: '0 0 0 1px #e0e0e0', cursor: 'pointer', padding: 0,
                }}
              />
            ))}
          </div>
        </div>
      ))}

      {note && (
        <div style={{
          fontSize: 12.5, color: '#9a7d0a', background: '#fef9e7',
          borderRadius: 8, padding: '9px 12px', marginBottom: 12,
        }}>
          {note}
        </div>
      )}

      <button
        onClick={add}
        style={{
          width: '100%', padding: 11, background: '#f8f9fa',
          border: '1.5px dashed #cfd8dc', borderRadius: 10,
          fontSize: 13.5, fontWeight: 600, color: '#607d8b', cursor: 'pointer',
        }}
      >
        + 사람 추가
      </button>
    </div>
  );
}

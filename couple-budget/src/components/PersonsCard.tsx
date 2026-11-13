import React, { useState } from 'react';
import { Expense, FixedExpense, IncomeEntry, PERSON_COLORS, Person } from '../types';

interface Props {
  persons: Person[];
  incomes: IncomeEntry[];
  fixed: FixedExpense[];
  expenses: Expense[];
  onSave: (input: { id?: string; name: string; color: string; order: number }) => void;
  onDelete: (id: string) => void;
  /** 이 폰 주인 (이 폰에만 저장, 동기화 안 함) */
  ownerId?: string;
  onSetOwner: (id: string) => void;
  cardStyle: React.CSSProperties;
}

export default function PersonsCard({
  persons, incomes, fixed, expenses, onSave, onDelete, ownerId, onSetOwner, cardStyle,
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
      <h3 style={{ margin: '0 0 4px', fontSize: 15, color: '#191F28' }}>우리 부부</h3>
      <p style={{ margin: '0 0 14px', fontSize: 12.5, color: '#8B95A1', lineHeight: 1.6 }}>
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
                flex: 1, padding: '10px 12px', border: '1.5px solid #E5E8EB',
                borderRadius: 12, fontSize: 15, fontWeight: 600, color: p.color,
                boxSizing: 'border-box', outline: 'none',
              }}
            />
            <button
              onClick={() => remove(p.id)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 15, color: '#D1D6DB', padding: '6px 8px',
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
                  border: p.color === c ? '3px solid #191F28' : '2px solid #fff',
                  boxShadow: '0 0 0 1px #E5E8EB', cursor: 'pointer', padding: 0,
                }}
              />
            ))}
          </div>
        </div>
      ))}

      {/* 이 폰 주인 — 입력할 때 '누가' 가 이 사람으로 미리 골라져 있다 */}
      {sorted.length > 1 && (
        <div style={{
          background: '#F9FAFB', borderRadius: 14, padding: '12px 12px 13px', marginBottom: 14,
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#4E5968' }}>이 폰은 누구 폰인가요?</div>
          <div style={{ fontSize: 11.5, color: '#8B95A1', margin: '3px 0 9px', lineHeight: 1.6 }}>
            입력할 때 이 사람이 먼저 골라져 있어요. 이 폰에만 저장되고 배우자 폰에는 안 넘어가요.
          </div>
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
            {sorted.map(p => {
              const on = ownerId === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => onSetOwner(p.id)}
                  aria-pressed={on}
                  style={{
                    padding: '8px 14px', borderRadius: 18, cursor: 'pointer', fontSize: 13,
                    border: `1.5px solid ${on ? p.color : '#E5E8EB'}`,
                    background: on ? `${p.color}14` : '#fff',
                    color: on ? p.color : '#4E5968', fontWeight: on ? 700 : 500,
                  }}
                >
                  {p.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {note && (
        <div style={{
          fontSize: 12.5, color: '#9a7d0a', background: '#fef9e7',
          borderRadius: 12, padding: '9px 12px', marginBottom: 12,
        }}>
          {note}
        </div>
      )}

      <button
        onClick={add}
        style={{
          width: '100%', padding: 11, background: '#F2F4F6',
          border: '1.5px dashed #D1D6DB', borderRadius: 14,
          fontSize: 13.5, fontWeight: 600, color: '#6B7684', cursor: 'pointer',
        }}
      >
        + 사람 추가
      </button>
    </div>
  );
}

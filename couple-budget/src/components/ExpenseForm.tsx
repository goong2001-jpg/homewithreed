import React, { useState } from 'react';
import {
  CATEGORIES, CATEGORY_EMOJI, Expense, ExpenseCategory, MonthBudget, Person,
} from '../types';
import { todayKey } from '../utils/budget';
import { formatAmountInput, parseAmountInput, signedWon, won } from '../utils/format';

interface Props {
  persons: Person[];
  budget: MonthBudget;
  /** 있으면 새로 쓰는 게 아니라 이 내역을 고치는 화면이 된다 */
  initial?: Expense;
  onSave: (input: {
    id?: string;
    date: string; amount: number; category: ExpenseCategory; content: string; personId: string;
  }) => void;
  onDelete?: (id: string) => void;
  onDone: () => void;
}

export default function ExpenseForm({
  persons, budget, initial, onSave, onDelete, onDone,
}: Props) {
  const sorted = [...persons].sort((a, b) => a.order - b.order);
  const editing = !!initial;

  const [amountText, setAmountText] = useState(
    initial ? formatAmountInput(String(initial.amount)) : '',
  );
  const [personId, setPersonId] = useState(initial?.personId ?? sorted[0]?.id ?? 'p1');
  const [category, setCategory] = useState<ExpenseCategory>(initial?.category ?? '식비');
  const [content, setContent] = useState(initial?.content ?? '');
  const [date, setDate] = useState(initial?.date ?? todayKey());
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const amount = parseAmountInput(amountText);
  // 수정할 땐 '이만큼 더/덜 쓰는 것'이므로 원래 금액과의 차이만 반영해야 맞다
  const delta = editing ? amount - initial!.amount : amount;
  const afterFree = budget.freeCash - delta;

  const labelStyle: React.CSSProperties = {
    fontSize: 13, fontWeight: 600, color: '#555', marginBottom: 7, display: 'block',
  };
  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '11px 12px', border: '1.5px solid #e0e0e0',
    borderRadius: 8, fontSize: 15, boxSizing: 'border-box', outline: 'none',
  };

  function handleSubmit() {
    if (amount <= 0) { setError('금액을 입력해주세요.'); return; }
    if (!date) { setError('날짜를 입력해주세요.'); return; }
    onSave({
      id: initial?.id,
      date,
      amount,
      category,
      content: content.trim() || category,
      personId,
    });
    onDone();
  }

  function handleDelete() {
    if (!initial || !onDelete) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 3000);
      return;
    }
    onDelete(initial.id);
    onDone();
  }

  return (
    <div>
      <div style={{
        background: '#fff', padding: '14px 16px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
        position: 'sticky', top: 0, zIndex: 10,
      }}>
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>
          {editing ? '내역 수정' : '쓴 돈 입력'}
        </h2>
      </div>

      <div style={{ padding: '18px 16px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* 금액 — 제일 먼저, 크게 */}
        <div>
          <label style={labelStyle} htmlFor="amount">금액</label>
          <div style={{ position: 'relative' }}>
            <input
              id="amount"
              type="text"
              inputMode="numeric"
              autoFocus
              value={amountText}
              onChange={e => setAmountText(formatAmountInput(e.target.value))}
              placeholder="0"
              style={{
                ...inputStyle,
                fontSize: 30, fontWeight: 800, textAlign: 'right',
                padding: '14px 44px 14px 14px', color: '#e74c3c',
              }}
            />
            <span style={{
              position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)',
              fontSize: 18, fontWeight: 700, color: '#bbb', pointerEvents: 'none',
            }}>
              원
            </span>
          </div>

          {editing && (
            <div style={{ marginTop: 8, fontSize: 12, color: '#95a5a6' }}>
              원래 금액 {won(initial!.amount)}
              {delta !== 0 && (
                <b style={{ color: delta > 0 ? '#e74c3c' : '#27ae60', marginLeft: 6 }}>
                  {delta > 0 ? '+' : '−'}{won(Math.abs(delta))}
                </b>
              )}
            </div>
          )}

          {amount > 0 && budget.hasIncome && delta !== 0 && (
            <div style={{
              marginTop: 9, fontSize: 12.5, color: '#7f8c8d', background: '#f5f7f8',
              borderRadius: 8, padding: '9px 12px', lineHeight: 1.6,
            }}>
              저장하면 여유돈 {signedWon(budget.freeCash)} →{' '}
              <b style={{ color: afterFree < 0 ? '#e74c3c' : '#27ae60' }}>{signedWon(afterFree)}</b>
            </div>
          )}
        </div>

        {/* 누가 썼나 */}
        <div>
          <label style={labelStyle}>누가 썼나요?</label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {sorted.map(p => {
              const on = personId === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => setPersonId(p.id)}
                  style={{
                    flex: 1, minWidth: 90, padding: '12px 10px', borderRadius: 10,
                    border: `2px solid ${on ? p.color : '#e0e0e0'}`,
                    background: on ? `${p.color}14` : '#fff',
                    color: on ? p.color : '#666',
                    fontWeight: on ? 700 : 500, fontSize: 15, cursor: 'pointer',
                  }}
                >
                  {p.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* 카테고리 */}
        <div>
          <label style={labelStyle}>어디에 썼나요?</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {CATEGORIES.map(c => {
              const on = category === c;
              return (
                <button
                  key={c}
                  onClick={() => setCategory(c)}
                  style={{
                    padding: '9px 14px', borderRadius: 20,
                    border: `1.5px solid ${on ? '#27ae60' : '#e0e0e0'}`,
                    background: on ? '#eafaf1' : '#fff',
                    color: on ? '#1e8449' : '#555',
                    fontWeight: on ? 700 : 400, cursor: 'pointer', fontSize: 13,
                  }}
                >
                  {CATEGORY_EMOJI[c]} {c}
                </button>
              );
            })}
          </div>
        </div>

        {/* 내용 */}
        <div>
          <label style={labelStyle} htmlFor="content">내용 <span style={{ color: '#bbb', fontWeight: 400 }}>(선택)</span></label>
          <input
            id="content"
            type="text"
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder={`예: ${category === '식비' ? '점심 김치찌개' : '마트 장보기'}`}
            style={inputStyle}
          />
        </div>

        {/* 날짜 */}
        <div>
          <label style={labelStyle} htmlFor="date">날짜</label>
          <input
            id="date"
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            style={inputStyle}
          />
        </div>

        {error && (
          <div style={{ padding: '10px 14px', background: '#fdedec', borderRadius: 8, color: '#e74c3c', fontSize: 14 }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={onDone}
            style={{
              flex: 1, padding: 15, background: '#f5f5f5', border: 'none', borderRadius: 10,
              fontSize: 15, fontWeight: 600, color: '#666', cursor: 'pointer',
            }}
          >
            취소
          </button>
          <button
            onClick={handleSubmit}
            style={{
              flex: 2, padding: 15, background: '#27ae60', border: 'none', borderRadius: 10,
              fontSize: 15, fontWeight: 700, color: '#fff', cursor: 'pointer',
            }}
          >
            {editing
              ? (amount > 0 ? `${won(amount)}으로 수정` : '수정하기')
              : (amount > 0 ? `${won(amount)} 저장` : '저장하기')}
          </button>
        </div>

        {/* 삭제는 고치러 들어왔을 때만. 실수로 눌리지 않게 두 번 눌러야 지워진다 */}
        {editing && onDelete && (
          <button
            onClick={handleDelete}
            style={{
              width: '100%', padding: 13, borderRadius: 10, cursor: 'pointer',
              border: `1px solid ${confirmDelete ? '#e74c3c' : '#eceff1'}`,
              background: confirmDelete ? '#fdedec' : '#fff',
              color: confirmDelete ? '#e74c3c' : '#78909c',
              fontSize: 13.5, fontWeight: confirmDelete ? 700 : 500,
            }}
          >
            {confirmDelete ? '정말 지울까요? 한 번 더 누르세요' : '이 내역 삭제'}
          </button>
        )}
      </div>
    </div>
  );
}

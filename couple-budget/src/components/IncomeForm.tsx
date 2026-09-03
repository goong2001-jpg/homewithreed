import React, { useState } from 'react';
import { INCOME_MEMO_PRESETS, IncomeEntry, MonthBudget, MonthKey, Person } from '../types';
import { dailyBudgetOf } from '../utils/budget';
import { formatAmountInput, monthLabel, parseAmountInput, won } from '../utils/format';

interface Props {
  /** 지금 보고 있는 달 — 새 수입의 기본값 */
  month: MonthKey;
  persons: Person[];
  budget: MonthBudget;
  /** 있으면 이 수입을 고치는 화면이 된다 */
  initial?: IncomeEntry;
  onSave: (input: {
    id?: string; month: MonthKey; personId: string; amount: number; memo: string;
  }) => void;
  onDelete?: (id: string) => void;
  onDone: () => void;
}

/**
 * 수입 한 건을 넣는 화면.
 *
 * 왜 '한 건'인가: 부업 일당처럼 여러 번 들어오는 돈을 직접 합산해서
 * 한 칸에 적게 하면, 들어올 때마다 계산기를 두드려야 한다.
 * 들어온 대로 한 줄씩 쌓고 합계는 앱이 낸다.
 */
export default function IncomeForm({
  month, persons, budget, initial, onSave, onDelete, onDone,
}: Props) {
  const sorted = [...persons].sort((a, b) => a.order - b.order);
  const editing = !!initial;

  const [amountText, setAmountText] = useState(
    initial ? formatAmountInput(String(initial.amount)) : '',
  );
  const [personId, setPersonId] = useState(initial?.personId ?? sorted[0]?.id ?? 'p1');
  const [memo, setMemo] = useState(initial?.memo ?? '');
  const [targetMonth, setTargetMonth] = useState(initial?.month ?? month);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const amount = parseAmountInput(amountText);
  // 수정이면 원래 금액과의 차액만 늘어난다
  const delta = editing ? amount - initial!.amount : amount;

  // 이 앱의 주인공 숫자가 얼마나 올라가는지 바로 보여준다 —
  // 사용자가 직접 나눗셈하지 않아도 되게 하는 것이 이 화면의 목적이다.
  const sameMonth = targetMonth === budget.month;
  const dailyAfter = dailyBudgetOf(budget.spendable + delta, budget.month);

  const labelStyle: React.CSSProperties = {
    fontSize: 13, fontWeight: 600, color: '#555', marginBottom: 7, display: 'block',
  };
  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '11px 12px', border: '1.5px solid #e0e0e0',
    borderRadius: 8, fontSize: 15, boxSizing: 'border-box', outline: 'none',
  };

  function handleSubmit() {
    if (amount <= 0) { setError('금액을 입력해주세요.'); return; }
    if (!targetMonth) { setError('어느 달 수입인지 골라주세요.'); return; }
    onSave({
      id: initial?.id,
      month: targetMonth,
      personId,
      amount,
      memo: memo.trim() || '수입',
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
    <div style={{ padding: '18px 16px', display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* 금액 */}
      <div>
        <label style={labelStyle} htmlFor="income-amount">받은 금액</label>
        <div style={{ position: 'relative' }}>
          <input
            id="income-amount"
            type="text"
            inputMode="numeric"
            autoFocus
            value={amountText}
            onChange={e => setAmountText(formatAmountInput(e.target.value))}
            placeholder="0"
            style={{
              ...inputStyle,
              fontSize: 30, fontWeight: 800, textAlign: 'right',
              padding: '14px 44px 14px 14px', color: '#27ae60',
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
              <b style={{ color: delta > 0 ? '#27ae60' : '#e74c3c', marginLeft: 6 }}>
                {delta > 0 ? '+' : '−'}{won(Math.abs(delta))}
              </b>
            )}
          </div>
        )}

        {/* 나눗셈은 앱이 한다 */}
        {delta !== 0 && sameMonth && (
          <div style={{
            marginTop: 9, fontSize: 12.5, color: '#7f8c8d', background: '#f5f7f8',
            borderRadius: 8, padding: '9px 12px', lineHeight: 1.6,
          }}>
            저장하면 하루 쓸 수 있는 돈{' '}
            {won(Math.floor(budget.dailyBudget))} →{' '}
            <b style={{ color: '#27ae60' }}>{won(Math.floor(dailyAfter))}</b>
            <div style={{ fontSize: 11, color: '#aaa', marginTop: 3 }}>
              {won(Math.abs(delta))} ÷ {budget.daysInMonth}일
            </div>
          </div>
        )}
      </div>

      {/* 누가 벌었나 */}
      <div>
        <label style={labelStyle}>누가 받았나요?</label>
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

      {/* 무슨 돈인가 — 자주 쓰는 건 눌러서 넣는다 */}
      <div>
        <label style={labelStyle} htmlFor="income-memo">무슨 돈인가요?</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 9 }}>
          {INCOME_MEMO_PRESETS.map(m => {
            const on = memo === m;
            return (
              <button
                key={m}
                onClick={() => setMemo(on ? '' : m)}
                style={{
                  padding: '9px 15px', borderRadius: 20,
                  border: `1.5px solid ${on ? '#27ae60' : '#e0e0e0'}`,
                  background: on ? '#eafaf1' : '#fff',
                  color: on ? '#1e8449' : '#555',
                  fontWeight: on ? 700 : 400, cursor: 'pointer', fontSize: 13,
                }}
              >
                {m}
              </button>
            );
          })}
        </div>
        <input
          id="income-memo"
          type="text"
          value={memo}
          onChange={e => setMemo(e.target.value)}
          placeholder="예: 토요일 일당"
          style={inputStyle}
        />
      </div>

      {/* 어느 달 수입인지 */}
      <div>
        <label style={labelStyle} htmlFor="income-month">어느 달 수입인가요?</label>
        <input
          id="income-month"
          type="month"
          value={targetMonth}
          onChange={e => setTargetMonth(e.target.value)}
          style={inputStyle}
        />
        {!sameMonth && (
          <div style={{ marginTop: 7, fontSize: 12, color: '#f39c12', lineHeight: 1.6 }}>
            지금 보고 있는 달({monthLabel(budget.month)})이 아니라{' '}
            {monthLabel(targetMonth)} 수입으로 저장됩니다.
          </div>
        )}
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
            : (amount > 0 ? `${won(amount)} 더하기` : '수입 더하기')}
        </button>
      </div>

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
          {confirmDelete ? '정말 지울까요? 한 번 더 누르세요' : '이 수입 삭제'}
        </button>
      )}
    </div>
  );
}

import React, { useState } from 'react';
import { CATEGORY_EMOJI, Expense, Person } from '../types';
import { won } from '../utils/format';

interface Props {
  expense: Expense;
  person?: Person;
  /** 줄을 누르면 수정 화면으로 보낸다 */
  onEdit?: (expense: Expense) => void;
  onDelete: (id: string) => void;
}

/** 줄을 누르면 수정, ✕ 두 번 누르면 삭제 — receipt-tracker/src/components/TransactionItem.tsx 방식 */
export default function ExpenseItem({ expense, person, onEdit, onDelete }: Props) {
  const [confirming, setConfirming] = useState(false);

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '0 16px 0 0', borderBottom: '1px solid #f5f5f5',
    }}>
      {/* 금액·메모까지 통째로 누를 수 있게 버튼으로 감싼다 */}
      <button
        onClick={() => onEdit?.(expense)}
        disabled={!onEdit}
        style={{
          flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 12,
          background: 'none', border: 'none', textAlign: 'left',
          padding: '12px 0 12px 16px',
          cursor: onEdit ? 'pointer' : 'default',
          font: 'inherit', color: 'inherit',
        }}
        aria-label={onEdit ? `${expense.content} 수정` : undefined}
      >
        <div style={{
          width: 36, height: 36, borderRadius: 10, background: '#f5f7f8',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 18, flexShrink: 0,
        }}>
          {CATEGORY_EMOJI[expense.category]}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 14.5, fontWeight: 600, color: '#2c3e50',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {expense.content}
          </div>
          <div style={{ fontSize: 11.5, color: '#95a5a6', marginTop: 2, display: 'flex', alignItems: 'center', gap: 5 }}>
            {person && (
              <span style={{
                color: person.color, fontWeight: 700,
                background: `${person.color}14`, borderRadius: 6, padding: '1px 6px',
              }}>
                {person.name}
              </span>
            )}
            <span>{expense.category}</span>
          </div>
        </div>

        <div style={{ fontSize: 15, fontWeight: 700, color: '#e74c3c', flexShrink: 0 }}>
          {won(expense.amount)}
        </div>

        {onEdit && (
          <span style={{ fontSize: 12, color: '#cfd8dc', flexShrink: 0 }}>✎</span>
        )}
      </button>

      <button
        onClick={() => {
          if (confirming) { onDelete(expense.id); return; }
          setConfirming(true);
          setTimeout(() => setConfirming(false), 3000);
        }}
        style={{
          background: confirming ? '#fdedec' : 'none',
          border: 'none', borderRadius: 6, cursor: 'pointer', flexShrink: 0,
          fontSize: confirming ? 11 : 15,
          color: confirming ? '#e74c3c' : '#d0d7da',
          fontWeight: confirming ? 700 : 400,
          padding: confirming ? '5px 8px' : '4px 6px',
        }}
        aria-label={confirming ? '삭제 확인' : '삭제'}
      >
        {confirming ? '삭제?' : '✕'}
      </button>
    </div>
  );
}

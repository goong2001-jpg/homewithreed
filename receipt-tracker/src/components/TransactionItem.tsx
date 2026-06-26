import React, { useState } from 'react';
import { Transaction, Category } from '../types';

const CATEGORY_EMOJI: Record<Category, string> = {
  식비: '🍽️', 교통: '🚌', 쇼핑: '🛍️', 의료: '💊',
  생활: '🏠', 여가: '🎮', 기타: '📌'
};

interface Props {
  transaction: Transaction;
  onDelete: (id: string) => void;
}

export default function TransactionItem({ transaction: t, onDelete }: Props) {
  const [confirming, setConfirming] = useState(false);

  function handleDelete() {
    if (confirming) {
      onDelete(t.id);
    } else {
      setConfirming(true);
      setTimeout(() => setConfirming(false), 2500);
    }
  }

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      padding: '12px 16px',
      background: '#fff',
      borderBottom: '1px solid #f5f5f5',
      gap: 12,
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: 12,
        background: '#f8f9fa',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 20, flexShrink: 0,
      }}>
        {CATEGORY_EMOJI[t.category]}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: '#222', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {t.content}
        </div>
        <div style={{ fontSize: 12, color: '#aaa', marginTop: 2 }}>
          {t.category} · {t.paymentMethod}
        </div>
      </div>

      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: t.type === '지출' ? '#e74c3c' : '#27ae60' }}>
          {t.type === '지출' ? '-' : '+'}{t.amount.toLocaleString('ko-KR')}원
        </div>
      </div>

      <button
        onClick={handleDelete}
        style={{
          background: confirming ? '#e74c3c' : 'none',
          border: 'none',
          color: confirming ? '#fff' : '#ccc',
          cursor: 'pointer',
          fontSize: 16,
          padding: '4px 8px',
          borderRadius: 6,
          flexShrink: 0,
          transition: 'all 0.2s',
        }}
        title={confirming ? '한번 더 누르면 삭제' : '삭제'}
      >
        {confirming ? '삭제?' : '✕'}
      </button>
    </div>
  );
}

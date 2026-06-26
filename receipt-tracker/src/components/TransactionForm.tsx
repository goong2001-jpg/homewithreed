import React, { useState } from 'react';
import { Transaction, Category, TransactionType, PaymentMethod, ExtractedFields } from '../types';

const CATEGORIES: Category[] = ['식비', '교통', '쇼핑', '의료', '생활', '여가', '기타'];
const PAYMENT_METHODS: PaymentMethod[] = ['카드', '현금', '계좌이체', '기타'];

const CATEGORY_EMOJI: Record<Category, string> = {
  식비: '🍽️', 교통: '🚌', 쇼핑: '🛍️', 의료: '💊',
  생활: '🏠', 여가: '🎮', 기타: '📌'
};

interface Props {
  extracted: ExtractedFields;
  onSave: (t: Transaction) => void;
  onCancel: () => void;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

export default function TransactionForm({ extracted, onSave, onCancel }: Props) {
  const [date, setDate] = useState(extracted.date || today());
  const [category, setCategory] = useState<Category>(extracted.category || '기타');
  const [content, setContent] = useState(extracted.content || '');
  const [amount, setAmount] = useState(String(extracted.amount || ''));
  const [type, setType] = useState<TransactionType>(extracted.type || '지출');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(extracted.paymentMethod || '카드');
  const [error, setError] = useState('');

  function handleSubmit() {
    if (!date) { setError('날짜를 입력해주세요.'); return; }
    if (!content.trim()) { setError('내용을 입력해주세요.'); return; }
    const amt = Number(amount);
    if (!amt || amt <= 0) { setError('금액을 올바르게 입력해주세요.'); return; }

    onSave({
      id: crypto.randomUUID(),
      date,
      category,
      content: content.trim(),
      amount: amt,
      type,
      paymentMethod,
      createdAt: Date.now(),
    });
  }

  const labelStyle: React.CSSProperties = { fontSize: 13, fontWeight: 600, color: '#555', marginBottom: 6, display: 'block' };
  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px', border: '1.5px solid #e0e0e0',
    borderRadius: 8, fontSize: 15, boxSizing: 'border-box', outline: 'none',
  };
  const selectStyle: React.CSSProperties = { ...inputStyle, appearance: 'none', background: '#fff', cursor: 'pointer' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <label style={labelStyle}>날짜</label>
        <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inputStyle} />
      </div>

      <div>
        <label style={labelStyle}>카테고리</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {CATEGORIES.map(c => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              style={{
                padding: '8px 14px',
                borderRadius: 20,
                border: `1.5px solid ${category === c ? '#3498db' : '#e0e0e0'}`,
                background: category === c ? '#ebf5fb' : '#fff',
                color: category === c ? '#2980b9' : '#555',
                fontWeight: category === c ? 700 : 400,
                cursor: 'pointer',
                fontSize: 13,
              }}
            >
              {CATEGORY_EMOJI[c]} {c}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label style={labelStyle}>내용</label>
        <input
          type="text"
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder="예: 스타벅스 아메리카노"
          style={inputStyle}
        />
      </div>

      <div>
        <label style={labelStyle}>금액 (원)</label>
        <input
          type="number"
          value={amount}
          onChange={e => setAmount(e.target.value)}
          placeholder="0"
          min="0"
          style={inputStyle}
        />
      </div>

      <div>
        <label style={labelStyle}>유형</label>
        <div style={{ display: 'flex', gap: 8 }}>
          {(['지출', '입금'] as TransactionType[]).map(t => (
            <button
              key={t}
              onClick={() => setType(t)}
              style={{
                flex: 1,
                padding: '10px',
                borderRadius: 8,
                border: `1.5px solid ${type === t ? (t === '지출' ? '#e74c3c' : '#27ae60') : '#e0e0e0'}`,
                background: type === t ? (t === '지출' ? '#fdedec' : '#eafaf1') : '#fff',
                color: type === t ? (t === '지출' ? '#e74c3c' : '#27ae60') : '#555',
                fontWeight: type === t ? 700 : 400,
                cursor: 'pointer',
                fontSize: 15,
              }}
            >
              {t === '지출' ? '💸 지출' : '💰 입금'}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label style={labelStyle}>결제수단</label>
        <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value as PaymentMethod)} style={selectStyle}>
          {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>

      {error && (
        <div style={{ padding: '10px 14px', background: '#fdedec', borderRadius: 8, color: '#e74c3c', fontSize: 14 }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
        <button
          onClick={onCancel}
          style={{
            flex: 1, padding: '14px', background: '#f5f5f5', border: 'none',
            borderRadius: 10, fontSize: 15, fontWeight: 600, color: '#666', cursor: 'pointer',
          }}
        >
          취소
        </button>
        <button
          onClick={handleSubmit}
          style={{
            flex: 2, padding: '14px', background: '#3498db', border: 'none',
            borderRadius: 10, fontSize: 15, fontWeight: 600, color: '#fff', cursor: 'pointer',
          }}
        >
          저장하기
        </button>
      </div>
    </div>
  );
}

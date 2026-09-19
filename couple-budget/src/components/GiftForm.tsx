import React, { useState } from 'react';
import {
  GIFT_KIND_DEFAULT_DIRECTION, GIFT_KIND_EMOJI, GIFT_KINDS,
  GiftDirection, GiftEntry, GiftKind, Person,
} from '../types';
import { todayKey } from '../utils/budget';
import { formatAmountInput, parseAmountInput, won } from '../utils/format';

interface Props {
  persons: Person[];
  /** 있으면 이 기록을 고치는 화면이 된다 */
  initial?: GiftEntry;
  /** 새로 적을 때 미리 골라둘 방향 ('받았어요' 버튼으로 들어온 경우) */
  defaultDirection?: GiftDirection;
  onSave: (input: {
    id?: string; date: string; direction: GiftDirection; amount: number;
    kind: GiftKind; counterparty: string; personId: string; memo: string;
  }) => void;
  onDelete?: (id: string) => void;
  onDone: () => void;
}

export default function GiftForm({
  persons, initial, defaultDirection, onSave, onDelete, onDone,
}: Props) {
  const sorted = [...persons].sort((a, b) => a.order - b.order);
  const editing = !!initial;

  const [direction, setDirection] = useState<GiftDirection>(
    initial?.direction ?? defaultDirection ?? 'out',
  );
  const [amountText, setAmountText] = useState(
    initial ? formatAmountInput(String(initial.amount)) : '',
  );
  const [kind, setKind] = useState<GiftKind>(initial?.kind ?? (
    (defaultDirection ?? 'out') === 'in' ? '용돈' : '축의금'
  ));
  const [counterparty, setCounterparty] = useState(initial?.counterparty ?? '');
  const [personId, setPersonId] = useState(initial?.personId ?? sorted[0]?.id ?? 'p1');
  const [date, setDate] = useState(initial?.date ?? todayKey());
  const [memo, setMemo] = useState(initial?.memo ?? '');
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const amount = parseAmountInput(amountText);
  const inbound = direction === 'in';
  const tone = inbound ? '#27ae60' : '#e74c3c';

  const labelStyle: React.CSSProperties = {
    fontSize: 13, fontWeight: 600, color: '#555', marginBottom: 7, display: 'block',
  };
  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '11px 12px', border: '1.5px solid #e0e0e0',
    borderRadius: 8, fontSize: 15, boxSizing: 'border-box', outline: 'none',
  };

  /** 종류를 고르면 방향도 같이 맞춰준다 — 부의금인데 '받음'으로 남아있으면 틀린 기록이 된다 */
  function pickKind(k: GiftKind) {
    setKind(k);
    if (!editing) setDirection(GIFT_KIND_DEFAULT_DIRECTION[k]);
  }

  function handleSubmit() {
    if (amount <= 0) { setError('금액을 입력해주세요.'); return; }
    if (!counterparty.trim()) {
      setError(inbound ? '누구에게 받았는지 적어주세요.' : '누구에게 냈는지 적어주세요.');
      return;
    }
    if (!date) { setError('날짜를 입력해주세요.'); return; }
    onSave({
      id: initial?.id,
      date,
      direction,
      amount,
      kind,
      counterparty: counterparty.trim(),
      personId,
      memo: memo.trim(),
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

  const dirTab = (d: GiftDirection, color: string): React.CSSProperties => ({
    flex: 1, padding: '11px 0', borderRadius: 9, cursor: 'pointer', fontSize: 14.5,
    border: 'none',
    background: direction === d ? '#fff' : 'transparent',
    color: direction === d ? color : '#90a4ae',
    fontWeight: direction === d ? 700 : 500,
    boxShadow: direction === d ? '0 1px 3px rgba(0,0,0,0.12)' : 'none',
  });

  return (
    <div>
      <div style={{
        background: '#fff', padding: '14px 16px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
        position: 'sticky', top: 0, zIndex: 10,
      }}>
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>
          {editing ? '경조사 수정' : '경조사 · 용돈 적기'}
        </h2>
      </div>

      <div style={{ padding: '18px 16px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* 받았나 냈나 — 이걸 먼저 정해야 나머지 문구가 말이 된다 */}
        <div style={{
          display: 'flex', gap: 4, padding: 4, background: '#f1f3f5', borderRadius: 11,
        }}>
          <button onClick={() => setDirection('in')} style={dirTab('in', '#27ae60')}>
            받았어요
          </button>
          <button onClick={() => setDirection('out')} style={dirTab('out', '#e74c3c')}>
            냈어요
          </button>
        </div>

        {/* 금액 */}
        <div>
          <label style={labelStyle} htmlFor="gift-amount">금액</label>
          <div style={{ position: 'relative' }}>
            <input
              id="gift-amount"
              type="text"
              inputMode="numeric"
              autoFocus
              value={amountText}
              onChange={e => setAmountText(formatAmountInput(e.target.value))}
              placeholder="0"
              style={{
                ...inputStyle,
                fontSize: 30, fontWeight: 800, textAlign: 'right',
                padding: '14px 44px 14px 14px', color: tone,
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
            </div>
          )}
        </div>

        {/* 종류 */}
        <div>
          <label style={labelStyle}>어떤 돈인가요?</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {GIFT_KINDS.map(k => {
              const on = kind === k;
              return (
                <button
                  key={k}
                  onClick={() => pickKind(k)}
                  style={{
                    padding: '9px 14px', borderRadius: 20,
                    border: `1.5px solid ${on ? '#607d8b' : '#e0e0e0'}`,
                    background: on ? '#eceff1' : '#fff',
                    color: on ? '#37474f' : '#555',
                    fontWeight: on ? 700 : 400, cursor: 'pointer', fontSize: 13,
                  }}
                >
                  {GIFT_KIND_EMOJI[k]} {k}
                </button>
              );
            })}
          </div>
        </div>

        {/* 상대방 — 나중에 이름으로 찾는 게 이 장부의 핵심이라 필수로 받는다 */}
        <div>
          <label style={labelStyle} htmlFor="gift-who">
            {inbound ? '누구에게 받았나요?' : '누구에게 냈나요?'}
          </label>
          <input
            id="gift-who"
            type="text"
            value={counterparty}
            onChange={e => setCounterparty(e.target.value)}
            placeholder={inbound ? '예: 외할머니' : '예: 김철수 결혼'}
            style={inputStyle}
          />
          <div style={{ marginTop: 6, fontSize: 11.5, color: '#b0bec5', lineHeight: 1.6 }}>
            이름을 적어두면 나중에 검색해서 "그때 얼마 했더라"를 바로 찾을 수 있어요.
          </div>
        </div>

        {/* 우리집 누구 */}
        <div>
          <label style={labelStyle}>
            {inbound ? '누가 받았나요?' : '누가 냈나요?'}
          </label>
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

        {/* 날짜 */}
        <div>
          <label style={labelStyle} htmlFor="gift-date">날짜</label>
          <input
            id="gift-date"
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            style={inputStyle}
          />
        </div>

        {/* 메모 */}
        <div>
          <label style={labelStyle} htmlFor="gift-memo">
            메모 <span style={{ color: '#bbb', fontWeight: 400 }}>(선택)</span>
          </label>
          <input
            id="gift-memo"
            type="text"
            value={memo}
            onChange={e => setMemo(e.target.value)}
            placeholder="예: 회사 동기, 부부 같이 감"
            style={inputStyle}
          />
        </div>

        {error && (
          <div style={{
            padding: '10px 14px', background: '#fdedec', borderRadius: 8,
            color: '#e74c3c', fontSize: 14,
          }}>
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
              : (amount > 0 ? `${won(amount)} 기록하기` : '기록하기')}
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
            {confirmDelete ? '정말 지울까요? 한 번 더 누르세요' : '이 기록 삭제'}
          </button>
        )}

        <div style={{
          fontSize: 11.5, color: '#c5ced2', textAlign: 'center', lineHeight: 1.8,
        }}>
          경조사·용돈은 저금통(하루 쓸 수 있는 돈)에 들어가지 않아요.
          <br />생활비와 섞이지 않게 따로 적어두는 장부입니다.
        </div>
      </div>
    </div>
  );
}

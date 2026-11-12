import React, { useEffect, useRef, useState } from 'react';
import {
  CATEGORIES, CATEGORY_EMOJI, Expense, ExpenseCategory, FrequentExpense, MonthBudget, Person,
} from '../types';
import { daysAgoKey, todayKey } from '../utils/budget';
import { formatAmountInput, parseAmountInput, shortWon, signedWon, won } from '../utils/format';

interface Props {
  persons: Person[];
  budget: MonthBudget;
  /** 있으면 새로 쓰는 게 아니라 이 내역을 고치는 화면이 된다 */
  initial?: Expense;
  /**
   * '자주 쓰는 지출' 칩을 눌렀을 때 — 칸만 채우고 저장 버튼에 초점을 준다.
   * seq 는 같은 칩을 두 번 눌러도 다시 채워지게 하는 일련번호.
   */
  preset?: { item: FrequentExpense; seq: number };
  /** 이 폰 주인 — 새로 쓸 때 '누가' 의 기본값 (없으면 첫 번째 사람) */
  defaultPersonId?: string;
  /** 고른 사람을 이 폰 주인으로 기억시킨다 */
  onSetOwner?: (personId: string) => void;
  /** 홈의 '입력이 빠진 날'에서 넘어왔을 때 미리 채울 날짜 */
  initialDate?: string;
  onSave: (input: {
    id?: string;
    date: string; amount: number; category: ExpenseCategory; content: string; personId: string;
  }) => void;
  onDelete?: (id: string) => void;
  onDone: () => void;
}

export default function ExpenseForm({
  persons, budget, initial, preset, defaultPersonId, onSetOwner, initialDate,
  onSave, onDelete, onDone,
}: Props) {
  const sorted = [...persons].sort((a, b) => a.order - b.order);
  const editing = !!initial;

  const [amountText, setAmountText] = useState(
    initial ? formatAmountInput(String(initial.amount)) : '',
  );
  const [personId, setPersonId] = useState(
    initial?.personId ?? defaultPersonId ?? sorted[0]?.id ?? 'p1',
  );
  const [category, setCategory] = useState<ExpenseCategory>(initial?.category ?? '식비');
  const [content, setContent] = useState(initial?.content ?? '');
  const [date, setDate] = useState(initial?.date ?? initialDate ?? todayKey());
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const saveRef = useRef<HTMLButtonElement>(null);
  const amountRef = useRef<HTMLInputElement>(null);
  /** '저장 후 하나 더'로 이 화면에서 연달아 적은 건수 */
  const [savedCount, setSavedCount] = useState(0);

  // 칩을 누르면 오늘 날짜로 칸을 채우고 저장 버튼에 초점 — 저장은 사용자가 한 번 더 누른다
  useEffect(() => {
    if (!preset) return;
    const it = preset.item;
    setAmountText(formatAmountInput(String(it.amount)));
    setCategory(it.category);
    setContent(it.content);
    if (persons.some(p => p.id === it.personId)) setPersonId(it.personId);
    setDate(todayKey());
    setError('');
    saveRef.current?.focus();
    // persons 는 초점 대상이 아니라 일부러 뺀다 — 칩을 눌렀을 때만 돈다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset?.seq]);

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

  /** again = 저장하고 이 화면에 남아 다음 건을 적는다 (저녁에 몰아 적을 때) */
  function handleSubmit(again = false) {
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
    if (!again) { onDone(); return; }
    // 사람·날짜·카테고리는 그대로 둔다 — 몰아 적을 땐 대개 같은 날, 같은 사람이다
    setAmountText('');
    setContent('');
    setError('');
    setSavedCount(n => n + 1);
    amountRef.current?.focus();
    window.scrollTo({ top: 0 });
  }

  const today = todayKey();
  const now = new Date();
  const quickDates = [
    { label: '오늘', value: today },
    { label: '어제', value: daysAgoKey(now, 1) },
    { label: '그제', value: daysAgoKey(now, 2) },
  ];
  // 기본으로 골라진 사람과 다른 사람을 골랐을 때만 '이 폰 주인으로 기억'을 권한다
  const ownerUnset = !editing && !!onSetOwner && sorted.length > 1 && personId !== defaultPersonId;

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

  // 화면 제목과 지출/수입 전환은 AddView 가 들고 있다 — 여기는 지출 입력칸만 그린다
  return (
    <div style={{ padding: '18px 16px', display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* 금액 — 제일 먼저, 크게 */}
      <div>
        <label style={labelStyle} htmlFor="amount">금액</label>
        <div style={{ position: 'relative' }}>
          <input
            id="amount"
            ref={amountRef}
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

      {/* 날짜 — 오늘·어제·그제는 한 번에, 그 밖의 날은 달력으로 */}
      <div>
        <label style={labelStyle} htmlFor="date">언제 썼나요?</label>
        <div style={{ display: 'flex', gap: 7, alignItems: 'stretch' }}>
          {quickDates.map(q => {
            const on = date === q.value;
            return (
              <button
                key={q.label}
                onClick={() => setDate(q.value)}
                aria-pressed={on}
                style={{
                  flexShrink: 0, padding: '0 13px', borderRadius: 8, cursor: 'pointer',
                  border: `1.5px solid ${on ? '#27ae60' : '#e0e0e0'}`,
                  background: on ? '#eafaf1' : '#fff',
                  color: on ? '#1e8449' : '#555',
                  fontWeight: on ? 700 : 500, fontSize: 13.5,
                }}
              >
                {q.label}
              </button>
            );
          })}
          <input
            id="date"
            type="date"
            aria-label="날짜 직접 고르기"
            value={date}
            onChange={e => setDate(e.target.value)}
            style={{ ...inputStyle, flex: 1, minWidth: 0, padding: '10px 8px', fontSize: 14 }}
          />
        </div>
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
        {/* 이 폰에서 늘 같은 사람이 적는다면 한 번만 정해두면 된다 (이 폰에만 저장) */}
        {ownerUnset && (
          <button
            onClick={() => onSetOwner!(personId)}
            style={{
              marginTop: 8, padding: '7px 11px', borderRadius: 8, cursor: 'pointer',
              border: '1px dashed #cfd8dc', background: '#fafbfc',
              color: '#607d8b', fontSize: 12,
            }}
          >
            이 폰은 늘 <b>{sorted.find(p => p.id === personId)?.name}</b>(으)로 시작하기
          </button>
        )}
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
        <label style={labelStyle} htmlFor="content">
          내용 <span style={{ color: '#bbb', fontWeight: 400 }}>(선택)</span>
        </label>
        <input
          id="content"
          type="text"
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder={`예: ${category === '식비' ? '점심 김치찌개' : '마트 장보기'}`}
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

      {savedCount > 0 && (
        <div style={{ fontSize: 12.5, color: '#1e8449', textAlign: 'center', marginBottom: -8 }}>
          이 화면에서 {savedCount}건 저장했어요
        </div>
      )}

      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={onDone}
          style={{
            flex: 1, padding: '15px 4px', background: '#f5f5f5', border: 'none', borderRadius: 10,
            fontSize: 14.5, fontWeight: 600, color: '#666', cursor: 'pointer',
          }}
        >
          {savedCount > 0 ? '그만 적기' : '취소'}
        </button>
        {/* 저장하고 이 화면에 남는다 — 여러 건을 몰아 적을 때 */}
        {!editing && (
          <button
            onClick={() => handleSubmit(true)}
            style={{
              flex: 1.3, padding: '15px 4px', background: '#fff', borderRadius: 10,
              border: '1.5px solid #27ae60', color: '#1e8449',
              fontSize: 14.5, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
            }}
          >
            저장 후 하나 더
          </button>
        )}
        <button
          ref={saveRef}
          onClick={() => handleSubmit()}
          style={{
            flex: 1.6, padding: '15px 4px', background: '#27ae60', border: 'none', borderRadius: 10,
            fontSize: 14.5, fontWeight: 700, color: '#fff', cursor: 'pointer', whiteSpace: 'nowrap',
          }}
        >
          {editing
            ? (amount > 0 ? `${won(amount)}으로 수정` : '수정하기')
            : (amount > 0 ? `${shortWon(amount)} 저장` : '저장하기')}
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
  );
}

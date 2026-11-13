import React, { useState } from 'react';
import { FixedExpense, MonthKey, Person } from '../types';
import { activeFixed } from '../utils/budget';
import { formatAmountInput, monthLabel, parseAmountInput, won } from '../utils/format';

interface Props {
  month: MonthKey;
  persons: Person[];
  fixed: FixedExpense[];
  onSave: (input: {
    id?: string; name: string; amount: number;
    startMonth: MonthKey; endMonth: MonthKey | null; personId: string | null;
  }) => void;
  onDelete: (id: string) => void;
  cardStyle: React.CSSProperties;
}

const SUGGESTIONS = ['월세', '관리비', '보험료', '통신비', '대출이자', '적금', '구독료'];

export default function FixedExpenseCard({
  month, persons, fixed, onSave, onDelete, cardStyle,
}: Props) {
  const [editing, setEditing] = useState<FixedExpense | 'new' | null>(null);

  const rows = activeFixed(fixed, month);
  const total = rows.reduce((s, f) => s + f.amount, 0);
  const nameOf = (id: string | null) =>
    (id ? persons.find(p => p.id === id)?.name : null) ?? '공동';

  return (
    <div style={cardStyle}>
      <h3 style={{ margin: '0 0 4px', fontSize: 15, color: '#191F28' }}>고정지출</h3>
      <p style={{ margin: '0 0 14px', fontSize: 12.5, color: '#8B95A1', lineHeight: 1.6 }}>
        매달 똑같이 나가는 돈이에요. 한 번 등록하면 매달 자동으로 계산되고,
        <b> 하루 수입을 계산할 때 먼저 빠집니다.</b>
      </p>

      {rows.length === 0 && !editing && (
        <div style={{
          padding: '18px 14px', background: '#F9FAFB', borderRadius: 14,
          fontSize: 13, color: '#B0B8C1', textAlign: 'center',
        }}>
          등록된 고정지출이 없어요
        </div>
      )}

      {rows.map(f => (
        <div key={f.id} style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '11px 0', borderBottom: '1px solid #F2F4F6',
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#191F28' }}>{f.name}</div>
            <div style={{ fontSize: 11, color: '#8B95A1', marginTop: 2 }}>
              {monthLabel(f.startMonth)}부터 {f.endMonth ? `${monthLabel(f.endMonth)}까지` : '계속'}
              {f.personId && ` · ${nameOf(f.personId)}`}
            </div>
          </div>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#6B7684' }}>{won(f.amount)}</span>
          <button
            onClick={() => setEditing(f)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 12, color: '#8B95A1', padding: '4px 6px',
            }}
          >
            수정
          </button>
        </div>
      ))}

      {rows.length > 0 && (
        <div style={{
          display: 'flex', justifyContent: 'space-between',
          paddingTop: 12, fontSize: 13.5, fontWeight: 700, color: '#191F28',
        }}>
          <span>{monthLabel(month)} 합계</span>
          <span>{won(total)}</span>
        </div>
      )}

      {editing ? (
        <FixedForm
          key={editing === 'new' ? 'new' : editing.id}
          initial={editing === 'new' ? null : editing}
          month={month}
          persons={persons}
          onSave={input => { onSave(input); setEditing(null); }}
          onDelete={id => { onDelete(id); setEditing(null); }}
          onCancel={() => setEditing(null)}
        />
      ) : (
        <button
          onClick={() => setEditing('new')}
          style={{
            marginTop: 14, width: '100%', padding: 12, background: '#F2F4F6',
            border: '1.5px dashed #D1D6DB', borderRadius: 14,
            fontSize: 14, fontWeight: 600, color: '#6B7684', cursor: 'pointer',
          }}
        >
          + 고정지출 추가
        </button>
      )}
    </div>
  );
}

function FixedForm({
  initial, month, persons, onSave, onDelete, onCancel,
}: {
  initial: FixedExpense | null;
  month: MonthKey;
  persons: Person[];
  onSave: Props['onSave'];
  onDelete: (id: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [amountText, setAmountText] = useState(
    initial ? initial.amount.toLocaleString('ko-KR') : '',
  );
  const [startMonth, setStartMonth] = useState(initial?.startMonth ?? month);
  const [ongoing, setOngoing] = useState(initial ? initial.endMonth === null : true);
  const [endMonth, setEndMonth] = useState(initial?.endMonth ?? month);
  const [personId, setPersonId] = useState<string | null>(initial?.personId ?? null);
  const [error, setError] = useState('');

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px', border: '1.5px solid #E5E8EB',
    borderRadius: 12, fontSize: 14, boxSizing: 'border-box', outline: 'none',
  };
  const labelStyle: React.CSSProperties = {
    fontSize: 12, fontWeight: 600, color: '#6B7684', marginBottom: 5, display: 'block',
  };

  function submit() {
    const amount = parseAmountInput(amountText);
    if (!name.trim()) { setError('이름을 입력해주세요.'); return; }
    if (amount <= 0) { setError('금액을 입력해주세요.'); return; }
    if (!ongoing && endMonth < startMonth) { setError('종료월이 시작월보다 앞설 수 없어요.'); return; }
    onSave({
      id: initial?.id,
      name: name.trim(),
      amount,
      startMonth,
      endMonth: ongoing ? null : endMonth,
      personId,
    });
  }

  return (
    <div style={{
      marginTop: 14, padding: 14, background: '#F9FAFB',
      border: '1px solid #F2F4F6', borderRadius: 14,
      display: 'flex', flexDirection: 'column', gap: 12,
    }}>
      <div>
        <label style={labelStyle}>이름</label>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="예: 월세"
          style={inputStyle}
        />
        {!initial && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
            {SUGGESTIONS.map(s => (
              <button
                key={s}
                onClick={() => setName(s)}
                style={{
                  fontSize: 11.5, padding: '5px 10px', borderRadius: 14,
                  border: '1px solid #E5E8EB', background: '#fff', color: '#8B95A1', cursor: 'pointer',
                }}
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      <div>
        <label style={labelStyle}>금액 (매달)</label>
        <input
          type="text"
          inputMode="numeric"
          value={amountText}
          onChange={e => setAmountText(formatAmountInput(e.target.value))}
          placeholder="0"
          style={{ ...inputStyle, textAlign: 'right', fontWeight: 700 }}
        />
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>시작월</label>
          <input
            type="month"
            value={startMonth}
            onChange={e => setStartMonth(e.target.value)}
            style={inputStyle}
          />
        </div>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>종료월</label>
          {ongoing ? (
            <button
              onClick={() => setOngoing(false)}
              style={{ ...inputStyle, textAlign: 'left', color: '#8B95A1', cursor: 'pointer', background: '#fff' }}
            >
              계속 (눌러서 지정)
            </button>
          ) : (
            <div style={{ display: 'flex', gap: 4 }}>
              <input
                type="month"
                value={endMonth}
                onChange={e => setEndMonth(e.target.value)}
                style={inputStyle}
              />
              <button
                onClick={() => setOngoing(true)}
                style={{
                  border: '1.5px solid #E5E8EB', borderRadius: 12, background: '#fff',
                  color: '#8B95A1', cursor: 'pointer', fontSize: 12, padding: '0 8px', flexShrink: 0,
                }}
                aria-label="종료월 지정 해제"
              >
                ✕
              </button>
            </div>
          )}
        </div>
      </div>

      <div>
        <label style={labelStyle}>누가 부담하나요?</label>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {[{ id: null, name: '공동', color: '#6B7684' }, ...persons].map(p => {
            const on = personId === p.id;
            return (
              <button
                key={p.id ?? 'shared'}
                onClick={() => setPersonId(p.id)}
                style={{
                  padding: '8px 13px', borderRadius: 18, fontSize: 12.5, cursor: 'pointer',
                  border: `1.5px solid ${on ? p.color : '#E5E8EB'}`,
                  background: on ? `${p.color}14` : '#fff',
                  color: on ? p.color : '#4E5968',
                  fontWeight: on ? 700 : 400,
                }}
              >
                {p.name}
              </button>
            );
          })}
        </div>
      </div>

      {error && (
        <div style={{ fontSize: 12.5, color: '#F04452', background: '#FFEEF0', borderRadius: 12, padding: '9px 12px' }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8 }}>
        {initial && (
          <button
            onClick={() => onDelete(initial.id)}
            style={{
              padding: '12px 14px', background: '#FFEEF0', border: 'none', borderRadius: 12,
              fontSize: 13, fontWeight: 600, color: '#F04452', cursor: 'pointer',
            }}
          >
            삭제
          </button>
        )}
        <button
          onClick={onCancel}
          style={{
            flex: 1, padding: 12, background: '#F2F4F6', border: 'none', borderRadius: 12,
            fontSize: 13.5, fontWeight: 600, color: '#4E5968', cursor: 'pointer',
          }}
        >
          취소
        </button>
        <button
          onClick={submit}
          style={{
            flex: 1.6, padding: 12, background: '#12B76A', border: 'none', borderRadius: 12,
            fontSize: 13.5, fontWeight: 700, color: '#fff', cursor: 'pointer',
          }}
        >
          저장
        </button>
      </div>
    </div>
  );
}

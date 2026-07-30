import React, { useState } from 'react';
import { IncomeEntry, MonthKey, Person } from '../types';
import { addMonths, alive, daysInMonth } from '../utils/budget';
import { formatAmountInput, monthLabel, parseAmountInput, won } from '../utils/format';

interface Props {
  month: MonthKey;
  persons: Person[];
  incomes: IncomeEntry[];
  totalFixed: number;
  onSave: (input: { id?: string; month: MonthKey; personId: string; amount: number; memo: string }) => void;
  cardStyle: React.CSSProperties;
}

export default function IncomeCard({ month, persons, incomes, totalFixed, onSave, cardStyle }: Props) {
  const sorted = [...persons].sort((a, b) => a.order - b.order);
  const prevMonth = addMonths(month, -1);

  /** 이 사람의 이 달 '급여' 항목 (한 사람당 한 줄로 단순하게 관리한다) */
  const entryFor = (personId: string) =>
    incomes.find(i => alive(i) && i.month === month && i.personId === personId);

  const prevEntries = incomes.filter(i => alive(i) && i.month === prevMonth);
  const total = sorted.reduce((s, p) => s + (entryFor(p.id)?.amount ?? 0), 0);
  const spendable = total - totalFixed;
  const days = daysInMonth(month);
  const perDay = days > 0 ? Math.floor(spendable / days) : 0;

  function copyPrev() {
    for (const p of sorted) {
      const prev = prevEntries.find(i => i.personId === p.id);
      if (!prev) continue;
      const existing = entryFor(p.id);
      onSave({ id: existing?.id, month, personId: p.id, amount: prev.amount, memo: prev.memo });
    }
  }

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
        <h3 style={{ margin: 0, fontSize: 15, color: '#333' }}>{monthLabel(month)} 수입</h3>
        {prevEntries.length > 0 && (
          <button
            onClick={copyPrev}
            style={{
              fontSize: 11.5, padding: '5px 10px', border: '1px solid #ddd', borderRadius: 8,
              background: '#f8f9fa', color: '#607d8b', cursor: 'pointer',
            }}
          >
            지난달 복사
          </button>
        )}
      </div>
      <p style={{ margin: '0 0 14px', fontSize: 12.5, color: '#95a5a6', lineHeight: 1.6 }}>
        세후 실수령액(통장에 들어오는 금액)을 넣어주세요.
      </p>

      {sorted.map(p => (
        <PersonIncomeRow
          key={p.id}
          person={p}
          entry={entryFor(p.id)}
          month={month}
          onSave={onSave}
        />
      ))}

      {/* 계산 결과를 바로 보여준다 — 숫자가 맞는지 여기서 확인할 수 있게 */}
      <div style={{
        marginTop: 14, padding: '13px 14px', background: '#f5f7f8', borderRadius: 10,
        fontSize: 12.5, color: '#607d8b', lineHeight: 1.9,
      }}>
        <div>수입 합계 <b style={{ color: '#27ae60' }}>{won(total)}</b></div>
        {totalFixed > 0 && <div>− 고정지출 <b>{won(totalFixed)}</b></div>}
        <div>÷ {days}일 ({monthLabel(month)})</div>
        <div style={{
          marginTop: 6, paddingTop: 8, borderTop: '1px solid #e3e8ea',
          fontSize: 15, color: '#2c3e50', fontWeight: 700,
        }}>
          = 하루 {won(perDay)}
        </div>
      </div>
    </div>
  );
}

function PersonIncomeRow({
  person, entry, month, onSave,
}: {
  person: Person;
  entry?: IncomeEntry;
  month: MonthKey;
  onSave: Props['onSave'];
}) {
  const [text, setText] = useState(
    entry ? entry.amount.toLocaleString('ko-KR') : '',
  );
  const [dirty, setDirty] = useState(false);

  // 다른 기기에서 값이 바뀌어 들어왔고 내가 편집 중이 아니면 따라간다
  const incoming = entry ? entry.amount.toLocaleString('ko-KR') : '';
  const [lastIncoming, setLastIncoming] = useState(incoming);
  if (incoming !== lastIncoming) {
    setLastIncoming(incoming);
    if (!dirty) setText(incoming);
  }

  function commit() {
    const amount = parseAmountInput(text);
    if (amount === (entry?.amount ?? 0)) { setDirty(false); return; }
    onSave({ id: entry?.id, month, personId: person.id, amount, memo: entry?.memo ?? '급여' });
    setDirty(false);
  }

  return (
    <div style={{ marginBottom: 12 }}>
      <label
        htmlFor={`income-${person.id}`}
        style={{ fontSize: 13, fontWeight: 600, color: person.color, marginBottom: 6, display: 'block' }}
      >
        {person.name}
      </label>
      <div style={{ position: 'relative' }}>
        <input
          id={`income-${person.id}`}
          type="text"
          inputMode="numeric"
          value={text}
          onChange={e => { setText(formatAmountInput(e.target.value)); setDirty(true); }}
          onBlur={commit}
          onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
          placeholder="0"
          style={{
            width: '100%', padding: '11px 40px 11px 12px', border: '1.5px solid #e0e0e0',
            borderRadius: 8, fontSize: 16, fontWeight: 700, textAlign: 'right',
            boxSizing: 'border-box', outline: 'none', color: '#2c3e50',
          }}
        />
        <span style={{
          position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)',
          fontSize: 14, color: '#bbb', pointerEvents: 'none',
        }}>
          원
        </span>
      </div>
    </div>
  );
}

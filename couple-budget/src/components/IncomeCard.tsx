import React, { useState } from 'react';
import { IncomeEntry, MonthKey, Person } from '../types';
import { addMonths, alive, daysInMonth } from '../utils/budget';
import { monthLabel, won } from '../utils/format';

interface Props {
  month: MonthKey;
  persons: Person[];
  incomes: IncomeEntry[];
  totalFixed: number;
  /** '+ 수입 더하기' — 입력 탭의 수입 화면으로 보낸다 */
  onAdd: () => void;
  onEdit: (entry: IncomeEntry) => void;
  onDelete: (id: string) => void;
  /** 지난달 수입을 이 달로 복사 (복사한 건수를 돌려준다) */
  onCopyPrev: () => number;
  cardStyle: React.CSSProperties;
}

/**
 * 이 달 수입 목록.
 *
 * 예전엔 사람마다 칸 하나였다. 그러면 급여 + 부업 일당 3건을 넣으려면
 * 사용자가 직접 더해서 한 칸에 적어야 했다 — 들어올 때마다 계산기를 두드리는 셈이다.
 * 지금은 들어온 대로 한 줄씩 쌓고 합계와 하루 금액은 앱이 낸다.
 */
export default function IncomeCard({
  month, persons, incomes, totalFixed, onAdd, onEdit, onDelete, onCopyPrev, cardStyle,
}: Props) {
  const prevMonth = addMonths(month, -1);

  const rows = incomes
    .filter(i => alive(i) && i.month === month)
    .sort((a, b) => b.amount - a.amount || a.createdAt - b.createdAt);

  const hasPrev = incomes.some(i => alive(i) && i.month === prevMonth);
  const total = rows.reduce((s, i) => s + i.amount, 0);
  const spendable = total - totalFixed;
  const days = daysInMonth(month);
  const perDay = days > 0 ? Math.floor(spendable / days) : 0;

  const personOf = (id: string) => persons.find(p => p.id === id);

  return (
    <div style={cardStyle}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4,
      }}>
        <h3 style={{ margin: 0, fontSize: 15, color: '#333' }}>{monthLabel(month)} 수입</h3>
        {/* 이 달이 비어 있을 때만 — 이미 있는데 또 복사하면 같은 급여가 두 번 들어간다 */}
        {hasPrev && rows.length === 0 && (
          <button
            onClick={onCopyPrev}
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
        세후 실수령액을 들어온 대로 한 줄씩 넣어주세요. 합계는 앱이 냅니다.
      </p>

      {rows.length === 0 ? (
        <div style={{
          padding: '22px 14px', background: '#fafbfc', borderRadius: 10,
          textAlign: 'center', fontSize: 13, color: '#b0bec5', lineHeight: 1.7,
        }}>
          아직 이 달 수입이 없어요
          <br />
          <span style={{ fontSize: 12 }}>급여든 부업 일당이든 들어온 대로 더하면 됩니다</span>
        </div>
      ) : (
        <div style={{ border: '1px solid #f0f0f0', borderRadius: 10, overflow: 'hidden' }}>
          {rows.map((i, idx) => (
            <IncomeRow
              key={i.id}
              entry={i}
              person={personOf(i.personId)}
              first={idx === 0}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}

      <button
        onClick={onAdd}
        style={{
          width: '100%', marginTop: 10, padding: 13, borderRadius: 10, cursor: 'pointer',
          background: '#eafaf1', border: 'none',
          fontSize: 14, fontWeight: 700, color: '#27ae60',
        }}
      >
        + 수입 더하기
      </button>

      {/* 나눗셈을 앱이 대신 한다 — 숫자가 맞는지 여기서 확인할 수 있게 */}
      <div style={{
        marginTop: 14, padding: '13px 14px', background: '#f5f7f8', borderRadius: 10,
        fontSize: 12.5, color: '#607d8b', lineHeight: 1.9,
      }}>
        <div>
          수입 합계 <b style={{ color: '#27ae60' }}>{won(total)}</b>
          {rows.length > 1 && <span style={{ color: '#aaa' }}> ({rows.length}건)</span>}
        </div>
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

/** 한 줄 = 들어온 돈 한 건. 누르면 수정, ✕ 두 번 누르면 삭제 (지출 목록과 같은 방식) */
function IncomeRow({
  entry, person, first, onEdit, onDelete,
}: {
  entry: IncomeEntry;
  person?: Person;
  first: boolean;
  onEdit: Props['onEdit'];
  onDelete: Props['onDelete'];
}) {
  const [confirming, setConfirming] = useState(false);
  const label = entry.memo || '수입';

  return (
    <div style={{
      display: 'flex', alignItems: 'center',
      borderTop: first ? 'none' : '1px solid #f5f5f5',
    }}>
      <button
        onClick={() => onEdit(entry)}
        style={{
          flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 8,
          background: 'none', border: 'none', textAlign: 'left',
          padding: '11px 0 11px 12px', cursor: 'pointer', font: 'inherit',
        }}
        aria-label={`${label} 수정`}
      >
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{
            display: 'block', fontSize: 13.5, fontWeight: 600, color: '#2c3e50',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {label}
          </span>
          {person && (
            <span style={{
              fontSize: 11, color: person.color, fontWeight: 700,
              background: `${person.color}14`, borderRadius: 6, padding: '1px 6px',
              display: 'inline-block', marginTop: 3,
            }}>
              {person.name}
            </span>
          )}
        </span>
        <span style={{ fontSize: 14.5, fontWeight: 700, color: '#27ae60', flexShrink: 0 }}>
          {won(entry.amount)}
        </span>
        <span style={{ fontSize: 12, color: '#cfd8dc', flexShrink: 0 }}>✎</span>
      </button>

      <button
        onClick={() => {
          if (confirming) { onDelete(entry.id); return; }
          setConfirming(true);
          setTimeout(() => setConfirming(false), 3000);
        }}
        style={{
          background: confirming ? '#fdedec' : 'none',
          border: 'none', borderRadius: 6, cursor: 'pointer', flexShrink: 0,
          fontSize: confirming ? 11 : 14,
          color: confirming ? '#e74c3c' : '#d0d7da',
          fontWeight: confirming ? 700 : 400,
          margin: confirming ? '0 8px 0 4px' : 0,
          padding: confirming ? '5px 8px' : '10px 12px',
        }}
        aria-label={confirming ? `${label} 삭제 확인` : `${label} 삭제`}
      >
        {confirming ? '삭제?' : '✕'}
      </button>
    </div>
  );
}

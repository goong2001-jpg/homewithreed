import React from 'react';
import { DateKey, Loan, Recurring } from '../types';
import { ddayLabel, monthsLabel, shortDate, shortWon, won } from '../utils/format';
import { loanStatus } from '../utils/loan';
import { alive } from '../utils/merge';
import { COLOR, card, ddayStyle, empty, row, sectionTitle } from './ui';

interface Props {
  loans: Loan[];
  recurrings: Recurring[];
  monthlyLoanPayment: number;
  monthlyFixed: number;
  today: DateKey;
  onAddLoan: () => void;
  onEditLoan: (l: Loan) => void;
  onAddRecurring: () => void;
  onEditRecurring: (r: Recurring) => void;
}

export default function OutflowView({
  loans, recurrings, monthlyLoanPayment, monthlyFixed, today,
  onAddLoan, onEditLoan, onAddRecurring, onEditRecurring,
}: Props) {
  const liveLoans = alive(loans);
  const liveRecurrings = alive(recurrings).slice().sort((a, b) => a.payDay - b.payDay);
  const total = monthlyLoanPayment + monthlyFixed;

  return (
    <div>
      <div style={{ ...card, marginTop: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: COLOR.sub }}>매달 나가는 돈</div>
        <div
          style={{
            fontSize: 32, fontWeight: 800, color: COLOR.debt, marginTop: 4,
            letterSpacing: '-1px', fontVariantNumeric: 'tabular-nums',
          }}
        >
          {won(total)}
        </div>
        <div
          style={{
            display: 'flex', gap: 10, marginTop: 14,
            borderTop: `1px solid ${COLOR.line}`, paddingTop: 12,
          }}
        >
          <MiniStat label="대출 상환" value={won(monthlyLoanPayment)} />
          <div style={{ width: 1, background: COLOR.line }} />
          <MiniStat label="고정비" value={won(monthlyFixed)} />
        </div>
      </div>

      {/* ── 대출 ───────────────────────────────── */}
      <div style={sectionTitle}>🏦 대출</div>

      {liveLoans.length === 0 ? (
        <div style={{ ...card, ...empty, margin: '0 16px' }}>
          아직 넣은 대출이 없어요.
        </div>
      ) : (
        liveLoans.map(l => <LoanCard key={l.id} loan={l} today={today} onClick={() => onEditLoan(l)} />)
      )}

      <div style={{ padding: '10px 16px 0' }}>
        <button
          onClick={onAddLoan}
          style={{
            width: '100%', padding: '13px', borderRadius: 10,
            border: `1px dashed ${COLOR.line}`, background: '#fff',
            color: COLOR.sub, fontSize: 14, cursor: 'pointer', font: 'inherit',
          }}
        >
          ＋ 대출 추가
        </button>
      </div>

      {/* ── 고정비 ─────────────────────────────── */}
      <div style={sectionTitle}>📆 고정비</div>

      <div style={{ ...card, margin: '0 16px', padding: 0, overflow: 'hidden' }}>
        {liveRecurrings.length === 0 && (
          <div style={{ ...empty, padding: '24px 16px' }}>
            보험료·통신비처럼 매달 나가는 돈을 넣어보세요.
          </div>
        )}

        {liveRecurrings.map(r => (
          <button key={r.id} onClick={() => onEditRecurring(r)} style={row}>
            <span
              style={{
                fontSize: 12, fontWeight: 700, color: COLOR.sub,
                background: '#eef1f4', borderRadius: 6, padding: '4px 7px',
                minWidth: 36, textAlign: 'center', flexShrink: 0,
              }}
            >
              {r.payDay}일
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {r.name}
              </div>
              {r.memo && (
                <div style={{ fontSize: 12, color: COLOR.faint, marginTop: 2 }}>{r.memo}</div>
              )}
            </div>
            <strong style={{ fontSize: 15, fontVariantNumeric: 'tabular-nums' }}>
              {won(r.amount)}
            </strong>
          </button>
        ))}

        <button
          onClick={onAddRecurring}
          style={{ ...row, borderBottom: 'none', color: COLOR.faint, fontSize: 14, justifyContent: 'center' }}
        >
          ＋ 고정비 추가
        </button>
      </div>

      <div style={{ height: 24 }} />
    </div>
  );
}

function LoanCard(
  { loan: l, today, onClick }: { loan: Loan; today: DateKey; onClick: () => void },
) {
  const st = loanStatus(l, today);
  // 만기일시는 원금이 안 줄어서 상환 진행률 막대가 늘 비어 있다. 기간 경과율을 보여준다.
  const bar = l.method === '만기일시' ? st.timeProgress : st.progress;
  const barLabel = l.method === '만기일시' ? '기간 경과' : '원금 상환';

  return (
    <button
      onClick={onClick}
      style={{
        ...card, display: 'block', width: 'calc(100% - 32px)', textAlign: 'left',
        border: 'none', cursor: 'pointer', font: 'inherit', marginTop: 0, marginBottom: 10,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <strong style={{ fontSize: 16, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {l.name}
        </strong>
        {st.done
          ? <span style={{ ...ddayStyle(9999), color: COLOR.plus, background: '#e8f6ee' }}>상환 완료</span>
          : <span style={ddayStyle(st.remainingMonths * 30)}>{ddayLabel(st.endDate, today)}</span>}
      </div>

      <div style={{ fontSize: 12, color: COLOR.faint, marginTop: 3 }}>
        {l.method} · 연 {l.rate}% · {monthsLabel(l.termMonths)}
        {l.graceMonths > 0 && l.method !== '만기일시' && ` (거치 ${l.graceMonths}개월)`}
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
        <MiniStat
          label={st.inGrace ? '월 상환액 (이자만)' : '월 상환액'}
          value={st.done ? '—' : won(st.monthlyPayment)}
        />
        <div style={{ width: 1, background: COLOR.line }} />
        <MiniStat label="남은 원금" value={shortWon(st.remainingPrincipal)} color={COLOR.debt} />
      </div>

      <div style={{ marginTop: 14 }}>
        <div
          style={{
            display: 'flex', justifyContent: 'space-between',
            fontSize: 11, color: COLOR.faint, marginBottom: 5,
          }}
        >
          <span>{barLabel} {Math.round(bar * 100)}%</span>
          <span>만기 {shortDate(st.endDate)}</span>
        </div>
        <div style={{ height: 7, borderRadius: 4, background: COLOR.line, overflow: 'hidden' }}>
          <div
            style={{
              width: `${Math.min(100, bar * 100)}%`,
              height: '100%',
              background: st.done ? COLOR.plus : COLOR.accent,
              transition: 'width 0.3s',
            }}
          />
        </div>
      </div>

      {!st.done && (
        <div
          style={{
            marginTop: 12, paddingTop: 10, borderTop: `1px solid ${COLOR.line}`,
            display: 'flex', justifyContent: 'space-between', fontSize: 12, color: COLOR.sub,
          }}
        >
          <span>이번 달 이자 {won(st.monthlyInterest)}</span>
          <span>만기까지 총 이자 {shortWon(st.totalInterest)}</span>
        </div>
      )}
    </button>
  );
}

function MiniStat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 12, color: COLOR.sub }}>{label}</div>
      <div
        style={{
          fontSize: 16, fontWeight: 700, marginTop: 3,
          color: color ?? COLOR.text, fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </div>
    </div>
  );
}

import React, { useMemo, useState } from 'react';
import {
  CATEGORY_EMOJI, Expense, MonthBudget, MonthKey, Person, SyncStatus,
} from '../types';
import { monthExpenses, topExpenses } from '../utils/budget';
import { dateLabel, shortWon, won } from '../utils/format';
import MonthHeader from './MonthHeader';

interface Props {
  month: MonthKey;
  budget: MonthBudget;
  persons: Person[];
  expenses: Expense[];
  syncStatus: SyncStatus;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onEditExpense: (expense: Expense) => void;
  onGoSettings: () => void;
}

const MEDAL = ['🥇', '🥈', '🥉'];

/**
 * 큰 지출 TOP 5.
 *
 * 카테고리별 집계(내역 탭)는 '어디에 새는지'를 보여주지만
 * '무엇 하나가 이 달을 망쳤는지'는 개별 건을 크기순으로 봐야 보인다.
 */
export default function TopSpendView({
  month, budget, persons, expenses, syncStatus,
  onPrev, onNext, onToday, onEditExpense, onGoSettings,
}: Props) {
  const [personFilter, setPersonFilter] = useState<string>('all');
  const [limit, setLimit] = useState(5);

  const who = personFilter === 'all' ? undefined : personFilter;

  const all = useMemo(
    () => monthExpenses(expenses, month).filter(e => !who || e.personId === who),
    [expenses, month, who],
  );
  const rows = useMemo(() => topExpenses(expenses, month, limit, who), [expenses, month, limit, who]);

  const scopeTotal = all.reduce((s, e) => s + e.amount, 0);
  const topTotal = rows.reduce((s, e) => s + e.amount, 0);
  const share = scopeTotal > 0 ? topTotal / scopeTotal : 0;
  const biggest = rows[0]?.amount ?? 0;

  const personOf = (id: string) => persons.find(p => p.id === id);
  const sortedPersons = [...persons].sort((a, b) => a.order - b.order);

  const chip = (on: boolean, color: string): React.CSSProperties => ({
    padding: '7px 13px', borderRadius: 20, fontSize: 12.5, cursor: 'pointer',
    border: `1.5px solid ${on ? color : '#e0e0e0'}`,
    background: on ? `${color}14` : '#fff',
    color: on ? color : '#666',
    fontWeight: on ? 700 : 400,
    whiteSpace: 'nowrap',
  });

  return (
    <>
      <MonthHeader
        month={month}
        phase={budget.phase}
        onPrev={onPrev}
        onNext={onNext}
        onToday={onToday}
        syncStatus={syncStatus}
        onSyncClick={onGoSettings}
      />

      <div style={{ display: 'flex', gap: 7, padding: '12px 16px 4px', overflowX: 'auto' }}>
        <button
          onClick={() => { setPersonFilter('all'); setLimit(5); }}
          style={chip(personFilter === 'all', '#27ae60')}
        >
          전체
        </button>
        {sortedPersons.map(p => (
          <button
            key={p.id}
            onClick={() => { setPersonFilter(p.id); setLimit(5); }}
            style={chip(personFilter === p.id, p.color)}
          >
            {p.name}
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '54px 20px', color: '#bbb' }}>
          <div style={{ fontSize: 46, marginBottom: 12 }}>🏆</div>
          <div style={{ fontSize: 15 }}>
            {personFilter === 'all' ? '이달의 지출 내역이 없습니다' : '이 사람의 지출이 없습니다'}
          </div>
        </div>
      ) : (
        <>
          {/* TOP N 이 이 달 지출에서 얼마를 차지하는지 — 한 줄로 요약 */}
          <div style={{
            background: '#fff', margin: '12px 16px', borderRadius: 12, padding: 16,
            boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
          }}>
            <div style={{ fontSize: 12, color: '#888', marginBottom: 5 }}>
              큰 지출 {rows.length}건이 이 달 지출에서 차지하는 비중
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 10 }}>
              <span style={{ fontSize: 30, fontWeight: 800, color: '#2c3e50', lineHeight: 1.1 }}>
                {Math.round(share * 100)}%
              </span>
              <span style={{ fontSize: 12.5, color: '#95a5a6' }}>
                {won(topTotal)} / {won(scopeTotal)}
              </span>
            </div>
            <div style={{ background: '#f1f3f5', borderRadius: 99, height: 9, overflow: 'hidden' }}>
              <div style={{
                width: `${Math.round(share * 100)}%`, height: '100%',
                background: '#e74c3c', borderRadius: 99, transition: 'width 500ms ease',
              }} />
            </div>
            {budget.hasIncome && biggest > 0 && (
              <div style={{ fontSize: 11.5, color: '#b0bec5', marginTop: 9, lineHeight: 1.6 }}>
                1위 {shortWon(biggest)}이면 하루 쓸 수 있는 돈으로{' '}
                <b style={{ color: '#95a5a6' }}>
                  {(biggest / Math.max(1, budget.dailyBudget)).toFixed(1)}일치
                </b>
                예요.
              </div>
            )}
          </div>

          <div style={{
            background: '#fff', margin: '0 16px 12px', borderRadius: 12, overflow: 'hidden',
            boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
          }}>
            {rows.map((e, i) => {
              const person = personOf(e.personId);
              return (
                <button
                  key={e.id}
                  onClick={() => onEditExpense(e)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 11,
                    padding: '13px 14px', background: 'none', border: 'none',
                    borderTop: i === 0 ? 'none' : '1px solid #f5f5f5',
                    textAlign: 'left', cursor: 'pointer', font: 'inherit',
                  }}
                  aria-label={`${i + 1}위 ${e.content} 수정`}
                >
                  <span style={{
                    width: 26, textAlign: 'center', flexShrink: 0,
                    fontSize: i < 3 ? 18 : 13,
                    fontWeight: 700, color: '#b0bec5',
                  }}>
                    {MEDAL[i] ?? i + 1}
                  </span>

                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{
                      display: 'block', fontSize: 14.5, fontWeight: 600, color: '#2c3e50',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>
                      {e.content}
                    </span>
                    <span style={{
                      display: 'flex', alignItems: 'center', gap: 5,
                      fontSize: 11.5, color: '#95a5a6', marginTop: 3,
                    }}>
                      {person && (
                        <span style={{
                          color: person.color, fontWeight: 700,
                          background: `${person.color}14`, borderRadius: 6, padding: '1px 6px',
                        }}>
                          {person.name}
                        </span>
                      )}
                      <span>{CATEGORY_EMOJI[e.category]} {e.category}</span>
                      <span style={{ color: '#cfd8dc' }}>·</span>
                      <span>{dateLabel(e.date)}</span>
                    </span>
                    {/* 1위 대비 막대 — 1위가 얼마나 압도적인지 한눈에 보인다 */}
                    <span style={{
                      display: 'block', background: '#f1f3f5', borderRadius: 99,
                      height: 5, overflow: 'hidden', marginTop: 7,
                    }}>
                      <span style={{
                        display: 'block',
                        width: `${biggest > 0 ? Math.round((e.amount / biggest) * 100) : 0}%`,
                        height: '100%', background: '#e74c3c', borderRadius: 99,
                      }} />
                    </span>
                  </span>

                  <span style={{
                    fontSize: 15, fontWeight: 700, color: '#e74c3c', flexShrink: 0,
                  }}>
                    {won(e.amount)}
                  </span>
                </button>
              );
            })}
          </div>

          {/* TOP 5 가 기본. 더 보고 싶을 때만 늘린다 */}
          {all.length > rows.length && (
            <button
              onClick={() => setLimit(l => l + 5)}
              style={{
                display: 'block', width: 'calc(100% - 32px)', margin: '0 16px 8px',
                padding: 13, background: '#fff', border: '1px solid #e0e0e0', borderRadius: 10,
                fontSize: 13, color: '#607d8b', cursor: 'pointer',
              }}
            >
              {rows.length + 1}위부터 더 보기 (남은 {all.length - rows.length}건)
            </button>
          )}
          {limit > 5 && (
            <button
              onClick={() => setLimit(5)}
              style={{
                display: 'block', width: 'calc(100% - 32px)', margin: '0 16px 8px',
                padding: 11, background: 'none', border: 'none',
                fontSize: 12.5, color: '#b0bec5', cursor: 'pointer',
              }}
            >
              TOP 5만 보기
            </button>
          )}

          <div style={{
            fontSize: 11.5, color: '#c5ced2', textAlign: 'center',
            lineHeight: 1.8, padding: '4px 20px 8px',
          }}>
            내역을 누르면 금액·메모를 고칠 수 있어요
          </div>
        </>
      )}
    </>
  );
}

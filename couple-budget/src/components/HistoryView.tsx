import React, { useMemo, useState } from 'react';
import {
  Expense, FixedExpense, IncomeEntry, MonthBudget, MonthKey, Person, SyncStatus,
} from '../types';
import { activeFixed, monthExpenses } from '../utils/budget';
import { dateLabel, won } from '../utils/format';
import { exportMonthToExcel } from '../utils/excelExport';
import MonthHeader from './MonthHeader';
import ExpenseItem from './ExpenseItem';

interface Props {
  month: MonthKey;
  budget: MonthBudget;
  persons: Person[];
  incomes: IncomeEntry[];
  fixed: FixedExpense[];
  expenses: Expense[];
  syncStatus: SyncStatus;
  isLive: boolean;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onDeleteExpense: (id: string) => void;
  onPullAll: () => void;
  onGoSettings: () => void;
}

function groupByDate(rows: Expense[]): [string, Expense[]][] {
  const map = new Map<string, Expense[]>();
  const sorted = [...rows].sort(
    (a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt,
  );
  for (const e of sorted) {
    if (!map.has(e.date)) map.set(e.date, []);
    map.get(e.date)!.push(e);
  }
  return Array.from(map.entries());
}

export default function HistoryView({
  month, budget, persons, incomes, fixed, expenses, syncStatus, isLive,
  onPrev, onNext, onToday, onDeleteExpense, onPullAll, onGoSettings,
}: Props) {
  const [filter, setFilter] = useState<string>('all');
  const [exporting, setExporting] = useState(false);

  const rows = useMemo(() => monthExpenses(expenses, month), [expenses, month]);
  const shown = filter === 'all' ? rows : rows.filter(e => e.personId === filter);
  const groups = groupByDate(shown);
  const shownTotal = shown.reduce((s, e) => s + e.amount, 0);

  const activeFixedRows = activeFixed(fixed, month);
  const personOf = (id: string) => persons.find(p => p.id === id);
  const sortedPersons = [...persons].sort((a, b) => a.order - b.order);

  async function handleExport() {
    setExporting(true);
    try {
      await exportMonthToExcel(month, budget, incomes, fixed, expenses, persons);
    } catch (e) {
      console.warn('Excel 내보내기 실패:', e);
    } finally {
      setExporting(false);
    }
  }

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
        right={
          <button
            onClick={handleExport}
            disabled={rows.length === 0 || exporting}
            style={{
              fontSize: 11.5, padding: '6px 10px', border: '1px solid #ddd', borderRadius: 8,
              background: rows.length === 0 ? '#f5f5f5' : '#eafaf1',
              color: rows.length === 0 ? '#aaa' : '#27ae60',
              cursor: rows.length === 0 ? 'not-allowed' : 'pointer',
              fontWeight: 600, whiteSpace: 'nowrap',
            }}
          >
            {exporting ? '…' : 'Excel'}
          </button>
        }
      />

      {/* 사람 필터 */}
      <div style={{
        display: 'flex', gap: 7, padding: '12px 16px 4px', overflowX: 'auto',
      }}>
        <button onClick={() => setFilter('all')} style={chip(filter === 'all', '#27ae60')}>
          전체 {won(rows.reduce((s, e) => s + e.amount, 0))}
        </button>
        {sortedPersons.map(p => {
          const total = rows.filter(e => e.personId === p.id).reduce((s, e) => s + e.amount, 0);
          return (
            <button key={p.id} onClick={() => setFilter(p.id)} style={chip(filter === p.id, p.color)}>
              {p.name} {won(total)}
            </button>
          );
        })}
      </div>

      {/* 고정지출 (매달 반복 — 여기서는 보기만) */}
      {activeFixedRows.length > 0 && (
        <div style={{
          background: '#fff', margin: '12px 16px', borderRadius: 12, overflow: 'hidden',
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        }}>
          <div style={{
            padding: '11px 14px', background: '#fafbfc', borderBottom: '1px solid #f0f0f0',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: '#607d8b' }}>
              고정지출 (하루수입에서 이미 차감)
            </span>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: '#607d8b' }}>
              {won(budget.totalFixed)}
            </span>
          </div>
          {activeFixedRows.map(f => (
            <div key={f.id} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 14px', borderBottom: '1px solid #f7f7f7', fontSize: 13.5,
            }}>
              <span style={{ flex: 1, color: '#2c3e50' }}>{f.name}</span>
              <span style={{
                fontSize: 10, color: '#78909c', background: '#eceff1',
                borderRadius: 6, padding: '2px 6px',
              }}>
                매달
              </span>
              <span style={{ fontWeight: 700, color: '#607d8b' }}>{won(f.amount)}</span>
            </div>
          ))}
          <button
            onClick={onGoSettings}
            style={{
              width: '100%', padding: '10px', background: 'none', border: 'none',
              fontSize: 12, color: '#90a4ae', cursor: 'pointer',
            }}
          >
            설정에서 수정 ›
          </button>
        </div>
      )}

      {/* 변동지출 */}
      {groups.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '54px 20px', color: '#bbb' }}>
          <div style={{ fontSize: 46, marginBottom: 12 }}>📋</div>
          <div style={{ fontSize: 15 }}>
            {filter === 'all' ? '이달의 지출 내역이 없습니다' : '이 사람의 지출이 없습니다'}
          </div>
        </div>
      ) : (
        <div style={{ marginTop: 8 }}>
          {filter !== 'all' && (
            <div style={{ padding: '0 16px 8px', fontSize: 12, color: '#95a5a6' }}>
              {shown.length}건 · {won(shownTotal)}
            </div>
          )}
          {groups.map(([date, items]) => (
            <div key={date}>
              <div style={{
                padding: '9px 16px', fontSize: 12, color: '#888', fontWeight: 600,
                background: '#f8f9fa', display: 'flex', justifyContent: 'space-between',
              }}>
                <span>{dateLabel(date)}</span>
                <span>{won(items.reduce((s, e) => s + e.amount, 0))}</span>
              </div>
              <div style={{ background: '#fff' }}>
                {items.map(e => (
                  <ExpenseItem
                    key={e.id}
                    expense={e}
                    person={personOf(e.personId)}
                    onDelete={onDeleteExpense}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {isLive && (
        <button
          onClick={onPullAll}
          style={{
            display: 'block', width: 'calc(100% - 32px)', margin: '18px 16px 8px',
            padding: 13, background: '#fff', border: '1px solid #e0e0e0', borderRadius: 10,
            fontSize: 13, color: '#607d8b', cursor: 'pointer',
          }}
        >
          지난 데이터 모두 불러오기
        </button>
      )}
    </>
  );
}

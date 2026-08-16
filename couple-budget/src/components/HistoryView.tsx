import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Expense, ExpenseCategory, FixedExpense, IncomeEntry, MonthBudget, MonthKey,
  Person, SyncStatus,
} from '../types';
import { activeFixed, categoryTotals, monthExpenses } from '../utils/budget';
import { dateLabel, won } from '../utils/format';
import { exportMonthToExcel } from '../utils/excelExport';
import MonthHeader from './MonthHeader';
import ExpenseItem from './ExpenseItem';
import CategoryBreakdown from './CategoryBreakdown';

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
  /** 'all' 이거나 personId. 홈에서 사람을 눌러 들어오면 그 사람이 들어있다 */
  personFilter: string;
  onPersonFilterChange: (v: string) => void;
  onEditExpense: (expense: Expense) => void;
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
  personFilter: filter, onPersonFilterChange: setFilter,
  onPrev, onNext, onToday, onEditExpense, onDeleteExpense, onPullAll, onGoSettings,
}: Props) {
  const [category, setCategory] = useState<ExpenseCategory | null>(null);
  const [exporting, setExporting] = useState(false);

  const rows = useMemo(() => monthExpenses(expenses, month), [expenses, month]);

  const byPerson = filter === 'all' ? rows : rows.filter(e => e.personId === filter);
  const shown = category ? byPerson.filter(e => e.category === category) : byPerson;
  const groups = groupByDate(shown);
  const shownTotal = shown.reduce((s, e) => s + e.amount, 0);

  // 카테고리 집계는 사람 필터까지만 반영한다 —
  // 카테고리를 고르고 나서도 다른 카테고리로 바로 옮겨갈 수 있어야 하니까
  const catRows = useMemo(
    () => categoryTotals(expenses, month, filter === 'all' ? undefined : filter),
    [expenses, month, filter],
  );

  const selectedPerson = filter === 'all' ? null : persons.find(p => p.id === filter) ?? null;
  const personStat = filter === 'all'
    ? null
    : budget.perPerson.find(p => p.personId === filter) ?? null;

  // 홈에서 사람을 눌러 들어오면 그 칩이 가로 스크롤 밖에 있을 수 있다.
  // 화면 안으로 끌어와야 지금 누구를 보고 있는지 알 수 있다.
  const activeChipRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    activeChipRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [filter]);

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
        <button
          ref={filter === 'all' ? activeChipRef : undefined}
          onClick={() => { setFilter('all'); setCategory(null); }}
          style={chip(filter === 'all', '#27ae60')}
        >
          전체 {won(rows.reduce((s, e) => s + e.amount, 0))}
        </button>
        {sortedPersons.map(p => {
          const total = rows.filter(e => e.personId === p.id).reduce((s, e) => s + e.amount, 0);
          return (
            <button
              key={p.id}
              ref={filter === p.id ? activeChipRef : undefined}
              onClick={() => { setFilter(p.id); setCategory(null); }}
              style={chip(filter === p.id, p.color)}
            >
              {p.name} {won(total)}
            </button>
          );
        })}
      </div>

      {/* 사람을 골랐을 때: 그 사람 수입 · 지출 요약 */}
      {personStat && (
        <div style={{
          background: '#fff', margin: '12px 16px', borderRadius: 12, padding: 16,
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 7, marginBottom: 12,
          }}>
            <span style={{
              width: 10, height: 10, borderRadius: '50%',
              background: personStat.color, flexShrink: 0,
            }} />
            <h3 style={{ margin: 0, fontSize: 15, color: '#2c3e50' }}>
              {personStat.name}
            </h3>
          </div>
          <div style={{ display: 'flex' }}>
            <div style={{ flex: 1, textAlign: 'center', borderRight: '1px solid #f0f0f0' }}>
              <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>이달 수입</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#27ae60' }}>
                {won(personStat.income)}
              </div>
            </div>
            <div style={{ flex: 1, textAlign: 'center', borderRight: '1px solid #f0f0f0' }}>
              <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>이달 지출</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#e74c3c' }}>
                {won(personStat.expense)}
              </div>
            </div>
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>전체 중</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#2c3e50' }}>
                {Math.round(personStat.ratio * 100)}%
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 카테고리별 지출 — 눌러서 그 카테고리만 볼 수 있다 */}
      <CategoryBreakdown
        rows={catRows}
        selected={category}
        onSelect={setCategory}
        scopeLabel={selectedPerson?.name}
      />

      {/* 이달 쓴 돈 (변동지출) — 카테고리를 눌렀을 때 바로 보이도록 고정지출보다 위에 둔다 */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
        padding: '14px 16px 6px',
      }}>
        <h3 style={{ margin: 0, fontSize: 14, color: '#333' }}>
          이달 쓴 돈
          {category && (
            <span style={{ fontSize: 12, color: '#e74c3c', fontWeight: 700, marginLeft: 6 }}>
              {`· ${category}만 보는 중`}
            </span>
          )}
        </h3>
        {(filter !== 'all' || category) && (
          <button
            onClick={() => { setCategory(null); setFilter('all'); }}
            style={{
              fontSize: 11.5, padding: '4px 10px', border: '1px solid #e0e0e0',
              borderRadius: 12, background: '#fff', color: '#78909c', cursor: 'pointer',
            }}
          >
            전체 보기
          </button>
        )}
      </div>

      {groups.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '54px 20px', color: '#bbb' }}>
          <div style={{ fontSize: 46, marginBottom: 12 }}>📋</div>
          <div style={{ fontSize: 15 }}>
            {category
              ? `${category} 지출이 없습니다`
              : filter === 'all' ? '이달의 지출 내역이 없습니다' : '이 사람의 지출이 없습니다'}
          </div>
        </div>
      ) : (
        <div style={{ marginTop: 8 }}>
          <div style={{ padding: '0 16px 8px', fontSize: 11.5, color: '#b0bec5' }}>
            내역을 누르면 금액·메모를 고칠 수 있어요
          </div>
          {(filter !== 'all' || category) && (
            <div style={{ padding: '0 16px 8px', fontSize: 12, color: '#95a5a6' }}>
              {[selectedPerson?.name, category].filter(Boolean).join(' · ')}
              {' '}— {shown.length}건 · {won(shownTotal)}
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
                    onEdit={onEditExpense}
                    onDelete={onDeleteExpense}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

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
              고정지출 · 매달 반복
              <span style={{ fontWeight: 400, color: '#90a4ae' }}> (위 목록에는 없어요)</span>
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

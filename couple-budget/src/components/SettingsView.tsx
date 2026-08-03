import React, { useState } from 'react';
import {
  AppSettings, Expense, FixedExpense, IncomeEntry, MonthBudget, MonthKey,
  Person, SyncSettings, SyncStatus,
} from '../types';
import { monthLabel } from '../utils/format';
import { exportMonthToExcel } from '../utils/excelExport';
import MonthHeader from './MonthHeader';
import IncomeCard from './IncomeCard';
import FixedExpenseCard from './FixedExpenseCard';
import PersonsCard from './PersonsCard';
import SyncCard from './SyncCard';
import ExchangeCard from './ExchangeCard';

interface Props {
  month: MonthKey;
  budget: MonthBudget;
  settings: AppSettings;
  incomes: IncomeEntry[];
  fixed: FixedExpense[];
  expenses: Expense[];
  syncStatus: SyncStatus;
  syncError: string;
  counts: { incomes: number; fixed: number; expenses: number };
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onSaveIncome: React.ComponentProps<typeof IncomeCard>['onSave'];
  onSaveFixed: React.ComponentProps<typeof FixedExpenseCard>['onSave'];
  onDeleteFixed: (id: string) => void;
  persons: Person[];
  onSavePerson: React.ComponentProps<typeof PersonsCard>['onSave'];
  onDeletePerson: (id: string) => void;
  onSetSync: (patch: Partial<SyncSettings>) => void;
  onImport: React.ComponentProps<typeof ExchangeCard>['onImport'];
  onUploadAll: () => number;
  onClearLocal: () => void;
}

const cardStyle: React.CSSProperties = {
  background: '#fff', borderRadius: 12, padding: 18,
  boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
};

export default function SettingsView(props: Props) {
  const {
    month, budget, settings, persons, incomes, fixed, expenses, syncStatus, syncError, counts,
    onPrev, onNext, onToday, onSaveIncome, onSaveFixed, onDeleteFixed,
    onSavePerson, onDeletePerson, onSetSync, onImport, onUploadAll, onClearLocal,
  } = props;

  const [confirmClear, setConfirmClear] = useState(false);
  const [exporting, setExporting] = useState(false);

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

  return (
    <>
      <MonthHeader
        month={month}
        phase={budget.phase}
        onPrev={onPrev}
        onNext={onNext}
        onToday={onToday}
        syncStatus={syncStatus}
      />

      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <IncomeCard
          month={month}
          persons={persons}
          incomes={incomes}
          totalFixed={budget.totalFixed}
          onSave={onSaveIncome}
          cardStyle={cardStyle}
        />

        <FixedExpenseCard
          month={month}
          persons={persons}
          fixed={fixed}
          onSave={onSaveFixed}
          onDelete={onDeleteFixed}
          cardStyle={cardStyle}
        />

        <PersonsCard
          persons={persons}
          incomes={incomes}
          fixed={fixed}
          expenses={expenses}
          onSave={onSavePerson}
          onDelete={onDeletePerson}
          cardStyle={cardStyle}
        />

        <SyncCard
          sync={settings.sync}
          status={syncStatus}
          error={syncError}
          counts={counts}
          onChange={onSetSync}
          onUploadAll={onUploadAll}
          cardStyle={cardStyle}
        />

        <ExchangeCard
          persons={persons}
          incomes={incomes}
          fixed={fixed}
          expenses={expenses}
          onImport={onImport}
          cardStyle={cardStyle}
        />

        {/* 데이터 */}
        <div style={cardStyle}>
          <h3 style={{ margin: '0 0 4px', fontSize: 15, color: '#333' }}>데이터</h3>
          <p style={{ margin: '0 0 14px', fontSize: 12.5, color: '#95a5a6', lineHeight: 1.7 }}>
            동기화를 켜지 않으면 모든 기록은 이 브라우저에만 저장됩니다.
            브라우저 데이터를 지우면 함께 사라지니 가끔 Excel로 백업해 두세요.
          </p>

          <button
            onClick={handleExport}
            disabled={exporting}
            style={{
              width: '100%', padding: 12, background: '#eafaf1', border: 'none', borderRadius: 10,
              fontSize: 14, fontWeight: 600, color: '#27ae60', cursor: 'pointer',
            }}
          >
            {exporting ? '준비 중…' : `${monthLabel(month)} Excel 내보내기`}
          </button>

          <button
            onClick={() => {
              if (!confirmClear) {
                setConfirmClear(true);
                setTimeout(() => setConfirmClear(false), 4000);
                return;
              }
              onClearLocal();
              setConfirmClear(false);
            }}
            style={{
              width: '100%', marginTop: 9, padding: 12,
              background: confirmClear ? '#fdedec' : 'none',
              border: confirmClear ? 'none' : '1px solid #f0f0f0', borderRadius: 10,
              fontSize: 12.5, fontWeight: confirmClear ? 700 : 400,
              color: confirmClear ? '#e74c3c' : '#b0bec5', cursor: 'pointer',
            }}
          >
            {confirmClear
              ? '정말 지울까요? 다시 누르면 삭제됩니다'
              : '이 기기의 기록 모두 지우기'}
          </button>
        </div>

        <div style={{
          fontSize: 11, color: '#c5ced2', textAlign: 'center', lineHeight: 1.8, padding: '0 8px 8px',
        }}>
          하루 수입은 그 달의 실제 일수로 나눕니다.
          <br />같은 수입이라도 6월(30일)과 7월(31일)은 하루 금액이 조금 달라요.
        </div>
      </div>
    </>
  );
}

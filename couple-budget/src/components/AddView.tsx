import React from 'react';
import { AddMode, Expense, IncomeEntry, MonthBudget, MonthKey, Person } from '../types';
import ExpenseForm from './ExpenseForm';
import IncomeForm from './IncomeForm';

interface Props {
  month: MonthKey;
  persons: Person[];
  budget: MonthBudget;
  mode: AddMode;
  onModeChange: (m: AddMode) => void;
  /** 고치는 중인 내역 (둘 중 하나만 들어온다) */
  editingExpense?: Expense;
  editingIncome?: IncomeEntry;
  onSaveExpense: React.ComponentProps<typeof ExpenseForm>['onSave'];
  onDeleteExpense: (id: string) => void;
  onSaveIncome: React.ComponentProps<typeof IncomeForm>['onSave'];
  onDeleteIncome: (id: string) => void;
  onDone: () => void;
}

/**
 * 입력 탭. 지출과 수입을 같은 자리에서 받는다.
 *
 * 수입을 설정 화면에만 두면 부업 일당처럼 자주 들어오는 돈을 넣기 위해
 * 매번 설정까지 들어가야 한다. 들어온 돈도 쓴 돈만큼 자주 적는다.
 */
export default function AddView({
  month, persons, budget, mode, onModeChange,
  editingExpense, editingIncome,
  onSaveExpense, onDeleteExpense, onSaveIncome, onDeleteIncome, onDone,
}: Props) {
  const editing = !!(editingExpense || editingIncome);

  const title = editingExpense ? '내역 수정'
    : editingIncome ? '수입 수정'
    : mode === 'income' ? '들어온 돈 입력'
    : '쓴 돈 입력';

  const tab = (m: AddMode, color: string): React.CSSProperties => ({
    flex: 1, padding: '10px 0', borderRadius: 9, cursor: 'pointer', fontSize: 14,
    border: 'none',
    background: mode === m ? '#fff' : 'transparent',
    color: mode === m ? color : '#90a4ae',
    fontWeight: mode === m ? 700 : 500,
    boxShadow: mode === m ? '0 1px 3px rgba(0,0,0,0.12)' : 'none',
  });

  return (
    <div>
      <div style={{
        background: '#fff', padding: '14px 16px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
        position: 'sticky', top: 0, zIndex: 10,
      }}>
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>{title}</h2>

        {/* 고치는 중에는 전환을 숨긴다 — 지출을 수입으로 바꿀 수는 없다 */}
        {!editing && (
          <div style={{
            display: 'flex', gap: 4, marginTop: 12, padding: 4,
            background: '#f1f3f5', borderRadius: 11,
          }}>
            <button onClick={() => onModeChange('expense')} style={tab('expense', '#e74c3c')}>
              − 쓴 돈
            </button>
            <button onClick={() => onModeChange('income')} style={tab('income', '#27ae60')}>
              + 들어온 돈
            </button>
          </div>
        )}
      </div>

      {mode === 'income' || editingIncome ? (
        <IncomeForm
          month={month}
          persons={persons}
          budget={budget}
          initial={editingIncome}
          onSave={onSaveIncome}
          onDelete={onDeleteIncome}
          onDone={onDone}
        />
      ) : (
        <ExpenseForm
          persons={persons}
          budget={budget}
          initial={editingExpense}
          onSave={onSaveExpense}
          onDelete={onDeleteExpense}
          onDone={onDone}
        />
      )}
    </div>
  );
}

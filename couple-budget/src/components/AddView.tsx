import React, { useState } from 'react';
import {
  AddMode, Expense, FrequentExpense, IncomeEntry, MonthBudget, MonthKey, Person,
} from '../types';
import ExpenseForm, { FormPreset } from './ExpenseForm';
import PasteBox from './PasteBox';
import IncomeForm from './IncomeForm';
import GiftForm from './GiftForm';
import FrequentChips from './FrequentChips';

interface Props {
  month: MonthKey;
  persons: Person[];
  budget: MonthBudget;
  mode: AddMode;
  onModeChange: (m: AddMode) => void;
  /** 고치는 중인 내역 (둘 중 하나만 들어온다) */
  editingExpense?: Expense;
  editingIncome?: IncomeEntry;
  /** 자주 쓰는 지출 후보 (budget.ts frequentExpenses) — 새로 쓸 때만 보여준다 */
  frequent: FrequentExpense[];
  /** 저장된 지출 — 문자 붙여넣기에서 '전에 고른 카테고리'를 찾는 데 쓴다 */
  expenseHistory: Expense[];
  onSaveExpense: React.ComponentProps<typeof ExpenseForm>['onSave'];
  onDeleteExpense: (id: string) => void;
  onSaveIncome: React.ComponentProps<typeof IncomeForm>['onSave'];
  onDeleteIncome: (id: string) => void;
  /** 경조사·용돈 — 경조사 장부에 쌓인다 (낸 돈은 저금통에서도 빠진다) */
  onSaveGift: React.ComponentProps<typeof GiftForm>['onSave'];
  /** 이 폰 주인 (없으면 첫 번째 사람) */
  defaultPersonId?: string;
  onSetOwner?: (personId: string) => void;
  /** 지출 날짜를 미리 채워서 열 때 (홈의 '입력이 빠진 날') */
  initialDate?: string;
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
  editingExpense, editingIncome, frequent, expenseHistory,
  onSaveExpense, onDeleteExpense, onSaveIncome, onDeleteIncome, onSaveGift,
  defaultPersonId, onSetOwner, initialDate, onDone,
}: Props) {
  const editing = !!(editingExpense || editingIncome);
  // 칩으로 고른 지출. seq 로 같은 칩 재선택도 구분한다
  const [preset, setPreset] = useState<{ item: FormPreset; seq: number } | undefined>();

  const title = editingExpense ? '내역 수정'
    : editingIncome ? '수입 수정'
    : mode === 'income' ? '들어온 돈 입력'
    : mode === 'gift' ? '경조사 · 용돈 적기'
    : '쓴 돈 입력';

  const tab = (m: AddMode, color: string): React.CSSProperties => ({
    flex: 1, padding: '10px 0', borderRadius: 9, cursor: 'pointer', fontSize: 13.5,
    whiteSpace: 'nowrap',
    border: 'none',
    background: mode === m ? '#fff' : 'transparent',
    color: mode === m ? color : '#8B95A1',
    fontWeight: mode === m ? 700 : 500,
    boxShadow: mode === m ? '0 1px 3px rgba(0,0,0,0.12)' : 'none',
  });

  return (
    <div>
      <div style={{
        background: '#fff', padding: '14px 16px', boxShadow: 'none', borderBottom: '1px solid #F2F4F6',
        position: 'sticky', top: 0, zIndex: 10,
      }}>
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>{title}</h2>

        {/* 고치는 중에는 전환을 숨긴다 — 지출을 수입으로 바꿀 수는 없다 */}
        {!editing && (
          <div style={{
            display: 'flex', gap: 4, marginTop: 12, padding: 4,
            background: '#F2F4F6', borderRadius: 11,
          }}>
            <button onClick={() => onModeChange('expense')} style={tab('expense', '#F04452')}>
              − 쓴 돈
            </button>
            <button onClick={() => onModeChange('income')} style={tab('income', '#12B76A')}>
              + 들어온 돈
            </button>
            {/* 축의금·부의금·용돈 — 여기서 적으면 경조사 장부에 저절로 쌓인다 */}
            <button onClick={() => onModeChange('gift')} style={tab('gift', '#8e6f00')}>
              경조사
            </button>
          </div>
        )}
      </div>

      {mode === 'gift' && !editing ? (
        <>
          <div style={{
            margin: '14px 16px 0', padding: '10px 12px', borderRadius: 9,
            background: '#fffaf0', border: '1px solid #f5deb3',
            fontSize: 12, color: '#8a6d1a', lineHeight: 1.6,
          }}>
            여기서 적으면 <b>경조사 탭 장부</b>에 저절로 쌓여요. <b>낸 돈</b>은 쓴 돈으로도 쳐서 저금통에서 빠지고, 받은 돈은 장부에만 남아요.
          </div>
          <GiftForm
            embedded
            persons={persons}
            defaultPersonId={defaultPersonId}
            onSave={onSaveGift}
            onDone={onDone}
          />
        </>
      ) : mode === 'income' || editingIncome ? (
        <IncomeForm
          month={month}
          persons={persons}
          budget={budget}
          initial={editingIncome}
          defaultPersonId={defaultPersonId}
          onSave={onSaveIncome}
          onDelete={onDeleteIncome}
          onDone={onDone}
        />
      ) : (
        <>
          {/* 자주 쓰는 지출 — 누르면 칸만 채워지고, 저장은 한 번 더 눌러야 한다 */}
          {/* 문자·알림 붙여넣기 — 칸만 채운다. 직접 입력은 아래에서 그대로 된다 */}
          {!editing && (
            <PasteBox
              history={expenseHistory}
              onFill={item => setPreset(p => ({ item, seq: (p?.seq ?? 0) + 1 }))}
            />
          )}
          {!editing && (
            <FrequentChips
              items={frequent}
              onPick={item => setPreset(p => ({ item, seq: (p?.seq ?? 0) + 1 }))}
            />
          )}
          <ExpenseForm
            persons={persons}
            budget={budget}
            initial={editingExpense}
            preset={editing ? undefined : preset}
            defaultPersonId={defaultPersonId}
            onSetOwner={onSetOwner}
            initialDate={initialDate}
            onSave={onSaveExpense}
            onDelete={onDeleteExpense}
            onDone={onDone}
          />
        </>
      )}
    </div>
  );
}

import React, { useState } from 'react';
import { Recurring } from '../types';
import { formatAmountInput, parseAmountInput } from '../utils/format';
import { AmountField, NumberField, TextField } from './Field';
import Sheet from './Sheet';
import { COLOR } from './ui';

interface Props {
  recurring: Recurring | null;
  onSave: (v: { name: string; amount: number; payDay: number; memo: string }) => void;
  onDelete?: () => void;
  onClose: () => void;
}

/** couple-budget의 FixedExpenseCard와 같은 목록 — 빈 화면에서 첫 입력을 쉽게 만든다 */
const SUGGESTIONS = ['보험료', '통신비', '관리비', '구독료', '학원비', '교통비', '적금'];

export default function RecurringSheet({ recurring, onSave, onDelete, onClose }: Props) {
  const [name, setName] = useState(recurring?.name ?? '');
  const [amount, setAmount] = useState(
    recurring ? formatAmountInput(String(recurring.amount)) : '');
  const [payDay, setPayDay] = useState(String(recurring?.payDay ?? 25));
  const [memo, setMemo] = useState(recurring?.memo ?? '');

  const dayNum = Number(payDay) || 0;

  const reason =
    !name.trim() ? '이름을 적어주세요.'
    : !amount.trim() ? '금액을 적어주세요.'
    : dayNum < 1 || dayNum > 31 ? '결제일은 1일부터 31일 사이로 적어주세요.'
    : undefined;

  return (
    <Sheet
      title={recurring ? '고정비 수정' : '고정비 추가'}
      onClose={onClose}
      onDelete={onDelete}
      saveDisabledReason={reason}
      onSave={() => onSave({
        name: name.trim(),
        amount: parseAmountInput(amount),
        payDay: dayNum,
        memo: memo.trim(),
      })}
    >
      <TextField label="이름" value={name} onChange={setName} placeholder="예) 보험료" />

      {!recurring && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, margin: '-6px 0 14px' }}>
          {SUGGESTIONS.map(s => (
            <button
              key={s}
              onClick={() => setName(s)}
              style={{
                padding: '6px 11px', borderRadius: 999,
                border: `1px solid ${COLOR.line}`, background: '#fbfcfd',
                color: COLOR.sub, fontSize: 13, cursor: 'pointer',
              }}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <AmountField label="매달 나가는 금액" value={amount} onChange={setAmount} />

      <NumberField label="결제일" value={payDay} onChange={setPayDay} suffix="일" min={1} max={31} />

      <TextField label="메모 (선택)" value={memo} onChange={setMemo} placeholder="" />
    </Sheet>
  );
}

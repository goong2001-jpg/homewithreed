import React, { useState } from 'react';
import { Asset, Loan, REPAY_METHODS, REPAY_METHOD_HINT, RepayMethod } from '../types';
import { todayKey } from '../utils/date';
import { formatAmountInput, monthsLabel, parseAmountInput, shortDate, won } from '../utils/format';
import { loanStatus } from '../utils/loan';
import {
  AmountField, ChoiceField, DateField, NumberField, PreviewBox, RateField, TextField,
} from './Field';
import Sheet from './Sheet';

interface Props {
  loan: Loan | null;
  assets: Asset[];
  onSave: (v: Omit<Loan, 'id' | 'updatedAt' | 'createdAt' | 'order' | 'deleted'>) => void;
  onDelete?: () => void;
  onClose: () => void;
}

export default function LoanSheet({ loan, assets, onSave, onDelete, onClose }: Props) {
  const [name, setName] = useState(loan?.name ?? '');
  const [principal, setPrincipal] = useState(
    loan ? formatAmountInput(String(loan.principal)) : '');
  const [rate, setRate] = useState(loan ? String(loan.rate) : '');
  const [method, setMethod] = useState<RepayMethod>(loan?.method ?? '원리금균등');
  const [startDate, setStartDate] = useState(loan?.startDate ?? todayKey());
  const [termMonths, setTermMonths] = useState(loan ? String(loan.termMonths) : '');
  const [graceMonths, setGraceMonths] = useState(loan ? String(loan.graceMonths) : '0');
  const [linkedAssetId, setLinkedAssetId] = useState(loan?.linkedAssetId ?? '');
  const [memo, setMemo] = useState(loan?.memo ?? '');

  // 중도상환 등으로 계산과 실제가 어긋났을 때 쓰는 직접 입력
  const [mode, setMode] = useState<'auto' | 'manual'>(
    loan?.manualRemaining != null ? 'manual' : 'auto');
  const [manualRemaining, setManualRemaining] = useState(
    loan?.manualRemaining != null ? formatAmountInput(String(loan.manualRemaining)) : '');
  const [manualPayment, setManualPayment] = useState(
    loan?.manualPayment != null ? formatAmountInput(String(loan.manualPayment)) : '');
  const [manualAsOf, setManualAsOf] = useState(loan?.manualAsOf ?? todayKey());

  const isManual = mode === 'manual';

  const draft: Loan = {
    id: loan?.id ?? 'draft',
    name: name.trim(),
    principal: parseAmountInput(principal),
    rate: Number(rate) || 0,
    method,
    startDate: startDate || todayKey(),
    termMonths: Number(termMonths) || 0,
    graceMonths: Number(graceMonths) || 0,
    linkedAssetId: linkedAssetId || null,
    // '계산해줘'로 되돌리면 적어둔 값을 지워서 계산으로 완전히 돌아가게 한다
    manualRemaining: isManual && manualRemaining.trim() ? parseAmountInput(manualRemaining) : null,
    manualPayment: isManual && manualPayment.trim() ? parseAmountInput(manualPayment) : null,
    manualAsOf: isManual ? (manualAsOf || todayKey()) : null,
    memo: memo.trim(),
    order: loan?.order ?? 0,
    createdAt: loan?.createdAt ?? 0,
    updatedAt: 0,
  };

  // 입력하는 동안 바로 계산해서 보여준다 — 숫자를 잘못 넣은 걸 저장 전에 알아채게
  const ready = draft.principal > 0 && draft.termMonths > 0;
  const st = ready ? loanStatus(draft, todayKey()) : null;

  const reason =
    !name.trim() ? '대출 이름을 적어주세요.'
    : draft.principal <= 0 ? '빌린 금액을 적어주세요.'
    : draft.termMonths <= 0 ? '상환 기간(개월)을 적어주세요.'
    : draft.graceMonths > draft.termMonths ? '거치기간이 전체 기간보다 길어요.'
    : isManual && !manualRemaining.trim() ? '지금 남은 원금을 적어주세요.'
    : undefined;

  const linkable = assets.filter(a => !a.deleted);

  return (
    <Sheet
      title={loan ? '대출 수정' : '대출 추가'}
      onClose={onClose}
      onDelete={onDelete}
      saveDisabledReason={reason}
      onSave={() => onSave({
        name: draft.name,
        principal: draft.principal,
        rate: draft.rate,
        method: draft.method,
        startDate: draft.startDate,
        termMonths: draft.termMonths,
        graceMonths: draft.graceMonths,
        linkedAssetId: draft.linkedAssetId,
        manualRemaining: draft.manualRemaining,
        manualPayment: draft.manualPayment,
        manualAsOf: draft.manualAsOf,
        memo: draft.memo,
      })}
    >
      <TextField
        label="대출 이름"
        value={name}
        onChange={setName}
        placeholder="예) 전세자금대출, 주택담보대출"
      />

      <AmountField label="빌린 금액 (최초 원금)" value={principal} onChange={setPrincipal} />

      <RateField label="연이율" value={rate} onChange={setRate} hint="연 3.5%면 3.5라고 적으세요." />

      <ChoiceField
        label="상환 방식"
        value={method}
        columns={3}
        options={REPAY_METHODS.map(m => ({ value: m, label: m }))}
        onChange={setMethod}
        hint={REPAY_METHOD_HINT[method]}
      />

      <DateField label="대출 실행일" value={startDate} onChange={setStartDate} />

      <NumberField
        label="총 상환 기간"
        value={termMonths}
        onChange={setTermMonths}
        suffix="개월"
        hint={draft.termMonths > 0 ? `${monthsLabel(draft.termMonths)}` : '10년이면 120이라고 적으세요.'}
      />

      {method !== '만기일시' && (
        <NumberField
          label="거치기간"
          value={graceMonths}
          onChange={setGraceMonths}
          suffix="개월"
          hint="원금은 그대로 두고 이자만 내는 기간. 없으면 0."
        />
      )}

      {/* 중도상환하면 원금·금리·기간으로 하는 계산이 실제와 어긋난다.
          은행 앱에 찍힌 값을 그대로 적을 수 있게 해준다. */}
      <ChoiceField
        label="지금 남은 원금"
        value={mode}
        options={[
          { value: 'auto', label: '계산해줘' },
          { value: 'manual', label: '직접 적을게' },
        ]}
        onChange={setMode}
        hint={isManual
          ? '적은 값은 저절로 줄지 않아요. 가끔 은행 앱 보고 갱신해 주세요.'
          : '중도상환을 했다면 [직접 적을게]로 바꿔주세요.'}
      />

      {isManual && (
        <>
          <AmountField
            label="남은 원금"
            value={manualRemaining}
            onChange={setManualRemaining}
            hint="은행 앱에 찍힌 대출 잔액"
          />
          <AmountField
            label="월 상환액 (선택)"
            value={manualPayment}
            onChange={setManualPayment}
            allowEmpty
            hint="중도상환하고 상환액이 바뀌었다면 적어주세요. 비우면 남은 원금으로 계산해요."
          />
          <DateField
            label="언제 기준인가요"
            value={manualAsOf}
            onChange={setManualAsOf}
            hint="화면에 이 날짜가 같이 뜹니다. 숫자가 낡았는지 알 수 있게요."
          />
        </>
      )}

      {st && (
        <PreviewBox rows={[
          {
            label: st.done ? '상환 완료'
              : st.inGrace ? '이번 달 낼 돈 (거치 중, 이자만)'
              : '이번 달 낼 돈',
            value: won(st.monthlyPayment),
            strong: true,
          },
          { label: '남은 원금', value: won(st.remainingPrincipal) },
          {
            label: st.isManual ? '앞으로 낼 이자 (예상)' : '만기까지 낼 이자',
            // 상환액이 이자에도 못 미치면 잔액이 안 줄어든다. 0원이라고 하면 거짓말이다.
            value: st.isManual && st.monthlyPrincipal <= 0 && !st.done
              ? '상환액이 이자보다 적어요'
              : won(st.totalInterest),
          },
          { label: '만기일', value: `${shortDate(st.endDate)} (${monthsLabel(st.remainingMonths)} 남음)` },
        ]} />
      )}

      {linkable.length > 0 && (
        <ChoiceField
          label="어떤 자산 때문에 빌렸나요 (선택)"
          value={linkedAssetId}
          columns={2}
          options={[
            { value: '', label: '연결 안 함' },
            ...linkable.map(a => ({ value: a.id, label: a.name })),
          ]}
          onChange={setLinkedAssetId}
        />
      )}

      <TextField label="메모 (선택)" value={memo} onChange={setMemo} placeholder="" />
    </Sheet>
  );
}

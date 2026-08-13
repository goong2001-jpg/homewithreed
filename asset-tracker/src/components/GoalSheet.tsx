import React, { useState } from 'react';
import {
  Asset, GOAL_SOURCE_META, Goal, GoalSource, LIQUIDITY_META,
} from '../types';
import { assetLiquidity } from '../utils/summary';
import { goalProgress, readyAmount } from '../utils/goal';
import { AssetEquity } from '../types';
import { todayKey } from '../utils/date';
import {
  ddayLabel, formatAmountInput, monthsLabel, parseAmountInput, shortWon, won,
} from '../utils/format';
import { alive } from '../utils/merge';
import { AmountField, ChoiceField, DateField, PreviewBox, TextField } from './Field';
import Sheet from './Sheet';
import { COLOR } from './ui';

interface Props {
  goal: Goal | null;
  assets: Asset[];
  equityByAsset: Record<string, AssetEquity>;
  today: string;
  onSave: (v: Omit<Goal, 'id' | 'updatedAt' | 'createdAt' | 'order' | 'deleted'>) => void;
  onDelete?: () => void;
  onClose: () => void;
}

const SOURCES: GoalSource[] = ['liquid', 'all', 'picked'];

export default function GoalSheet({
  goal, assets, equityByAsset, today, onSave, onDelete, onClose,
}: Props) {
  const [name, setName] = useState(goal?.name ?? '');
  const [totalPrice, setTotalPrice] = useState(
    goal ? formatAmountInput(String(goal.totalPrice)) : '');
  const [netPrice, setNetPrice] = useState(
    goal?.netPrice != null ? formatAmountInput(String(goal.netPrice)) : '');
  const [extraCost, setExtraCost] = useState(
    goal ? formatAmountInput(String(goal.extraCost)) : '');
  const [expectedLoan, setExpectedLoan] = useState(
    goal ? formatAmountInput(String(goal.expectedLoan)) : '');
  const [targetDate, setTargetDate] = useState(goal?.targetDate ?? '');
  const [source, setSource] = useState<GoalSource>(goal?.source ?? 'liquid');
  const [assetIds, setAssetIds] = useState<string[]>(goal?.assetIds ?? []);
  const [memo, setMemo] = useState(goal?.memo ?? '');

  const liveAssets = alive(assets);

  const draft: Goal = {
    id: goal?.id ?? 'draft',
    name: name.trim(),
    totalPrice: parseAmountInput(totalPrice),
    netPrice: netPrice.trim() ? parseAmountInput(netPrice) : null,
    extraCost: parseAmountInput(extraCost),
    expectedLoan: parseAmountInput(expectedLoan),
    targetDate: targetDate || null,
    source,
    assetIds,
    achievedAt: goal?.achievedAt ?? null,
    memo: memo.trim(),
    order: goal?.order ?? 0,
    createdAt: goal?.createdAt ?? 0,
    updatedAt: 0,
  };

  // 입력하는 동안 바로 계산해서 보여준다 — 숫자를 잘못 넣은 걸 저장 전에 알아채게
  const ready = readyAmount(draft, assets, equityByAsset);
  const p = goalProgress(draft, ready, today);
  const showPreview = draft.totalPrice > 0 || draft.netPrice;

  const reason =
    !name.trim() ? '목표 이름을 적어주세요.'
    : draft.totalPrice <= 0 && !draft.netPrice ? '필요한 금액을 적어주세요.'
    : source === 'picked' && assetIds.length === 0 ? '이 목표에 쓸 자산을 골라주세요.'
    : undefined;

  const toggleAsset = (id: string) =>
    setAssetIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  return (
    <Sheet
      title={goal ? '목표 수정' : '목표 추가'}
      onClose={onClose}
      onDelete={onDelete}
      saveDisabledReason={reason}
      onSave={() => onSave({
        name: draft.name,
        totalPrice: draft.totalPrice,
        netPrice: draft.netPrice,
        extraCost: draft.extraCost,
        expectedLoan: draft.expectedLoan,
        targetDate: draft.targetDate,
        source: draft.source,
        assetIds: draft.assetIds,
        achievedAt: draft.achievedAt,
        memo: draft.memo,
      })}
    >
      <TextField
        label="목표 이름"
        value={name}
        onChange={setName}
        placeholder="예) 진접2지구 A1블록 입주자금"
      />

      <AmountField
        label="총 분양가 · 목표 금액"
        value={totalPrice}
        onChange={setTotalPrice}
      />

      <AmountField
        label="실제 낼 금액 (선택)"
        value={netPrice}
        onChange={setNetPrice}
        allowEmpty
        hint="옵션을 뺀 실제 계약금처럼 다르면 적어주세요. 비우면 위 금액으로 계산해요."
      />

      <AmountField
        label="취득세·이사비 등 부대비용 (선택)"
        value={extraCost}
        onChange={setExtraCost}
        allowEmpty
        hint="분양가엔 안 잡히는데 입주 때 목돈으로 나갑니다. 빼먹으면 막판에 모자라요."
      />

      <AmountField
        label="예상 대출"
        value={expectedLoan}
        onChange={setExpectedLoan}
        allowEmpty
        hint="이만큼은 빌려서 낼 예정. 나머지가 내가 모아야 할 돈입니다."
      />

      <DateField
        label="목표일 (선택)"
        value={targetDate}
        onChange={setTargetDate}
        clearable
        hint="입주일을 넣으면 매달·매일 얼마씩 모아야 하는지 알려드려요."
      />

      <ChoiceField
        label="준비된 돈을 어떻게 셀까요"
        value={source}
        columns={3}
        options={SOURCES.map(s => ({ value: s, label: GOAL_SOURCE_META[s].label }))}
        onChange={setSource}
        hint={GOAL_SOURCE_META[source].hint}
      />

      {source === 'picked' && (
        <div style={{ marginBottom: 14 }}>
          {liveAssets.length === 0 ? (
            <p style={{ margin: 0, fontSize: 13, color: COLOR.faint }}>
              아직 넣은 자산이 없어요.
            </p>
          ) : (
            liveAssets.map(a => {
              const on = assetIds.includes(a.id);
              const eq = equityByAsset[a.id];
              return (
                <button
                  key={a.id}
                  onClick={() => toggleAsset(a.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 9, width: '100%',
                    padding: '11px 12px', marginBottom: 6,
                    borderRadius: 9, cursor: 'pointer', font: 'inherit', textAlign: 'left',
                    border: `1px solid ${on ? COLOR.accent : COLOR.line}`,
                    background: on ? '#eef2f5' : '#fbfcfd',
                    color: COLOR.text,
                  }}
                >
                  <span style={{ fontSize: 15 }}>{on ? '☑️' : '⬜'}</span>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {LIQUIDITY_META[assetLiquidity(a)].emoji} {a.name}
                  </span>
                  <strong style={{ fontSize: 14, fontVariantNumeric: 'tabular-nums' }}>
                    {shortWon(eq?.equity ?? a.value)}
                  </strong>
                </button>
              );
            })
          )}
        </div>
      )}

      {showPreview && (
        <PreviewBox rows={[
          { label: '총 필요액', value: won(p.totalNeeded) },
          { label: '예상 대출', value: `− ${won(p.expectedLoan)}` },
          { label: '내가 모아야 할 돈', value: won(p.cashNeeded), strong: true },
          { label: '지금 준비된 돈', value: won(p.ready) },
          {
            label: p.shortfall > 0 ? '아직 모자란 돈' : '달성',
            value: p.shortfall > 0 ? won(p.shortfall) : '다 모았어요',
            strong: true,
          },
          ...(p.perMonth != null ? [{
            label: `매달 모아야 (${monthsLabel(p.monthsLeft ?? 0)} 남음)`,
            value: won(p.perMonth),
          }] : []),
          ...(targetDate ? [{
            label: '목표일',
            value: ddayLabel(targetDate, today || todayKey()),
          }] : []),
        ]} />
      )}

      <TextField label="메모 (선택)" value={memo} onChange={setMemo} placeholder="" />
    </Sheet>
  );
}

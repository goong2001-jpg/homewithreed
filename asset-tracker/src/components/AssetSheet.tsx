import React, { useState } from 'react';
import {
  Asset, AssetEquity, AssetKind, DEFAULT_LIQUIDITY, FALLBACK_LIQUIDITY,
  LIQUIDITY_LEVELS, LIQUIDITY_META, Liquidity,
} from '../types';
import { formatAmountInput, parseAmountInput, signedPercent, signedWon, won } from '../utils/format';
import { AmountField, ChoiceField, DateField, PreviewBox, TextField } from './Field';
import Sheet from './Sheet';
import { COLOR } from './ui';

interface Props {
  /** 없으면 새로 추가 */
  asset: Asset | null;
  kinds: AssetKind[];
  /** 새로 추가할 때 미리 골라둘 분류 */
  defaultKindId: string;
  onSave: (v: {
    kindId: string; name: string; value: number;
    principal: number | null; maturity: string | null;
    liquidity: Liquidity | null; memo: string;
  }) => void;
  onDelete?: () => void;
  onClose: () => void;
  /** 이 자산에 걸린 대출 (연결된 게 있을 때만) */
  equity?: AssetEquity;
}

/** 분류마다 이름 칸에 다른 예시를 띄운다 */
const NAME_PLACEHOLDER: Record<string, string> = {
  k_jeonse: '예) 수지 아파트 전세',
  k_deposit: '예) 주택청약, 정기적금',
  k_invest: '예) 삼성전자, 비트코인',
  k_cash: '예) 비상금 통장',
};

export default function AssetSheet({
  asset, kinds, defaultKindId, onSave, onDelete, onClose, equity,
}: Props) {
  const [kindId, setKindId] = useState(asset?.kindId ?? defaultKindId);
  const [name, setName] = useState(asset?.name ?? '');
  const [value, setValue] = useState(
    asset ? formatAmountInput(String(asset.value)) : '');
  const [principal, setPrincipal] = useState(
    asset?.principal != null ? formatAmountInput(String(asset.principal)) : '');
  const [maturity, setMaturity] = useState(asset?.maturity ?? '');
  const [memo, setMemo] = useState(asset?.memo ?? '');

  /**
   * 유동성. 직접 고르기 전까지는 null로 두고 분류 기본값을 따라간다 —
   * 분류를 바꾸면 기본값도 같이 바뀌어야 자연스럽다.
   */
  const [liquidity, setLiquidity] = useState<Liquidity | null>(asset?.liquidity ?? null);
  const shownLiquidity: Liquidity =
    liquidity ?? DEFAULT_LIQUIDITY[kindId] ?? FALLBACK_LIQUIDITY;

  const valueNum = parseAmountInput(value);
  const principalNum = principal.trim() ? parseAmountInput(principal) : null;

  const profit = principalNum && principalNum > 0 ? valueNum - principalNum : null;
  const profitRatio = principalNum && principalNum > 0 ? (valueNum - principalNum) / principalNum : null;

  const reason =
    !name.trim() ? '이름을 적어주세요.'
    : !value.trim() ? '지금 얼마인지 적어주세요.'
    : undefined;

  return (
    <Sheet
      title={asset ? '자산 수정' : '자산 추가'}
      onClose={onClose}
      onDelete={onDelete}
      saveDisabledReason={reason}
      onSave={() => onSave({
        kindId,
        name: name.trim(),
        value: valueNum,
        principal: principalNum,
        maturity: maturity || null,
        liquidity,
        memo: memo.trim(),
      })}
    >
      <ChoiceField
        label="분류"
        value={kindId}
        columns={3}
        options={kinds.map(k => ({ value: k.id, label: `${k.emoji} ${k.name}`, color: k.color }))}
        onChange={setKindId}
      />

      <TextField
        label="이름"
        value={name}
        onChange={setName}
        placeholder={NAME_PLACEHOLDER[kindId] ?? '예) 자산 이름'}
      />

      <AmountField label="지금 얼마" value={value} onChange={setValue} />

      {/* 걸린 대출을 빼야 진짜 내 돈이 보인다.
          전세보증금 9,900만원에 대출 6,600만원이면 실제로는 3,300만원이 내 몫이다. */}
      {equity && equity.debt > 0 ? (
        <PreviewBox rows={[
          { label: '이 자산에 걸린 대출', value: `− ${won(equity.debt)}` },
          { label: '내 몫', value: won(Math.max(0, valueNum - equity.debt)), strong: true },
        ]} />
      ) : (
        <p style={{ margin: '-6px 0 14px', fontSize: 12, color: COLOR.faint, lineHeight: 1.6 }}>
          이 자산 때문에 받은 대출이 있다면, <strong>나가는돈 → 대출</strong>에서
          <strong> 어떤 자산 때문에 빌렸나요</strong>로 연결해 주세요.
          그러면 대출을 뺀 <strong>내 몫</strong>이 같이 보입니다.
        </p>
      )}

      <ChoiceField
        label="언제 쓸 수 있나요"
        value={shownLiquidity}
        options={LIQUIDITY_LEVELS.map(l => ({
          value: l,
          label: `${LIQUIDITY_META[l].emoji} ${LIQUIDITY_META[l].label}`,
          color: LIQUIDITY_META[l].color,
        }))}
        onChange={setLiquidity}
        hint={LIQUIDITY_META[shownLiquidity].hint}
      />

      <AmountField
        label="산 가격 · 원금 (선택)"
        value={principal}
        onChange={setPrincipal}
        allowEmpty
        hint="적어두면 수익률을 계산해요. 전세보증금처럼 원금 그대로인 자산은 비워두세요."
      />

      {profit !== null && profitRatio !== null && (
        <PreviewBox rows={[
          { label: '평가손익', value: signedWon(profit), strong: true },
          { label: '수익률', value: signedPercent(profitRatio) },
        ]} />
      )}

      <DateField
        label="만기일 · 계약 만료일 (선택)"
        value={maturity}
        onChange={setMaturity}
        clearable
        hint="적어두면 홈 화면에 D-day로 띄워줘요."
      />

      <TextField label="메모 (선택)" value={memo} onChange={setMemo} placeholder="" />
    </Sheet>
  );
}

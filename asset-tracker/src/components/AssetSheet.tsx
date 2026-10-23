import React, { useState } from 'react';
import {
  Asset, AssetEquity, AssetKind, DateKey, DEFAULT_LIQUIDITY, FALLBACK_LIQUIDITY,
  LIQUIDITY_LEVELS, LIQUIDITY_META, Liquidity, ValuePoint,
} from '../types';
import { addMonths, todayKey } from '../utils/date';
import { formatAmountInput, parseAmountInput, shortDate, signedPercent, signedWon, won } from '../utils/format';
import { appendHistory, returnSince } from '../utils/history';
import { AmountField, ChoiceField, DateField, PreviewBox, TextField } from './Field';
import Sheet from './Sheet';
import { COLOR } from './ui';

interface Props {
  /** 없으면 새로 추가 */
  asset: Asset | null;
  kinds: AssetKind[];
  /** 새로 추가할 때 미리 골라둘 분류 */
  defaultKindId: string;
  today: DateKey;
  onSave: (v: {
    kindId: string; name: string; value: number;
    principal: number | null; maturity: string | null;
    liquidity: Liquidity | null; memo: string;
    valueHistory: ValuePoint[];
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
  asset, kinds, defaultKindId, today, onSave, onDelete, onClose, equity,
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
   * 평가액 이력. 시트 안에서 줄을 지울 수 있으므로 상태로 들고 있다가 저장할 때 같이 넘긴다.
   * 이력이 아예 없는 예전 기록은 '마지막으로 고친 날의 평가액'을 첫 줄로 깔아준다 —
   * 불러올 때가 아니라 저장할 때 하는 이유는, 안 고친 기록까지 updatedAt 이 바뀌면 안 되기 때문이다.
   */
  const [history, setHistory] = useState<ValuePoint[]>(() => {
    if (!asset) return [];
    if (asset.valueHistory && asset.valueHistory.length) return asset.valueHistory;
    const seedDate = asset.updatedAt > 0 ? todayKey(new Date(asset.updatedAt)) : today;
    return appendHistory([], seedDate, asset.value);
  });
  const [historyOpen, setHistoryOpen] = useState(false);

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

  /** 저장할 이력: 평가액이 바뀌었거나(새 자산 포함) 이력이 비었으면 오늘 값을 한 줄 더한다 */
  const historyToSave = (): ValuePoint[] =>
    (!asset || valueNum !== asset.value || history.length === 0)
      ? appendHistory(history, today, valueNum)
      : history;

  const sinceFirst = history.length ? returnSince(history, history[0].date, valueNum) : null;
  const sinceMonth = returnSince(history, addMonths(today, -1), valueNum);

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
        valueHistory: historyToSave(),
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

      {/* ── 평가액 이력 (수정할 때만) ───────────── */}
      {asset && (
        <div style={{ marginBottom: 14, border: `1px solid ${COLOR.line}`, borderRadius: 9, overflow: 'hidden' }}>
          <button
            onClick={() => setHistoryOpen(o => !o)}
            aria-expanded={historyOpen}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, width: '100%',
              padding: '11px 13px', background: '#fbfcfd', border: 'none',
              cursor: 'pointer', font: 'inherit', color: COLOR.text, textAlign: 'left',
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 600, color: COLOR.sub, flex: 1 }}>
              평가액 이력
              <span style={{ fontWeight: 500, color: COLOR.faint, marginLeft: 5 }}>{history.length}건</span>
            </span>
            {sinceFirst && sinceFirst.ratio !== null && (
              <span style={{ fontSize: 12, fontWeight: 700, color: sinceFirst.change < 0 ? COLOR.debt : COLOR.plus }}>
                {signedPercent(sinceFirst.ratio)}
              </span>
            )}
            <span style={{ fontSize: 11, color: COLOR.faint }}>{historyOpen ? '▴' : '▾'}</span>
          </button>

          {historyOpen && (
            <div>
              {(sinceFirst || sinceMonth) && (
                <div style={{ padding: '10px 13px', background: '#f4f7f9', fontSize: 12 }}>
                  {sinceFirst && (
                    <ReturnRow label={`첫 기록(${shortDate(sinceFirst.from.date)}) 이후`} r={sinceFirst} />
                  )}
                  {sinceMonth && (
                    <ReturnRow label="한 달 전 대비" r={sinceMonth} />
                  )}
                </div>
              )}
              {history.length === 0 && (
                <p style={{ margin: 0, padding: '12px 13px', fontSize: 12, color: COLOR.faint }}>
                  저장하면 오늘 평가액이 첫 줄로 들어가요.
                </p>
              )}
              {history.slice().reverse().map((p, i, arr) => (
                <div
                  key={p.date}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '9px 13px',
                    borderTop: i === 0 && !(sinceFirst || sinceMonth) ? 'none' : `1px solid ${COLOR.line}`,
                    fontSize: 13,
                  }}
                >
                  <span style={{ color: COLOR.sub, width: 84 }}>{shortDate(p.date)}</span>
                  <strong style={{ flex: 1, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{won(p.value)}</strong>
                  <button
                    onClick={() => setHistory(h => h.filter(q => q.date !== p.date))}
                    aria-label={`${shortDate(p.date)} 이력 지우기`}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: COLOR.faint, fontSize: 15, padding: '0 2px', lineHeight: 1,
                    }}
                  >
                    ✕
                  </button>
                </div>
              ))}
              <p style={{ margin: 0, padding: '8px 13px 10px', fontSize: 11, color: COLOR.faint, lineHeight: 1.5 }}>
                '지금 얼마'를 고쳐 저장하면 오늘 날짜로 한 줄 쌓여요. 같은 날은 마지막 값만 남습니다.
              </p>
            </div>
          )}
        </div>
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

function ReturnRow({ label, r }: { label: string; r: { change: number; ratio: number | null } }) {
  const color = r.change < 0 ? COLOR.debt : r.change > 0 ? COLOR.plus : COLOR.sub;
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 4 }}>
      <span style={{ color: COLOR.sub }}>{label}</span>
      <strong style={{ color, fontVariantNumeric: 'tabular-nums' }}>
        {signedWon(r.change)}
        {r.ratio !== null && <span style={{ marginLeft: 5, opacity: 0.85 }}>{signedPercent(r.ratio)}</span>}
      </strong>
    </div>
  );
}

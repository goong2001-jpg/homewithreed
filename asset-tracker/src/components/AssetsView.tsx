import React from 'react';
import { Asset, AssetEquity, AssetKind, DateKey, LIQUIDITY_META } from '../types';
import { ddayLabel, shortWon, signedPercent, won } from '../utils/format';
import { alive } from '../utils/merge';
import { assetLiquidity } from '../utils/summary';
import { COLOR, card, empty, ghostButton, row, sectionTitle } from './ui';

interface Props {
  kinds: AssetKind[];
  assets: Asset[];
  totalAsset: number;
  /** 자산별 걸린 대출과 내 몫 */
  equityByAsset: Record<string, AssetEquity>;
  today: DateKey;
  onAdd: (kindId: string) => void;
  onEdit: (a: Asset) => void;
  onAddKind: () => void;
  onEditKind: (k: AssetKind) => void;
}

/**
 * 분류별로 묶어 보여준다.
 * 분류마다 ➕ 를 두는 게 중요하다 — 어느 분류에 넣을지 고르는 단계가 통째로 사라진다.
 */
export default function AssetsView({
  kinds, assets, totalAsset, equityByAsset, today, onAdd, onEdit, onAddKind, onEditKind,
}: Props) {
  const liveKinds = alive(kinds).slice().sort((a, b) => a.order - b.order);
  const liveAssets = alive(assets);

  // 분류가 지워진 자산이 화면에서 조용히 사라지지 않게 따로 모은다
  const knownIds = new Set(liveKinds.map(k => k.id));
  const orphans = liveAssets.filter(a => !knownIds.has(a.kindId));

  return (
    <div>
      <div style={{ ...card, marginTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: COLOR.sub }}>총자산</span>
        <strong style={{ fontSize: 24, fontWeight: 800, color: COLOR.asset, fontVariantNumeric: 'tabular-nums' }}>
          {won(totalAsset)}
        </strong>
      </div>

      {liveAssets.length === 0 && (
        <div style={{ ...card, ...empty }}>
          자산을 넣으면 여기 모여요.<br />
          아래 분류에서 <strong>＋</strong> 를 눌러보세요.
        </div>
      )}

      {liveKinds.map(k => {
        const mine = liveAssets
          .filter(a => a.kindId === k.id)
          .sort((a, b) => b.value - a.value);
        const sum = mine.reduce((t, a) => t + a.value, 0);

        return (
          <div key={k.id}>
            <div
              style={{
                ...sectionTitle,
                display: 'flex', alignItems: 'center', gap: 8,
              }}
            >
              <span
                style={{
                  width: 8, height: 8, borderRadius: '50%', background: k.color,
                }}
              />
              <button
                onClick={() => onEditKind(k)}
                style={{
                  background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                  font: 'inherit', color: COLOR.sub,
                }}
              >
                {k.emoji} {k.name} ✎
              </button>
              <span style={{ marginLeft: 'auto', color: COLOR.text, fontSize: 14 }}>
                {sum > 0 ? shortWon(sum) : ''}
              </span>
            </div>

            <div style={{ ...card, margin: '0 16px', padding: 0, overflow: 'hidden' }}>
              {mine.map(a => (
                <AssetRow
                  key={a.id}
                  asset={a}
                  equity={equityByAsset[a.id]}
                  today={today}
                  onClick={() => onEdit(a)}
                />
              ))}
              <button
                onClick={() => onAdd(k.id)}
                style={{
                  ...row,
                  borderBottom: 'none',
                  color: COLOR.faint,
                  fontSize: 14,
                  justifyContent: 'center',
                }}
              >
                ＋ {k.name} 추가
              </button>
            </div>
          </div>
        );
      })}

      {orphans.length > 0 && (
        <>
          <div style={sectionTitle}>📌 분류 없음</div>
          <div style={{ ...card, margin: '0 16px', padding: 0, overflow: 'hidden' }}>
            {orphans.map(a => (
              <AssetRow key={a.id} asset={a} today={today} onClick={() => onEdit(a)} />
            ))}
          </div>
          <p style={{ margin: '8px 16px 0', fontSize: 12, color: COLOR.faint }}>
            분류를 지워서 갈 곳이 없어진 자산이에요. 눌러서 다른 분류로 옮겨주세요.
          </p>
        </>
      )}

      <div style={{ padding: '20px 16px 0' }}>
        <button style={ghostButton} onClick={onAddKind}>＋ 분류 만들기</button>
      </div>

      <div style={{ height: 24 }} />
    </div>
  );
}

function AssetRow(
  { asset: a, equity, today, onClick }:
  { asset: Asset; equity?: AssetEquity; today: DateKey; onClick: () => void },
) {
  const profit = a.principal && a.principal > 0 ? (a.value - a.principal) / a.principal : null;
  const level = assetLiquidity(a);
  const hasDebt = equity && equity.debt > 0;

  return (
    <button onClick={onClick} style={row}>
      <span title={LIQUIDITY_META[level].label} style={{ fontSize: 15 }}>
        {LIQUIDITY_META[level].emoji}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {a.name}
        </div>
        {(a.maturity || a.memo) && (
          <div style={{ fontSize: 12, color: COLOR.faint, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {a.maturity && ddayLabel(a.maturity, today)}
            {a.maturity && a.memo && ' · '}
            {a.memo}
          </div>
        )}
      </div>
      <div style={{ textAlign: 'right' }}>
        <div
          style={{
            fontSize: 15, fontWeight: 700, fontVariantNumeric: 'tabular-nums',
            // 대출이 걸렸으면 평가액보다 '내 몫'이 주인공이다
            color: hasDebt ? COLOR.faint : COLOR.text,
          }}
        >
          {won(a.value)}
        </div>
        {hasDebt && (
          <div style={{ fontSize: 13, marginTop: 2, color: COLOR.plus, fontWeight: 700 }}>
            내 몫 {won(equity!.equity)}
          </div>
        )}
        {profit !== null && (
          <div style={{ fontSize: 12, marginTop: 2, color: profit < 0 ? COLOR.debt : COLOR.plus }}>
            {signedPercent(profit)}
          </div>
        )}
      </div>
    </button>
  );
}

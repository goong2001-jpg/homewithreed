import React from 'react';
import { Asset, AssetKind, DateKey, Loan, Summary, View } from '../types';
import { ddayLabel, shortWon, signedPercent, signedWon, won } from '../utils/format';
import { loanStatus } from '../utils/loan';
import { alive } from '../utils/merge';
import { UPCOMING_LIMIT } from '../utils/summary';
import { COLOR, card, ddayStyle, empty, ghostButton, row, sectionTitle } from './ui';

interface Props {
  summary: Summary;
  kinds: AssetKind[];
  assets: Asset[];
  loans: Loan[];
  today: DateKey;
  onEditAsset: (a: Asset) => void;
  onEditLoan: (l: Loan) => void;
  onGo: (v: View) => void;
}

export default function HomeView({
  summary: s, kinds, assets, loans, today, onEditAsset, onEditLoan, onGo,
}: Props) {
  const liveAssets = alive(assets);
  const liveLoans = alive(loans);
  const kindById = new Map(alive(kinds).map(k => [k.id, k]));
  const nothing = liveAssets.length === 0 && liveLoans.length === 0;

  return (
    <div>
      {/* ── 순자산 ─────────────────────────────── */}
      <div style={{ ...card, marginTop: 16, padding: '22px 18px' }}>
        <div style={{ fontSize: 13, color: COLOR.sub, fontWeight: 600 }}>순자산</div>
        <div
          style={{
            fontSize: 38,
            fontWeight: 800,
            letterSpacing: '-1.2px',
            marginTop: 4,
            color: s.netWorth < 0 ? COLOR.debt : COLOR.asset,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {shortWon(s.netWorth)}
        </div>
        <div style={{ fontSize: 12, color: COLOR.faint, marginTop: 2 }}>
          {won(s.netWorth)}
        </div>

        <div
          style={{
            display: 'flex', gap: 10, marginTop: 16,
            borderTop: `1px solid ${COLOR.line}`, paddingTop: 14,
          }}
        >
          <Stat label="총자산" value={shortWon(s.totalAsset)} color={COLOR.asset} />
          <div style={{ width: 1, background: COLOR.line }} />
          <Stat label="총부채" value={shortWon(s.totalDebt)} color={COLOR.debt} />
        </div>

        {s.totalPrincipal > 0 && (
          <div
            style={{
              marginTop: 12, paddingTop: 12, borderTop: `1px solid ${COLOR.line}`,
              display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
            }}
          >
            <span style={{ fontSize: 13, color: COLOR.sub }}>투자 평가손익</span>
            <strong
              style={{
                fontSize: 15,
                color: s.totalProfit < 0 ? COLOR.debt : COLOR.plus,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {signedWon(s.totalProfit)}
              <span style={{ fontSize: 13, marginLeft: 6, opacity: 0.8 }}>
                {signedPercent(s.profitRatio)}
              </span>
            </strong>
          </div>
        )}
      </div>

      {nothing && (
        <div style={{ ...card, ...empty, padding: '28px 18px' }}>
          아직 넣은 게 없어요.<br />
          아래 <strong>💰 자산</strong> 탭에서 전세보증금이나 예금을,<br />
          <strong>💳 나가는돈</strong> 탭에서 대출과 고정비를 넣어보세요.
          <button style={{ ...ghostButton, marginTop: 16 }} onClick={() => onGo('assets')}>
            자산 넣으러 가기
          </button>
        </div>
      )}

      {/* ── 자산 구성 ───────────────────────────── */}
      {s.byKind.length > 0 && s.totalAsset > 0 && (
        <div style={card}>
          <div style={{ fontSize: 13, fontWeight: 700, color: COLOR.sub, marginBottom: 12 }}>
            자산 구성
          </div>

          <div
            style={{
              display: 'flex', height: 14, borderRadius: 7,
              overflow: 'hidden', background: COLOR.line,
            }}
          >
            {s.byKind.map(k => (
              <div
                key={k.kindId}
                title={`${k.name} ${Math.round(k.ratio * 100)}%`}
                style={{ width: `${k.ratio * 100}%`, background: k.color }}
              />
            ))}
          </div>

          <div style={{ marginTop: 12 }}>
            {s.byKind.map(k => (
              <div
                key={k.kindId}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '7px 0',
                  borderTop: `1px solid ${COLOR.line}`,
                }}
              >
                <span
                  style={{
                    width: 9, height: 9, borderRadius: '50%',
                    background: k.color, flexShrink: 0,
                  }}
                />
                <span style={{ fontSize: 14, flex: 1 }}>
                  {k.emoji} {k.name}
                  <span style={{ color: COLOR.faint, fontSize: 12, marginLeft: 5 }}>
                    {k.count}개
                  </span>
                </span>
                <span style={{ fontSize: 12, color: COLOR.faint, width: 38, textAlign: 'right' }}>
                  {Math.round(k.ratio * 100)}%
                </span>
                <strong style={{ fontSize: 14, fontVariantNumeric: 'tabular-nums' }}>
                  {shortWon(k.amount)}
                </strong>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 매달 나가는 돈 ──────────────────────── */}
      {s.monthlyOutflow > 0 && (
        <button
          onClick={() => onGo('outflow')}
          style={{ ...card, display: 'block', width: 'calc(100% - 32px)', textAlign: 'left', border: 'none', cursor: 'pointer', font: 'inherit' }}
        >
          <div
            style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
              marginBottom: 12,
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 700, color: COLOR.sub }}>
              매달 나가는 돈
            </span>
            <strong style={{ fontSize: 22, fontWeight: 800, color: COLOR.debt, fontVariantNumeric: 'tabular-nums' }}>
              {won(s.monthlyOutflow)}
            </strong>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <Stat label="대출 상환" value={won(s.monthlyLoanPayment)} color={COLOR.text} small />
            <div style={{ width: 1, background: COLOR.line }} />
            <Stat label="고정비" value={won(s.monthlyFixed)} color={COLOR.text} small />
          </div>
        </button>
      )}

      {/* ── 다가오는 만기 ──────────────────────── */}
      {s.upcoming.length > 0 && (
        <>
          <div style={sectionTitle}>다가오는 만기</div>
          <div style={{ ...card, margin: '0 16px', padding: 0, overflow: 'hidden' }}>
            {s.upcoming.slice(0, UPCOMING_LIMIT).map((u, i, arr) => (
              <div
                key={u.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '13px 16px',
                  borderBottom: i === arr.length - 1 ? 'none' : `1px solid ${COLOR.line}`,
                }}
              >
                <span
                  style={{
                    width: 4, alignSelf: 'stretch', borderRadius: 2,
                    background: u.color, flexShrink: 0,
                  }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {u.label}
                  </div>
                  <div style={{ fontSize: 12, color: COLOR.faint, marginTop: 2 }}>
                    {u.kind} · {u.date.replace(/-/g, '.')}
                  </div>
                </div>
                <span style={ddayStyle(u.dday)}>{ddayLabel(u.date, today)}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── 자산 목록 ──────────────────────────── */}
      {liveAssets.length > 0 && (
        <>
          <div style={sectionTitle}>내 자산</div>
          <div style={{ ...card, margin: '0 16px', padding: 0, overflow: 'hidden' }}>
            {liveAssets
              .slice()
              .sort((a, b) => b.value - a.value)
              .map((a, i, arr) => {
                const k = kindById.get(a.kindId);
                const profit = a.principal && a.principal > 0
                  ? (a.value - a.principal) / a.principal
                  : null;
                return (
                  <button
                    key={a.id}
                    onClick={() => onEditAsset(a)}
                    style={{ ...row, borderBottom: i === arr.length - 1 ? 'none' : row.borderBottom }}
                  >
                    <span style={{ fontSize: 17 }}>{k?.emoji ?? '📌'}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 15, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {a.name}
                      </div>
                      <div style={{ fontSize: 12, color: COLOR.faint, marginTop: 2 }}>
                        {k?.name ?? '기타'}
                        {a.maturity && ` · ${ddayLabel(a.maturity, today)}`}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 15, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                        {shortWon(a.value)}
                      </div>
                      {profit !== null && (
                        <div
                          style={{
                            fontSize: 12, marginTop: 2,
                            color: profit < 0 ? COLOR.debt : COLOR.plus,
                          }}
                        >
                          {signedPercent(profit)}
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
          </div>
        </>
      )}

      {/* ── 대출 목록 ──────────────────────────── */}
      {liveLoans.length > 0 && (
        <>
          <div style={sectionTitle}>내 대출</div>
          <div style={{ ...card, margin: '0 16px', padding: 0, overflow: 'hidden' }}>
            {liveLoans.map((l, i, arr) => {
              const st = loanStatus(l, today);
              return (
                <button
                  key={l.id}
                  onClick={() => onEditLoan(l)}
                  style={{ ...row, borderBottom: i === arr.length - 1 ? 'none' : row.borderBottom }}
                >
                  <span style={{ fontSize: 17 }}>🏦</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {l.name}
                    </div>
                    <div style={{ fontSize: 12, color: COLOR.faint, marginTop: 2 }}>
                      {st.done ? '상환 완료' : `월 ${won(st.monthlyPayment)}${st.inGrace ? ' (거치 중)' : ''}`}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: COLOR.debt, fontVariantNumeric: 'tabular-nums' }}>
                      {shortWon(st.remainingPrincipal)}
                    </div>
                    <div style={{ fontSize: 12, color: COLOR.faint, marginTop: 2 }}>남은 원금</div>
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}

      <div style={{ height: 24 }} />
    </div>
  );
}

function Stat(
  { label, value, color, small }:
  { label: string; value: string; color: string; small?: boolean },
) {
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 12, color: COLOR.sub }}>{label}</div>
      <div
        style={{
          fontSize: small ? 15 : 18,
          fontWeight: 700,
          color,
          marginTop: 3,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </div>
    </div>
  );
}

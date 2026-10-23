import React, { useState } from 'react';
import { DateKey, MonthKey, Snapshot } from '../types';
import { shortWon, signedPercent, signedWon, won } from '../utils/format';
import { monthKey } from '../utils/date';
import { lastMonths, monthOverMonth } from '../utils/snapshot';
import { COLOR, card, empty } from './ui';

interface Props {
  snapshots: Snapshot[];
  today: DateKey;
}

type Mode = 'net' | 'split';

/** 그래프 두 선의 색. 한 선(순자산)일 때도 자산 색을 쓴다 */
const SERIES = {
  net: { label: '순자산', color: '#3498db' },
  asset: { label: '자산', color: '#3498db' },
  debt: { label: '부채', color: '#e74c3c' },
};

const MONTHS = 12;
const W = 360;
const H = 200;
const PAD = { top: 18, right: 14, bottom: 26, left: 50 };

/** '2026-08' → '8월' (1월에는 연도도 같이) */
function monthLabel(m: MonthKey): string {
  const [y, mm] = m.split('-').map(Number);
  return mm === 1 ? `${String(y).slice(2)}.1월` : `${mm}월`;
}

/** '2026-08' → '2026.08' — 표에 촘촘히 */
function tableMonth(m: MonthKey): string {
  return m.replace('-', '.');
}

/** '2026-08' → '2026년 8월' */
function monthTitle(m: MonthKey): string {
  const [y, mm] = m.split('-').map(Number);
  return `${y}년 ${mm}월`;
}

/**
 * 순자산 추이 — 월별 스냅샷을 선으로 잇는다.
 *
 * 차트 라이브러리 없이 SVG 로 직접 그린다. 12칸 고정이라 빈 달은 빈 자리로 남는다.
 */
export default function TrendView({ snapshots, today }: Props) {
  const [mode, setMode] = useState<Mode>('net');
  const [picked, setPicked] = useState<number | null>(null);

  const slots = lastMonths(snapshots, today, MONTHS);
  const have = slots.filter(s => s.snapshot);
  const thisMonth = monthKey(today);

  if (have.length < 2) {
    const only = have[0]?.snapshot;
    return (
      <div>
        <div style={{ ...card, ...empty, marginTop: 16, padding: '36px 18px' }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>📈</div>
          <strong style={{ color: COLOR.text }}>다음 달부터 추이가 보여요.</strong><br />
          달마다 순자산을 한 번씩 기록해 두고, 달이 바뀌면 선으로 이어 그립니다.
          {only && (
            <div style={{ marginTop: 14, fontSize: 13, color: COLOR.sub }}>
              {monthTitle(only.month)} 순자산 <strong style={{ color: COLOR.text }}>{won(only.netWorth)}</strong>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ---------- 좌표 ----------
  const series: { key: keyof typeof SERIES; pick: (s: Snapshot) => number }[] =
    mode === 'net'
      ? [{ key: 'net', pick: s => s.netWorth }]
      : [{ key: 'asset', pick: s => s.totalAsset }, { key: 'debt', pick: s => s.totalDebt }];

  const all = series.flatMap(se => have.map(h => se.pick(h.snapshot!)));
  const rawMin = Math.min(...all);
  const rawMax = Math.max(...all);
  const spread = rawMax - rawMin || Math.abs(rawMax) || 1;
  const min = rawMin - spread * 0.08;
  const max = rawMax + spread * 0.12;

  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (i + 0.5) * (plotW / MONTHS);
  const y = (v: number) => PAD.top + (1 - (v - min) / (max - min)) * plotH;

  // 눈금 3개: 아래·가운데·위
  const ticks = [min + (max - min) * 0.1, (min + max) / 2, max - (max - min) * 0.1];

  /** 빈 달에서 선을 끊는다 — 없는 달을 있는 것처럼 이어 그리지 않는다 */
  const paths = series.map(se => {
    const segs: string[] = [];
    let cur: string[] = [];
    slots.forEach((s, i) => {
      if (!s.snapshot) { if (cur.length) segs.push(cur.join(' ')); cur = []; return; }
      cur.push(`${x(i).toFixed(1)},${y(se.pick(s.snapshot)).toFixed(1)}`);
    });
    if (cur.length) segs.push(cur.join(' '));
    return { key: se.key, segs };
  });

  const pickedSlot = picked !== null ? slots[picked] : null;
  const shown = pickedSlot?.snapshot ?? have[have.length - 1].snapshot!;
  const shownMonth = pickedSlot?.month ?? have[have.length - 1].month;

  // ---------- 표 ----------
  const rows = have.slice().reverse().map((h, i, arr) => {
    const prev = arr[i + 1]?.snapshot ?? null;
    return { month: h.month, s: h.snapshot!, delta: prev ? monthOverMonth(h.snapshot!.netWorth, prev.netWorth) : null };
  });

  return (
    <div>
      <div style={{ ...card, marginTop: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, color: COLOR.sub }}>
              {monthTitle(shownMonth)}{shownMonth === thisMonth ? ' (이번 달)' : ''}
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: COLOR.asset }}>
              {mode === 'net'
                ? won(shown.netWorth)
                : <>
                  <span style={{ color: SERIES.asset.color }}>{shortWon(shown.totalAsset)}</span>
                  <span style={{ color: COLOR.faint, fontSize: 14, margin: '0 6px' }}>/</span>
                  <span style={{ color: SERIES.debt.color }}>{shortWon(shown.totalDebt)}</span>
                </>}
            </div>
          </div>
          <Toggle mode={mode} onChange={m => { setMode(m); setPicked(null); }} />
        </div>

        {mode === 'split' && (
          <div style={{ display: 'flex', gap: 14, fontSize: 12, color: COLOR.sub, marginBottom: 4 }}>
            <Legend color={SERIES.asset.color} label="자산" />
            <Legend color={SERIES.debt.color} label="부채" />
          </div>
        )}

        <svg
          viewBox={`0 0 ${W} ${H}`}
          style={{ width: '100%', height: 'auto', display: 'block', touchAction: 'pan-y' }}
          role="img"
          aria-label={`최근 ${MONTHS}개월 ${mode === 'net' ? '순자산' : '자산과 부채'} 추이`}
          onMouseLeave={() => setPicked(null)}
        >
          {/* 눈금선 */}
          {ticks.map((t, i) => (
            <g key={i}>
              <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke={COLOR.line} strokeWidth={1} />
              <text x={PAD.left - 6} y={y(t) + 3.5} fontSize={10} fill={COLOR.faint} textAnchor="end">
                {shortWon(t)}
              </text>
            </g>
          ))}

          {/* 0 선 — 순자산이 마이너스로 내려가는 구간이 있으면 보인다 */}
          {min < 0 && max > 0 && (
            <line x1={PAD.left} x2={W - PAD.right} y1={y(0)} y2={y(0)} stroke={COLOR.sub} strokeWidth={1} strokeDasharray="3 3" />
          )}

          {/* 고른 달 세로선 */}
          {picked !== null && slots[picked].snapshot && (
            <line x1={x(picked)} x2={x(picked)} y1={PAD.top} y2={H - PAD.bottom} stroke={COLOR.faint} strokeWidth={1} strokeDasharray="2 3" />
          )}

          {/* 선 */}
          {paths.map(p => p.segs.map((seg, i) => (
            <polyline
              key={`${p.key}-${i}`} points={seg} fill="none"
              stroke={SERIES[p.key].color} strokeWidth={2}
              strokeLinejoin="round" strokeLinecap="round"
            />
          )))}

          {/* 점 — 이번 달은 크고 테두리가 있다 */}
          {series.map(se => slots.map((s, i) => {
            if (!s.snapshot) return null;
            const isNow = s.month === thisMonth;
            const on = picked === i;
            return (
              <circle
                key={`${se.key}-${s.month}`}
                cx={x(i)} cy={y(se.pick(s.snapshot))}
                r={isNow || on ? 5 : 3}
                fill={isNow ? SERIES[se.key].color : COLOR.card}
                stroke={SERIES[se.key].color} strokeWidth={2}
              />
            );
          }))}

          {/* 달 라벨 */}
          {slots.map((s, i) => (
            <text
              key={s.month} x={x(i)} y={H - 8} fontSize={10} textAnchor="middle"
              fill={s.month === thisMonth ? COLOR.text : COLOR.faint}
              fontWeight={s.month === thisMonth ? 700 : 400}
            >
              {monthLabel(s.month)}
            </text>
          ))}

          {/* 터치 영역 — 점보다 훨씬 넓게 */}
          {slots.map((s, i) => (
            <rect
              key={`hit-${s.month}`}
              x={PAD.left + i * (plotW / MONTHS)} y={PAD.top}
              width={plotW / MONTHS} height={plotH}
              fill="transparent"
              onMouseEnter={() => s.snapshot && setPicked(i)}
              onClick={() => setPicked(s.snapshot ? (picked === i ? null : i) : null)}
            />
          ))}
        </svg>
        <p style={{ margin: '4px 0 0', fontSize: 11, color: COLOR.faint, textAlign: 'center' }}>
          이번 달 점은 지금 상태를 따라가고, 달이 바뀌면 그대로 남아요.
        </p>
      </div>

      {/* ── 표 ─────────────────────────────────── */}
      <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
        <div
          style={{
            display: 'grid', gridTemplateColumns: mode === 'net' ? '1fr 1.4fr 1.4fr' : '0.8fr 1fr 1fr 1.2fr',
            padding: '10px 16px', fontSize: 11, fontWeight: 700, color: COLOR.sub,
            borderBottom: `1px solid ${COLOR.line}`,
          }}
        >
          <span>달</span>
          {mode === 'net'
            ? <span style={{ textAlign: 'right' }}>순자산</span>
            : <>
              <span style={{ textAlign: 'right' }}>자산</span>
              <span style={{ textAlign: 'right' }}>부채</span>
            </>}
          <span style={{ textAlign: 'right' }}>전월 대비</span>
        </div>
        {rows.map((r, i) => (
          <div
            key={r.month}
            style={{
              display: 'grid', gridTemplateColumns: mode === 'net' ? '1fr 1.4fr 1.4fr' : '0.8fr 1fr 1fr 1.2fr',
              padding: '11px 16px', fontSize: 13, alignItems: 'baseline',
              borderBottom: i === rows.length - 1 ? 'none' : `1px solid ${COLOR.line}`,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            <span style={{ color: r.month === thisMonth ? COLOR.text : COLOR.sub, fontWeight: r.month === thisMonth ? 700 : 500 }}>
              {tableMonth(r.month)}
            </span>
            {mode === 'net'
              ? <strong style={{ textAlign: 'right', color: r.s.netWorth < 0 ? COLOR.debt : COLOR.text }}>{shortWon(r.s.netWorth)}</strong>
              : <>
                <span style={{ textAlign: 'right' }}>{shortWon(r.s.totalAsset)}</span>
                <span style={{ textAlign: 'right', color: COLOR.debt }}>{shortWon(r.s.totalDebt)}</span>
              </>}
            <span
              style={{
                textAlign: 'right', fontSize: 12,
                color: !r.delta ? COLOR.faint : r.delta.change < 0 ? COLOR.debt : r.delta.change > 0 ? COLOR.plus : COLOR.faint,
              }}
            >
              {r.delta
                ? <>
                  {signedWon(r.delta.change).replace('원', '')}
                  {r.delta.ratio !== null && <span style={{ marginLeft: 4, opacity: 0.8 }}>({signedPercent(r.delta.ratio)})</span>}
                </>
                : '—'}
            </span>
          </div>
        ))}
      </div>

      <div style={{ height: 24 }} />
    </div>
  );
}

function Toggle({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) {
  const opts: { v: Mode; label: string }[] = [{ v: 'net', label: '순자산' }, { v: 'split', label: '자산 / 부채' }];
  return (
    <div style={{ display: 'flex', background: '#eef1f4', borderRadius: 8, padding: 2, flexShrink: 0 }}>
      {opts.map(o => {
        const on = o.v === mode;
        return (
          <button
            key={o.v}
            onClick={() => onChange(o.v)}
            aria-pressed={on}
            style={{
              padding: '6px 10px', borderRadius: 6, border: 'none', cursor: 'pointer',
              fontSize: 12, fontWeight: on ? 700 : 500,
              background: on ? COLOR.card : 'transparent',
              color: on ? COLOR.text : COLOR.sub,
              boxShadow: on ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
      <span style={{ width: 14, height: 2, background: color, borderRadius: 1, display: 'inline-block' }} />
      {label}
    </span>
  );
}

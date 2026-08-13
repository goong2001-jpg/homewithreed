import React from 'react';
import { CategorySlice, DateKey, PeriodSummary, Span } from '../types';
import { DAY_MINUTES, dayLabel, deltaText, durationText, parseDate, rangeLabel, weekdayName } from '../utils/time';
import { COLOR, card, empty, missBadge, okBadge, sectionTitle, tabular } from './ui';

interface Props {
  span: Span;
  onChangeSpan: (s: Span) => void;
  onShift: (n: number) => void;
  /** 다음 기간으로 갈 수 있나 (미래는 볼 게 없다) */
  canForward: boolean;
  summary: PeriodSummary;
  /** 분류별 지난 기간 대비 증감(분) */
  delta: Record<string, number>;
  today: DateKey;
}

export default function StatsView({
  span, onChangeSpan, onShift, canForward, summary, delta, today,
}: Props) {
  const hasAny = summary.totalMinutes > 0;

  return (
    <div>
      {/* ── 기간 고르기 ───────────────────────── */}
      <div style={{ display: 'flex', gap: 6, padding: '10px 16px 0' }}>
        {(['week', 'month'] as Span[]).map(s => {
          const on = s === span;
          return (
            <button
              key={s}
              onClick={() => onChangeSpan(s)}
              style={{
                flex: 1, padding: '9px 4px', borderRadius: 9,
                border: `1px solid ${on ? COLOR.accent : COLOR.line}`,
                background: on ? COLOR.accent : '#fff',
                color: on ? '#fff' : COLOR.sub,
                fontWeight: on ? 700 : 500, fontSize: 14, cursor: 'pointer', font: 'inherit',
              }}
            >
              {s === 'week' ? '주간' : '월간'}
            </button>
          );
        })}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px 0' }}>
        <NavButton label="◀" onClick={() => onShift(-1)} />
        <div style={{ flex: 1, textAlign: 'center', fontSize: 15, fontWeight: 700 }}>
          {rangeLabel(summary.from, summary.to)}
        </div>
        <NavButton label="▶" onClick={() => onShift(1)} disabled={!canForward} />
      </div>

      {/* ── 세 줄 요약 ───────────────────────── */}
      <div style={{ ...card, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 6 }}>
        <Stat label="적어둔 시간" value={durationText(summary.totalMinutes)} strong />
        <Stat label="하루 평균" value={durationText(summary.dailyAverageMinutes)} />
        <Stat label="빈 시간" value={durationText(summary.untrackedMinutes)} tone={COLOR.faint} />
      </div>

      {/* ── 날짜별 ───────────────────────────── */}
      <div style={sectionTitle}>날짜별 · 하루 24시간 중 적어둔 만큼</div>
      <div style={{ ...card, margin: '0 16px' }}>
        <DayChart summary={summary} span={span} today={today} />
      </div>

      {/* ── 분류별 ───────────────────────────── */}
      <div style={sectionTitle}>어디에 썼나</div>
      <div style={{ ...card, margin: '0 16px', padding: hasAny ? '6px 16px 14px' : 16 }}>
        {!hasAny ? (
          <div style={{ ...empty, padding: '18px 0' }}>
            이 기간엔 적어둔 기록이 없어요.<br />
            <span style={{ fontSize: 13 }}>⏱ 오늘 탭에서 분류를 눌러 시작해 보세요.</span>
          </div>
        ) : (
          summary.byCategory.map(s => (
            <CategoryRow key={s.categoryId} slice={s} delta={delta[s.categoryId]} />
          ))
        )}
      </div>

      {summary.busiestDay && (
        <p style={{ margin: '14px 16px 0', fontSize: 12, color: COLOR.faint, lineHeight: 1.7 }}>
          가장 많이 적은 날은 <strong>{dayLabel(summary.busiestDay.day, today)}</strong>
          {' '}({durationText(summary.busiestDay.minutes)})이었어요.
        </p>
      )}

      <div style={{ height: 24 }} />
    </div>
  );
}

/** 하루를 24시간 트랙으로 두고, 적어둔 만큼만 분류 색으로 채운다 */
function DayChart({ summary, span, today }: { summary: PeriodSummary; span: Span; today: DateKey }) {
  const colorOf = new Map(summary.byCategory.map(s => [s.categoryId, s.color]));

  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: span === 'week' ? 8 : 3 }}>
      {summary.byDay.map(d => {
        const isToday = d.day === today;
        const parts = Object.entries(d.byCategory).sort((a, b) => b[1] - a[1]);
        return (
          <div key={d.day} style={{ flex: 1, minWidth: 0, textAlign: 'center' }}>
            <div
              style={{
                height: 84,
                borderRadius: 4,
                background: COLOR.blank,
                display: 'flex', flexDirection: 'column-reverse',
                overflow: 'hidden',
              }}
            >
              {parts.map(([id, minutes]) => (
                <div
                  key={id}
                  style={{
                    height: `${(minutes / DAY_MINUTES) * 100}%`,
                    background: colorOf.get(id) ?? COLOR.faint,
                  }}
                />
              ))}
            </div>
            <div
              style={{
                marginTop: 4, fontSize: 10,
                color: isToday ? COLOR.accent : COLOR.faint,
                fontWeight: isToday ? 700 : 500,
                // 월간은 칸이 10px도 안 되므로 숫자가 칸 밖으로 삐져나가게 둔다
                // (옆칸은 빈 문자열이라 겹칠 게 없다). 자르면 '2' '3' 처럼 보인다
                whiteSpace: 'nowrap',
              }}
            >
              {span === 'week' ? weekdayName(d.day) : shortDayLabel(d.day)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** 월간에서는 자리가 없어 5일마다만 숫자를 보여준다 */
function shortDayLabel(day: DateKey): string {
  const { d } = parseDate(day);
  return d === 1 || d % 5 === 0 ? String(d) : '';
}

function CategoryRow({ slice, delta }: { slice: CategorySlice; delta?: number }) {
  const percent = Math.round(slice.ratio * 100);
  const goal = slice.goal;

  return (
    <div style={{ padding: '10px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 7 }}>
        <span style={{ width: 9, height: 9, borderRadius: '50%', background: slice.color, flexShrink: 0 }} />
        <span style={{ fontSize: 14, fontWeight: 600, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {slice.emoji} {slice.name}
        </span>

        {goal && (
          <span style={goal.ok ? okBadge : missBadge}>
            목표 {durationText(goal.targetMinutes)} {goal.kind}
          </span>
        )}

        <strong style={{ ...tabular, fontSize: 14 }}>{durationText(slice.minutes)}</strong>
      </div>

      <div style={{ position: 'relative', height: 8, borderRadius: 4, background: '#f1f3f5', overflow: 'hidden' }}>
        <div
          style={{
            position: 'absolute', inset: 0, right: 'auto',
            width: `${Math.min(100, slice.ratio * 100)}%`,
            background: slice.color,
            borderRadius: 4,
          }}
        />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5, fontSize: 11.5, color: COLOR.faint }}>
        <span style={tabular}>{percent}% · {slice.count}건</span>
        {delta != null && (
          <span style={{ ...tabular, color: deltaColor(delta, goal?.kind) }}>
            지난 기간 {deltaText(delta)}
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * 늘어난 게 좋은 일인지 나쁜 일인지는 목표 방향이 정한다.
 * 목표를 안 잡은 분류는 판단하지 않고 회색으로 둔다 — 늘었다고 다 나쁜 건 아니니까.
 */
function deltaColor(delta: number, kind?: '이상' | '이하'): string {
  if (!kind || delta === 0) return COLOR.faint;
  const better = kind === '이상' ? delta > 0 : delta < 0;
  return better ? COLOR.good : COLOR.warn;
}

function NavButton({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label === '◀' ? '지난 기간' : '다음 기간'}
      style={{
        width: 34, height: 34, borderRadius: 9,
        border: `1px solid ${COLOR.line}`, background: '#fff',
        color: disabled ? COLOR.line : COLOR.sub,
        cursor: disabled ? 'default' : 'pointer',
        fontSize: 12, lineHeight: 1, flexShrink: 0,
      }}
    >
      {label}
    </button>
  );
}

function Stat({ label, value, strong, tone }: { label: string; value: string; strong?: boolean; tone?: string }) {
  return (
    <div style={{ textAlign: 'center', minWidth: 0, flex: 1 }}>
      <div style={{ fontSize: 12, color: COLOR.sub, marginBottom: 4 }}>{label}</div>
      <div
        style={{
          ...tabular,
          // '135시간 20분' 처럼 긴 값이 셋 나란히 서도 서로 닿지 않을 크기
          fontSize: strong ? 17 : 15,
          fontWeight: strong ? 800 : 700,
          color: tone ?? COLOR.text,
          letterSpacing: '-0.4px',
        }}
      >
        {value}
      </div>
    </div>
  );
}

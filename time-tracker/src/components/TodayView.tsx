import React from 'react';
import { Category, DateKey, Entry, Gap, PeriodSummary, Segment, UNKNOWN_CATEGORY } from '../types';
import { addDays, clock, dayLabel, durationText } from '../utils/time';
import DayBar from './DayBar';
import QuickStart from './QuickStart';
import RunningCard from './RunningCard';
import { CategoryMark } from './Field';
import { COLOR, addButton, card, empty, liveBadge, sectionTitle, tabular } from './ui';

interface Props {
  day: DateKey;
  today: DateKey;
  onChangeDay: (d: DateKey) => void;

  /** 살아있는 분류 (순서대로) */
  categories: Category[];
  /** 지운 분류까지 — 예전 기록의 이름을 잃지 않으려고 */
  allCategories: Category[];

  segments: Segment[];
  gaps: Gap[];
  summary: PeriodSummary;
  running: Entry | null;
  now: number;

  onStart: (categoryId: string) => void;
  onStop: () => void;
  onEditEntry: (entryId: string) => void;
  onAdd: (range?: { start: number; end: number }) => void;
}

/** 기록 조각과 빈 구간을 시간순으로 한 줄씩 */
type Item =
  | { kind: 'seg'; start: number; seg: Segment }
  | { kind: 'gap'; start: number; gap: Gap };

export default function TodayView({
  day, today, onChangeDay, categories, allCategories,
  segments, gaps, summary, running, now,
  onStart, onStop, onEditEntry, onAdd,
}: Props) {
  const isToday = day === today;

  const meta = (id: string) => {
    const c = allCategories.find(x => x.id === id);
    return {
      name: c?.name ?? UNKNOWN_CATEGORY.name,
      color: c?.color ?? UNKNOWN_CATEGORY.color,
      emoji: c?.emoji ?? UNKNOWN_CATEGORY.emoji,
    };
  };

  const todayMinutes: Record<string, number> = {};
  for (const s of summary.byCategory) todayMinutes[s.categoryId] = s.minutes;

  const items: Item[] = [
    ...segments.map<Item>(s => ({ kind: 'seg', start: s.start, seg: s })),
    ...gaps.map<Item>(g => ({ kind: 'gap', start: g.start, gap: g })),
  ].sort((a, b) => a.start - b.start);

  return (
    <div>
      {/* ── 날짜 이동 ─────────────────────────── */}
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '10px 16px 2px',
        }}
      >
        <NavButton label="◀" onClick={() => onChangeDay(addDays(day, -1))} />
        <div style={{ flex: 1, textAlign: 'center', fontSize: 15, fontWeight: 700 }}>
          {dayLabel(day, today)}
        </div>
        <NavButton
          label="▶"
          onClick={() => onChangeDay(addDays(day, 1))}
          disabled={day >= today}
        />
      </div>

      {!isToday && (
        <div style={{ textAlign: 'center', padding: '4px 16px 0' }}>
          <button
            onClick={() => onChangeDay(today)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              font: 'inherit', fontSize: 12, color: COLOR.accent, textDecoration: 'underline',
            }}
          >
            오늘로 돌아가기
          </button>
        </div>
      )}

      {/* ── 지금 돌아가는 기록 ─────────────────── */}
      {isToday && (
        <RunningCard
          running={running}
          categories={allCategories}
          onStop={onStop}
          onEdit={e => onEditEntry(e.id)}
        />
      )}

      {/* ── 한 번 눌러 시작 ───────────────────── */}
      {isToday && (
        <QuickStart
          categories={categories}
          runningCategoryId={running?.categoryId ?? null}
          todayMinutes={todayMinutes}
          onStart={onStart}
          onStop={onStop}
        />
      )}

      {/* ── 하루 막대 ─────────────────────────── */}
      <div style={sectionTitle}>{isToday ? '오늘 하루' : `${dayLabel(day, today)} 하루`}</div>

      <div style={{ ...card, margin: '0 16px', padding: '16px 0 12px' }}>
        <div
          style={{
            display: 'flex', justifyContent: 'space-around', alignItems: 'baseline',
            padding: '0 16px 14px',
          }}
        >
          <Stat label="적어둔 시간" value={durationText(summary.totalMinutes)} strong />
          <Stat
            label={isToday ? '지금까지 빈 시간' : '빈 시간'}
            value={durationText(summary.untrackedMinutes)}
            tone={COLOR.faint}
          />
        </div>

        <DayBar
          day={day}
          today={today}
          segments={segments}
          categories={allCategories}
          now={now}
        />

        {summary.byCategory.length > 0 && (
          <div
            style={{
              display: 'flex', flexWrap: 'wrap', gap: '6px 12px',
              padding: '14px 16px 0',
            }}
          >
            {summary.byCategory.map(s => (
              <span key={s.categoryId} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
                <span style={{ width: 9, height: 9, borderRadius: '50%', background: s.color }} />
                <span style={{ color: COLOR.sub }}>{s.name}</span>
                <strong style={{ ...tabular, color: COLOR.text }}>{durationText(s.minutes)}</strong>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* ── 시간순 목록 ───────────────────────── */}
      <div style={sectionTitle}>시간순</div>

      <div style={{ ...card, margin: '0 16px', padding: 0, overflow: 'hidden' }}>
        {items.length === 0 ? (
          <div style={empty}>
            아직 아무것도 안 적혔어요.<br />
            위에서 분류를 누르거나 아래 <strong>직접 적기</strong>로 채워보세요.
          </div>
        ) : (
          items.map((item, i) => {
            const last = i === items.length - 1;

            if (item.kind === 'gap') {
              const g = item.gap;
              return (
                <button
                  key={`gap:${g.start}`}
                  onClick={() => onAdd({ start: g.start, end: g.end })}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                    padding: '11px 16px', background: '#fbfcfd', border: 'none',
                    borderBottom: last ? 'none' : `1px solid ${COLOR.line}`,
                    cursor: 'pointer', font: 'inherit', textAlign: 'left',
                  }}
                >
                  <span style={{ ...tabular, fontSize: 12, color: COLOR.faint, width: 84, flexShrink: 0 }}>
                    {clock(g.start)}–{clock(g.end)}
                  </span>
                  <span style={{ flex: 1, fontSize: 13, color: COLOR.faint }}>
                    비어 있음 · 뭘 했는지 적어두기
                  </span>
                  <span style={{ ...tabular, fontSize: 13, color: COLOR.faint }}>
                    {durationText(g.minutes)}
                  </span>
                </button>
              );
            }

            const s = item.seg;
            const m = meta(s.categoryId);
            return (
              <button
                key={`seg:${s.entryId}:${s.start}`}
                onClick={() => onEditEntry(s.entryId)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                  padding: '11px 16px', background: 'none', border: 'none',
                  borderBottom: last ? 'none' : `1px solid ${COLOR.line}`,
                  cursor: 'pointer', font: 'inherit', textAlign: 'left', color: COLOR.text,
                }}
              >
                <span style={{ ...tabular, fontSize: 12, color: COLOR.sub, width: 84, flexShrink: 0 }}>
                  {s.clippedStart ? '↑ ' : ''}{clock(s.start)}–{s.running ? '지금' : clock(s.end)}
                </span>
                <CategoryMark color={m.color} emoji={m.emoji} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: 15, fontWeight: 600 }}>{m.name}</span>
                  {s.running && <span style={{ ...liveBadge, marginLeft: 6 }}>진행 중</span>}
                  {s.clippedEnd && (
                    <span style={{ fontSize: 11, color: COLOR.faint, marginLeft: 6 }}>다음날로 이어짐</span>
                  )}
                </span>
                <span style={{ ...tabular, fontSize: 14, fontWeight: 700 }}>
                  {durationText(s.minutes)}
                </span>
              </button>
            );
          })
        )}
      </div>

      <div style={{ padding: '10px 16px 0' }}>
        <button style={addButton} onClick={() => onAdd()}>＋ 직접 적기</button>
      </div>

      <div style={{ height: 24 }} />
    </div>
  );
}

function NavButton({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label === '◀' ? '앞날' : '뒷날'}
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
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 12, color: COLOR.sub, marginBottom: 4 }}>{label}</div>
      <div
        style={{
          ...tabular,
          fontSize: strong ? 22 : 20,
          fontWeight: strong ? 800 : 700,
          color: tone ?? COLOR.text,
          letterSpacing: '-0.5px',
        }}
      >
        {value}
      </div>
    </div>
  );
}

import React from 'react';
import { DateKey, GOAL_SOURCE_META, Goal, GoalProgress } from '../types';
import { ddayLabel, monthsLabel, shortWon, won } from '../utils/format';
import { alive } from '../utils/merge';
import { COLOR, card, empty, ghostButton, sectionTitle } from './ui';

interface Props {
  goals: Goal[];
  progress: Record<string, GoalProgress>;
  today: DateKey;
  onAdd: () => void;
  onEdit: (g: Goal) => void;
  onToggleAchieved: (g: Goal) => void;
}

export default function GoalsView({
  goals, progress, today, onAdd, onEdit, onToggleAchieved,
}: Props) {
  const live = alive(goals);
  const running = live.filter(g => !g.achievedAt);
  const achieved = live.filter(g => g.achievedAt);

  return (
    <div>
      {live.length === 0 && (
        <div style={{ ...card, ...empty, marginTop: 16, padding: '28px 18px' }}>
          모으고 있는 목표를 넣어보세요.<br />
          <strong>분양가에서 대출을 빼면</strong> 내가 마련할 돈이 나오고,<br />
          지금 자산으로 <strong>얼마나 준비됐는지</strong> 바로 보여드려요.
          <button style={{ ...ghostButton, marginTop: 16 }} onClick={onAdd}>
            ＋ 첫 목표 만들기
          </button>
        </div>
      )}

      {running.map(g => (
        <GoalCard
          key={g.id}
          goal={g}
          p={progress[g.id]}
          today={today}
          onClick={() => onEdit(g)}
          onToggleAchieved={() => onToggleAchieved(g)}
        />
      ))}

      {live.length > 0 && (
        <div style={{ padding: '10px 16px 0' }}>
          <button
            onClick={onAdd}
            style={{
              width: '100%', padding: '13px', borderRadius: 10,
              border: `1px dashed ${COLOR.line}`, background: '#fff',
              color: COLOR.sub, fontSize: 14, cursor: 'pointer', font: 'inherit',
            }}
          >
            ＋ 목표 추가
          </button>
        </div>
      )}

      {achieved.length > 0 && (
        <>
          <div style={sectionTitle}>🎉 이룬 목표</div>
          {achieved.map(g => (
            <GoalCard
              key={g.id}
              goal={g}
              p={progress[g.id]}
              today={today}
              onClick={() => onEdit(g)}
              onToggleAchieved={() => onToggleAchieved(g)}
            />
          ))}
        </>
      )}

      <div style={{ height: 24 }} />
    </div>
  );
}

function GoalCard(
  { goal: g, p, today, onClick, onToggleAchieved }:
  {
    goal: Goal; p?: GoalProgress; today: DateKey;
    onClick: () => void; onToggleAchieved: () => void;
  },
) {
  if (!p) return null;

  const pct = Math.round(p.rate * 100);
  const barColor = p.done ? COLOR.plus : p.overdue ? COLOR.debt : COLOR.accent;

  return (
    <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
      <button
        onClick={onClick}
        style={{
          display: 'block', width: '100%', padding: '16px 16px 14px',
          background: 'none', border: 'none', cursor: 'pointer',
          font: 'inherit', color: COLOR.text, textAlign: 'left',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <strong
            style={{
              fontSize: 16, flex: 1, minWidth: 0,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}
          >
            {g.name}
          </strong>
          {g.targetDate && (
            <span
              style={{
                fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 999,
                whiteSpace: 'nowrap',
                color: p.overdue ? '#c0392b' : COLOR.sub,
                background: p.overdue ? '#fdecea' : '#eef1f4',
              }}
            >
              {ddayLabel(g.targetDate, today)}
            </span>
          )}
        </div>

        {/* ── 달성률 ── */}
        <div style={{ marginTop: 14 }}>
          <div
            style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
              marginBottom: 6,
            }}
          >
            <span style={{ fontSize: 13, color: COLOR.sub }}>자산 대비 달성률</span>
            <strong
              style={{
                fontSize: 26, fontWeight: 800, color: barColor,
                fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.5px',
              }}
            >
              {pct}%
            </strong>
          </div>
          <div style={{ height: 10, borderRadius: 5, background: COLOR.line, overflow: 'hidden' }}>
            <div
              style={{
                width: `${Math.min(100, p.rate * 100)}%`, height: '100%',
                background: barColor, transition: 'width 0.3s',
              }}
            />
          </div>
          <div
            style={{
              display: 'flex', justifyContent: 'space-between',
              fontSize: 12, color: COLOR.faint, marginTop: 6,
            }}
          >
            <span>준비 {shortWon(p.ready)}</span>
            <span>목표 {shortWon(p.cashNeeded)}</span>
          </div>
        </div>

        {/* ── 돈 계산 ── */}
        <div
          style={{
            marginTop: 14, paddingTop: 12, borderTop: `1px solid ${COLOR.line}`,
            fontSize: 13, color: COLOR.sub,
          }}
        >
          <Line label="총 필요액" value={won(p.totalNeeded)} />
          {g.netPrice != null && g.netPrice !== g.totalPrice && (
            <Line label="총 분양가" value={won(g.totalPrice)} faint />
          )}
          {g.extraCost > 0 && (
            <Line label="  └ 부대비용" value={won(g.extraCost)} faint />
          )}
          <Line label="예상 대출" value={`− ${won(p.expectedLoan)}`} />
          <Line label="내가 모아야 할 돈" value={won(p.cashNeeded)} strong />
          <Line label="지금 준비된 돈" value={won(p.ready)} />
          <Line
            label={p.shortfall > 0 ? '아직 모자란 돈' : '남은 금액'}
            value={p.shortfall > 0 ? won(p.shortfall) : '없음 🎉'}
            strong
            color={p.shortfall > 0 ? COLOR.debt : COLOR.plus}
          />
        </div>

        {/* ── 매달 얼마 ── */}
        {p.perMonth != null && p.perDay != null && (
          <div
            style={{
              marginTop: 12, padding: '12px 14px',
              background: '#f4f7f9', borderRadius: 9,
            }}
          >
            <div style={{ fontSize: 12, color: COLOR.sub, marginBottom: 6 }}>
              {monthsLabel(p.monthsLeft ?? 0)} 안에 모으려면
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: COLOR.faint }}>한 달에</div>
                <strong style={{ fontSize: 17, color: COLOR.asset, fontVariantNumeric: 'tabular-nums' }}>
                  {won(p.perMonth)}
                </strong>
              </div>
              <div style={{ width: 1, background: COLOR.line }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: COLOR.faint }}>하루에</div>
                <strong style={{ fontSize: 17, color: COLOR.asset, fontVariantNumeric: 'tabular-nums' }}>
                  {won(p.perDay)}
                </strong>
              </div>
            </div>
          </div>
        )}

        {p.overdue && (
          <p style={{ margin: '12px 0 0', fontSize: 12, color: COLOR.debt, lineHeight: 1.6 }}>
            목표일이 지났는데 {won(p.shortfall)}이 모자라요. 목표일을 다시 잡거나 금액을 손봐주세요.
          </p>
        )}

        <div style={{ fontSize: 11, color: COLOR.faint, marginTop: 12 }}>
          {GOAL_SOURCE_META[g.source].label} 기준
          {g.source === 'picked' && ` · 자산 ${g.assetIds.length}개`}
          {g.memo && ` · ${g.memo}`}
        </div>
      </button>

      <button
        onClick={onToggleAchieved}
        style={{
          width: '100%', padding: '12px', border: 'none',
          borderTop: `1px solid ${COLOR.line}`,
          background: g.achievedAt ? '#f4f7f9' : '#fff',
          color: g.achievedAt ? COLOR.sub : COLOR.plus,
          fontSize: 14, fontWeight: 700, cursor: 'pointer', font: 'inherit',
        }}
      >
        {g.achievedAt ? '↩︎ 진행 중으로 되돌리기' : '🎉 달성했어요'}
      </button>
    </div>
  );
}

function Line(
  { label, value, strong, faint, color }:
  { label: string; value: string; strong?: boolean; faint?: boolean; color?: string },
) {
  return (
    <div
      style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
        marginTop: 5,
      }}
    >
      <span style={{ color: faint ? COLOR.faint : COLOR.sub, fontSize: faint ? 12 : 13 }}>
        {label}
      </span>
      <strong
        style={{
          fontSize: strong ? 15 : faint ? 12 : 13,
          fontWeight: strong ? 700 : 500,
          color: color ?? (faint ? COLOR.faint : COLOR.text),
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </strong>
    </div>
  );
}

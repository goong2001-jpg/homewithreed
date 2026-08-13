import React from 'react';
import { Category, TimeBlock } from '../types';
import { blockRanges, hasScript } from '../utils/block';
import { clockOfMinutes, durationText } from '../utils/time';
import { CategoryMark } from './Field';
import { COLOR, addButton, card, empty, liveBadge, missBadge, okBadge, sectionTitle, tabular } from './ui';

interface Props {
  categories: Category[];
  blocks: TimeBlock[];
  /** categoryId → 지금까지 적어둔 기록 수 */
  useCount: Record<string, number>;
  onAdd: () => void;
  onEdit: (c: Category) => void;
  onEditBlock: (b: TimeBlock) => void;
}

export default function CategoriesView({
  categories, blocks, useCount, onAdd, onEdit, onEditBlock,
}: Props) {
  const ranges = blockRanges(blocks);

  return (
    <div>
      {/* ── 타임블록 ─────────────────────────── */}
      <div style={sectionTitle}>⏳ 타임블록 · 하루를 나누는 조각</div>

      <div style={{ ...card, margin: '0 16px', padding: 0, overflow: 'hidden' }}>
        {ranges.map((r, i) => (
          <button
            key={r.block.id}
            onClick={() => onEditBlock(r.block)}
            style={{
              display: 'flex', alignItems: 'center', gap: 10, width: '100%',
              padding: '12px 16px', background: 'none', border: 'none',
              borderBottom: i === ranges.length - 1 ? 'none' : `1px solid ${COLOR.line}`,
              cursor: 'pointer', font: 'inherit', textAlign: 'left', color: COLOR.text,
            }}
          >
            <span style={{ fontSize: 19, width: 26, textAlign: 'center' }}>{r.block.emoji}</span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ fontSize: 15, fontWeight: 600 }}>{r.block.name}</span>
              <span style={{ ...tabular, display: 'block', fontSize: 12, color: COLOR.faint, marginTop: 2 }}>
                {clockOfMinutes(r.startMinutes)} – {clockOfMinutes(r.endMinutes % 1440)}
                {' · '}{durationText(r.endMinutes - r.startMinutes)}
              </span>
            </span>
            {i === 0 && <span style={{ ...liveBadge }}>자정 고정</span>}
          </button>
        ))}
      </div>

      <p style={{ margin: '10px 16px 0', fontSize: 12, color: COLOR.faint, lineHeight: 1.7 }}>
        블록은 <strong>여섯 조각</strong>이고 늘거나 줄지 않습니다. 이름과 시작 시각만 내 생활에 맞추세요.
        조각이 너무 많으면 계획이 일정표가 되고, 너무 적으면 한 번 무너졌을 때 돌아올 지점이 없습니다.
      </p>

      {/* ── 분류 ─────────────────────────────── */}
      <div style={sectionTitle}>🗂 내 분류</div>

      <div style={{ ...card, margin: '0 16px', padding: 0, overflow: 'hidden' }}>
        {categories.length === 0 ? (
          <div style={empty}>분류가 하나도 없어요. 아래에서 추가해 주세요.</div>
        ) : (
          categories.map((c, i) => (
            <button
              key={c.id}
              onClick={() => onEdit(c)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                padding: '12px 16px', background: 'none', border: 'none',
                borderBottom: i === categories.length - 1 ? 'none' : `1px solid ${COLOR.line}`,
                cursor: 'pointer', font: 'inherit', textAlign: 'left', color: COLOR.text,
              }}
            >
              <CategoryMark color={c.color} emoji={c.emoji} />

              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: 15, fontWeight: 600 }}>{c.name}</span>
                <span style={{ display: 'block', fontSize: 12, color: COLOR.faint, marginTop: 2 }}>
                  기록 {useCount[c.id] ?? 0}건
                  {c.guard && (hasScript(c)
                    ? ' · 대본 있음'
                    : ' · 대본 비었음')}
                </span>
              </span>

              {c.guard && <span style={{ ...missBadge, marginRight: 2 }}>🚧 붙잡기</span>}

              {c.weeklyGoalMinutes != null && c.weeklyGoalMinutes > 0 && (
                <span style={{ ...(c.goalKind === '이상' ? okBadge : missBadge), ...tabular }}>
                  주 {durationText(c.weeklyGoalMinutes)} {c.goalKind}
                </span>
              )}
            </button>
          ))
        )}
      </div>

      <div style={{ padding: '10px 16px 0' }}>
        <button style={addButton} onClick={onAdd}>＋ 분류 추가</button>
      </div>

      <p style={{ margin: '16px 16px 0', fontSize: 12, color: COLOR.faint, lineHeight: 1.7 }}>
        분류를 지워도 그 분류로 적어둔 <strong>기록은 남습니다.</strong>
        설정 → 지운 항목 되살리기에서 언제든 되돌릴 수 있어요.
      </p>

      <div style={{ height: 24 }} />
    </div>
  );
}

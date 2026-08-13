import React from 'react';
import { Category } from '../types';
import { durationText } from '../utils/time';
import { CategoryMark } from './Field';
import { COLOR, addButton, card, empty, missBadge, okBadge, sectionTitle, tabular } from './ui';

interface Props {
  categories: Category[];
  /** categoryId → 지금까지 적어둔 기록 수 */
  useCount: Record<string, number>;
  onAdd: () => void;
  onEdit: (c: Category) => void;
}

export default function CategoriesView({ categories, useCount, onAdd, onEdit }: Props) {
  return (
    <div>
      <div style={sectionTitle}>내 분류</div>

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
                </span>
              </span>

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

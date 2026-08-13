import React, { useState } from 'react';
import { BlockReport, Category, DateKey, KEEP_RATIO } from '../types';
import { categoryMeta } from '../utils/block';
import { clockOfMinutes, dayLabel, durationText } from '../utils/time';
import { CategoryField, PreviewBox, TextField } from './Field';
import Sheet from './Sheet';
import { COLOR, missBadge, okBadge } from './ui';

interface Props {
  report: BlockReport;
  day: DateKey;
  today: DateKey;
  categories: Category[];
  allCategories: Category[];
  onClose: () => void;
  onSave: (categoryId: string, memo: string) => void;
  onClear?: () => void;
}

/**
 * 블록 하나를 계획하고 결과를 보는 시트.
 *
 * 계획은 '무엇을 할까' 한 가지와 '어떻게 할까' 한 줄이면 충분하다.
 * 특히 메모는 거절 멘트를 미리 적어두는 자리다 —
 * "야식 권하면 다이어트 중이라고 말하기" 처럼, 그 순간에 생각해내지 않아도 되게.
 */
export default function BlockSheet({
  report, day, today, categories, allCategories, onClose, onSave, onClear,
}: Props) {
  const [categoryId, setCategoryId] = useState(
    report.plannedCategoryId ?? report.topCategoryId ?? categories[0]?.id ?? '',
  );
  const [memo, setMemo] = useState(report.planMemo);

  const done = report.state === 'kept' || report.state === 'missed' || report.state === 'unplanned';
  const target = report.minutes * KEEP_RATIO;

  return (
    <Sheet
      title={`${report.emoji} ${report.name} ${clockOfMinutes(report.startMinutes)}–${clockOfMinutes(report.endMinutes % 1440)}`}
      onClose={onClose}
      onSave={() => onSave(categoryId, memo.trim())}
      onDelete={onClear}
      deleteLabel="계획 지우기"
      saveLabel={report.plannedCategoryId ? '계획 고치기' : '이 블록 계획하기'}
      saveDisabledReason={categoryId ? undefined : '분류를 골라주세요.'}
    >
      {day !== today && (
        <p style={{ margin: '0 0 12px', fontSize: 13, color: COLOR.sub }}>
          {dayLabel(day, today)}의 블록이에요.
        </p>
      )}

      {/* ── 이 블록에 실제로 한 일 ──────────────── */}
      {report.totalMinutes > 0 ? (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: COLOR.sub, marginBottom: 7 }}>
            이 블록에 적어둔 것
          </div>
          {report.byCategory.slice(0, 4).map(c => {
            const m = categoryMeta(allCategories, c.categoryId);
            const planned = c.categoryId === report.plannedCategoryId;
            return (
              <div
                key={c.categoryId}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '6px 0', fontSize: 14,
                }}
              >
                <span style={{ width: 9, height: 9, borderRadius: '50%', background: m.color }} />
                <span style={{ flex: 1 }}>
                  {m.emoji} {m.name}
                  {planned && <span style={{ ...okBadge, marginLeft: 6 }}>계획한 것</span>}
                </span>
                <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{durationText(c.minutes)}</strong>
              </div>
            );
          })}
        </div>
      ) : (
        <p style={{ margin: '0 0 14px', fontSize: 13, color: COLOR.faint, lineHeight: 1.6 }}>
          이 블록엔 아직 적어둔 게 없어요.
        </p>
      )}

      {/* ── 판정 ────────────────────────────── */}
      {done && report.plannedCategoryId && (
        <PreviewBox
          tone={report.state === 'missed' ? 'warn' : 'plain'}
          rows={[
            {
              label: '계획한 것에 쓴 시간',
              value: `${durationText(report.plannedMinutes)} / ${durationText(report.minutes)}`,
              strong: true,
            },
            { label: '지켰다고 볼 기준', value: `${durationText(target)} 이상 (블록의 절반)` },
          ]}
        />
      )}

      {done && report.plannedCategoryId && (
        <p style={{ margin: '-6px 0 14px', fontSize: 13, lineHeight: 1.65 }}>
          {report.state === 'kept' ? (
            <span style={{ color: COLOR.good }}>
              <strong>✓ 지켰어요.</strong> 이 블록은 성공으로 셉니다.
            </span>
          ) : (
            <span style={{ color: COLOR.warn }}>
              <strong>✕ 이 블록은 놓쳤어요.</strong> 다음 블록은 그대로 새로 시작합니다 —
              한 블록이 어긋났다고 하루가 어긋난 건 아니에요.
            </span>
          )}
        </p>
      )}

      {done && !report.plannedCategoryId && (
        <p style={{ margin: '0 0 14px', fontSize: 12, color: COLOR.faint, lineHeight: 1.6 }}>
          계획을 안 세운 블록은 성공·실패를 매기지 않아요.
          지금 적어두면 <strong>어제 이 시간에 뭘 하려 했는지</strong> 되짚는 데는 도움이 됩니다.
        </p>
      )}

      {report.state === 'now' && report.plannedCategoryId && (
        <PreviewBox
          rows={[
            { label: '지금까지 계획대로', value: durationText(report.plannedMinutes), strong: true },
            { label: '이 블록에서 지나간 시간', value: durationText(report.elapsedMinutes) },
            { label: '지키려면', value: `${durationText(target)} 이상` },
          ]}
        />
      )}

      {report.state === 'missed' && (
        <div style={{ ...missBadge, display: 'inline-block', marginBottom: 12 }}>
          다음 블록부터 다시
        </div>
      )}

      {/* ── 계획 ────────────────────────────── */}
      <CategoryField
        label="이 블록엔 뭘 할까요"
        categories={categories}
        value={categoryId}
        onChange={setCategoryId}
      />

      <TextField
        label="한 줄 계획 (안 적어도 됩니다)"
        value={memo}
        onChange={setMemo}
        placeholder="보고서 끝내기 / 야식 권하면 거절하기"
      />
    </Sheet>
  );
}

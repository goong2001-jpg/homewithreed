import React, { useState } from 'react';
import { CATEGORY_COLORS, CATEGORY_EMOJIS, Category, GoalKind } from '../types';
import { NewCategory } from '../hooks/useTracker';
import { durationText } from '../utils/time';
import { ChoiceField, HoursField, PalettePicker, PreviewBox, TextField } from './Field';
import Sheet from './Sheet';
import { COLOR } from './ui';

interface Props {
  category: Category | null;
  /** 이 분류로 적어둔 기록 수 — 지울 때 뭐가 딸려가는지 알려주려고 */
  usedBy: number;
  onClose: () => void;
  onSave: (v: NewCategory) => void;
  onDelete?: () => void;
}

const GOAL_HINT: Record<GoalKind, string> = {
  이상: '이만큼은 하고 싶다 (운동, 공부처럼)',
  이하: '이보다 덜 쓰고 싶다 (딴짓, 야근처럼)',
};

export default function CategorySheet({ category, usedBy, onClose, onSave, onDelete }: Props) {
  const [name, setName] = useState(category?.name ?? '');
  const [emoji, setEmoji] = useState(category?.emoji ?? CATEGORY_EMOJIS[0]);
  const [color, setColor] = useState(category?.color ?? CATEGORY_COLORS[0]);
  const [goalKind, setGoalKind] = useState<GoalKind>(category?.goalKind ?? '이상');
  const [hours, setHours] = useState(
    category?.weeklyGoalMinutes != null ? String(category.weeklyGoalMinutes / 60) : '',
  );

  const goalMinutes = hours.trim() === '' ? null : Math.round(Number(hours) * 60);
  const goalBroken = hours.trim() !== '' && (!isFinite(Number(hours)) || Number(hours) <= 0);

  const saveDisabledReason =
    name.trim() === '' ? '이름을 적어주세요.'
      : goalBroken ? '목표 시간을 숫자로 적어주세요. (예: 3, 3.5)'
        : undefined;

  return (
    <Sheet
      title={category ? '분류 고치기' : '분류 추가'}
      onClose={onClose}
      onSave={() => onSave({
        name: name.trim(),
        color,
        emoji,
        builtin: category?.builtin ?? false,
        weeklyGoalMinutes: goalMinutes,
        goalKind,
      })}
      onDelete={onDelete}
      deleteLabel={usedBy > 0 ? `삭제 (기록 ${usedBy}건은 남습니다)` : '삭제'}
      saveDisabledReason={saveDisabledReason}
    >
      <TextField label="이름" value={name} onChange={setName} placeholder="운동, 사이드잡…" />

      <PalettePicker label="이모지" options={CATEGORY_EMOJIS} value={emoji} onChange={setEmoji} />
      <PalettePicker label="색" options={CATEGORY_COLORS} value={color} onChange={setColor} isColor />

      <div style={{ height: 4 }} />

      <HoursField
        label="주간 목표"
        value={hours}
        onChange={setHours}
        hint={`비워두면 목표를 안 잡습니다. ${GOAL_HINT[goalKind]}`}
      />

      {goalMinutes != null && !goalBroken && (
        <>
          <ChoiceField<GoalKind>
            label="이 시간을"
            value={goalKind}
            options={[
              { value: '이상', label: '이상 하기', color: COLOR.good },
              { value: '이하', label: '이하로 줄이기', color: COLOR.warn },
            ]}
            onChange={setGoalKind}
          />
          <PreviewBox
            rows={[
              { label: '한 주 목표', value: `${durationText(goalMinutes)} ${goalKind}`, strong: true },
              { label: '하루로 치면', value: durationText(goalMinutes / 7) },
            ]}
          />
        </>
      )}

      {category && usedBy > 0 && (
        <p style={{ margin: '0 0 8px', fontSize: 12, color: COLOR.faint, lineHeight: 1.6 }}>
          이 분류로 적어둔 기록이 {usedBy}건 있어요.
          분류를 지워도 기록은 사라지지 않고 <strong>'지운 분류'</strong>로 남습니다.
        </p>
      )}
    </Sheet>
  );
}

import React, { useState } from 'react';
import { CATEGORY_COLORS, CATEGORY_EMOJIS, Category, GoalKind } from '../types';
import { NewCategory } from '../hooks/useTracker';
import { durationText } from '../utils/time';
import {
  CategoryField, ChoiceField, HoursField, PalettePicker, PreviewBox, TextAreaField, TextField,
} from './Field';
import Sheet from './Sheet';
import { COLOR } from './ui';

interface Props {
  category: Category | null;
  /** 이 분류로 적어둔 기록 수 — 지울 때 뭐가 딸려가는지 알려주려고 */
  usedBy: number;
  /** '대신 이걸 할래'에 고를 수 있는 분류들 */
  categories: Category[];
  onClose: () => void;
  onSave: (v: NewCategory) => void;
  onDelete?: () => void;
}

const GOAL_HINT: Record<GoalKind, string> = {
  이상: '이만큼은 하고 싶다 (운동, 공부처럼)',
  이하: '이보다 덜 쓰고 싶다 (딴짓, 야근처럼)',
};

export default function CategorySheet({
  category, usedBy, categories, onClose, onSave, onDelete,
}: Props) {
  const [name, setName] = useState(category?.name ?? '');
  const [emoji, setEmoji] = useState(category?.emoji ?? CATEGORY_EMOJIS[0]);
  const [color, setColor] = useState(category?.color ?? CATEGORY_COLORS[0]);
  const [goalKind, setGoalKind] = useState<GoalKind>(category?.goalKind ?? '이상');
  const [hours, setHours] = useState(
    category?.weeklyGoalMinutes != null ? String(category.weeklyGoalMinutes / 60) : '',
  );

  const [guard, setGuard] = useState(category?.guard ?? false);
  const [away, setAway] = useState(category?.away ?? '');
  const [swap, setSwap] = useState(category?.swap ?? '');
  const [dislike, setDislike] = useState(category?.dislike ?? '');
  const [swapCategoryId, setSwapCategoryId] = useState<string | null>(
    category?.swapCategoryId ?? null,
  );

  const goalMinutes = hours.trim() === '' ? null : Math.round(Number(hours) * 60);
  const goalBroken = hours.trim() !== '' && (!isFinite(Number(hours)) || Number(hours) <= 0);

  const saveDisabledReason =
    name.trim() === '' ? '이름을 적어주세요.'
      : goalBroken ? '목표 시간을 숫자로 적어주세요. (예: 3, 3.5)'
        : undefined;

  // 자기 자신을 대체 행동으로 고를 수는 없다
  const swapChoices = categories.filter(c => c.id !== category?.id);

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
        guard,
        away: away.trim(),
        swap: swap.trim(),
        dislike: dislike.trim(),
        swapCategoryId,
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

      {/* ── 끊고 싶은 것 ────────────────────────── */}
      <div
        style={{
          margin: '4px 0 14px', padding: '2px 0 0',
          borderTop: `1px solid ${COLOR.line}`,
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 700, color: COLOR.sub, margin: '14px 0 8px' }}>
          🚧 끊고 싶은 것인가요
        </div>

        <label
          style={{
            display: 'flex', alignItems: 'center', gap: 9, marginBottom: 10,
            padding: '11px 13px', borderRadius: 9,
            border: `1px solid ${guard ? COLOR.accent : COLOR.line}`,
            background: guard ? '#f3f2fe' : '#fbfcfd',
            cursor: 'pointer', fontSize: 14, color: COLOR.text,
          }}
        >
          <input
            type="checkbox"
            checked={guard}
            onChange={e => setGuard(e.target.checked)}
            style={{ width: 18, height: 18, accentColor: COLOR.accent }}
          />
          시작 누르기 전에 한 번 붙잡기
        </label>

        <p style={{ margin: '0 0 14px', fontSize: 12, color: COLOR.faint, lineHeight: 1.65 }}>
          켜두면 이 분류를 시작할 때 아래 대본을 먼저 보여주고,
          <strong> [그래도 할래요]는 3초 뒤에</strong> 눌립니다.
          충동과 행동 사이에 간극을 만드는 게 전부입니다.
        </p>

        {guard && (
          <>
            <TextAreaField
              label="🚧 멀리하기 — 손이 안 닿게"
              value={away}
              onChange={setAway}
              placeholder={'폰은 거실 서랍에 넣기\n앱 알림 전부 끄기\n프로필에 "숏폼 끊는 중" 적어두기'}
              hint="한 줄에 하나씩. 물리적으로 멀어질수록 의지가 덜 듭니다."
            />

            <TextAreaField
              label="🔄 대체하기 — 대신 할 것"
              value={swap}
              onChange={setSwap}
              placeholder={'커피 대신 보리차를 커피잔에 마시기\n야식 당기면 껌 씹기\n권유받으면 "다이어트 중이라" 하고 거절하기'}
              hint="비슷한 느낌을 주되 해롭지 않은 것. 거절 멘트도 미리 적어두면 그 순간에 안 흔들립니다."
            />

            <TextAreaField
              label="🙅 싫어하기 — 매력 떨어뜨리기"
              value={dislike}
              onChange={setDislike}
              placeholder={'폰 화면 흑백 모드로 바꾸기\n식탁보 파란색으로\n먹을 때 귀마개 끼고 천천히'}
              hint="자극이 약해지면 뇌가 덜 찾습니다."
            />

            {swapChoices.length > 0 && (
              <>
                <CategoryField
                  label="대신 시작할 분류 (한 번에 바꾸기)"
                  categories={swapChoices}
                  value={swapCategoryId ?? ''}
                  onChange={setSwapCategoryId}
                />
                {swapCategoryId && (
                  <button
                    onClick={() => setSwapCategoryId(null)}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer', font: 'inherit',
                      fontSize: 12, color: COLOR.sub, textDecoration: 'underline',
                      padding: 0, margin: '-8px 0 14px',
                    }}
                  >
                    지정 안 함
                  </button>
                )}
              </>
            )}
          </>
        )}
      </div>

      {category && usedBy > 0 && (
        <p style={{ margin: '0 0 8px', fontSize: 12, color: COLOR.faint, lineHeight: 1.6 }}>
          이 분류로 적어둔 기록이 {usedBy}건 있어요.
          분류를 지워도 기록은 사라지지 않고 <strong>'지운 분류'</strong>로 남습니다.
        </p>
      )}
    </Sheet>
  );
}

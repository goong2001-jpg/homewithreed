import React, { useState } from 'react';
import { CATEGORY_EMOJIS, TimeBlock } from '../types';
import { clockOfMinutes, durationText, parseClock } from '../utils/time';
import { ClockField, PalettePicker, PreviewBox, TextField } from './Field';
import Sheet from './Sheet';
import { COLOR } from './ui';

interface Props {
  block: TimeBlock;
  /** 목록에서 몇 번째인가 — 첫 블록은 시작 시각을 못 바꾼다 */
  index: number;
  /** 앞 블록의 시작 (첫 블록이면 null) */
  prevStart: number | null;
  /** 뒤 블록의 시작 (마지막이면 1440) */
  nextStart: number;
  onClose: () => void;
  onSave: (v: { name: string; emoji: string; startMinutes: number }) => void;
}

const BLOCK_EMOJIS = ['🌙', '🌅', '☀️', '🌤', '🌆', '🌃', '⏰', '🔥', '🧩', '🎯', ...CATEGORY_EMOJIS];

export default function BlockEditSheet({
  block, index, prevStart, nextStart, onClose, onSave,
}: Props) {
  const [name, setName] = useState(block.name);
  const [emoji, setEmoji] = useState(block.emoji);
  const [startText, setStartText] = useState(clockOfMinutes(block.startMinutes));

  const first = index === 0;
  const startMinutes = first ? 0 : parseClock(startText);

  const saveDisabledReason =
    name.trim() === '' ? '이름을 적어주세요.'
      : startMinutes == null ? '시작 시각을 읽을 수 없어요. 9:30 처럼 적어주세요.'
        : (prevStart != null && startMinutes <= prevStart)
          ? `앞 블록보다 뒤여야 해요. (${clockOfMinutes(prevStart)} 이후)`
          : startMinutes >= nextStart
            ? `뒤 블록보다 앞이어야 해요. (${clockOfMinutes(nextStart % 1440)} 이전)`
            : undefined;

  return (
    <Sheet
      title="블록 고치기"
      onClose={onClose}
      onSave={() => onSave({ name: name.trim(), emoji, startMinutes: startMinutes ?? 0 })}
      saveDisabledReason={saveDisabledReason}
    >
      <TextField label="이름" value={name} onChange={setName} placeholder="아침, 오전, 퇴근후…" />

      <PalettePicker label="이모지" options={BLOCK_EMOJIS} value={emoji} onChange={setEmoji} />

      {first ? (
        <p
          style={{
            margin: '0 0 14px', padding: '11px 13px', borderRadius: 9,
            background: '#f4f6fa', fontSize: 13, color: COLOR.sub, lineHeight: 1.65,
          }}
        >
          첫 블록은 <strong>자정(00:00)</strong>에서 시작합니다. 이건 못 바꿔요 —
          자정을 넘나드는 블록을 만들면 '오늘 저녁 블록'이 이틀에 걸쳐서
          하루 계산이 전부 어긋납니다.
        </p>
      ) : (
        <ClockField
          label="시작 시각"
          value={startText}
          onChange={setStartText}
          invalid={startMinutes == null}
          hint={`끝은 다음 블록이 시작하는 ${clockOfMinutes(nextStart % 1440)} 입니다.`}
        />
      )}

      {startMinutes != null && startMinutes < nextStart && (
        <PreviewBox
          rows={[
            {
              label: '이 블록',
              value: `${clockOfMinutes(startMinutes)} – ${clockOfMinutes(nextStart % 1440)}`,
              strong: true,
            },
            { label: '길이', value: durationText(nextStart - startMinutes) },
          ]}
        />
      )}
    </Sheet>
  );
}

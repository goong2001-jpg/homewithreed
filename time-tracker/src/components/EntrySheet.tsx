import React, { useState } from 'react';
import { Category, DateKey, Entry, UNKNOWN_CATEGORY } from '../types';
import { NewEntry } from '../hooks/useTracker';
import { normalizeRange, overlapsOf } from '../utils/entry';
import {
  MINUTE, clock, clockOfMinutes, dayKeyOf, dayLabel, durationText, minutesOfDay, parseClock,
} from '../utils/time';
import { CategoryField, ClockField, DateField, PreviewBox, TextField } from './Field';
import Sheet from './Sheet';
import { COLOR } from './ui';

interface Props {
  entry: Entry | null;
  /** 빈 구간을 눌러 들어왔을 때 미리 채워둘 시간 */
  prefill: { start: number; end: number } | null;
  categories: Category[];
  allCategories: Category[];
  entries: Entry[];
  today: DateKey;
  now: number;
  onClose: () => void;
  onSave: (v: NewEntry) => void;
  onDelete?: () => void;
}

/**
 * 기록 하나를 적거나 고치는 시트.
 *
 * 타이머로 만든 기록과 손으로 적은 기록이 같은 시트를 쓴다 —
 * 어차피 같은 레코드라서 나눌 이유가 없다.
 */
export default function EntrySheet({
  entry, prefill, categories, allCategories, entries, today, now, onClose, onSave, onDelete,
}: Props) {
  const initialStart = entry?.startedAt ?? prefill?.start ?? now - 30 * MINUTE;
  const initialEnd = entry ? entry.endedAt : (prefill?.end ?? now);

  const [day, setDay] = useState<DateKey>(dayKeyOf(initialStart));
  const [startText, setStartText] = useState(clock(initialStart));
  const [endText, setEndText] = useState(initialEnd == null ? clock(now) : clock(initialEnd));
  const [running, setRunning] = useState(initialEnd == null);
  const [categoryId, setCategoryId] = useState(
    entry?.categoryId ?? categories[0]?.id ?? '',
  );
  const [memo, setMemo] = useState(entry?.memo ?? '');

  const startMinutes = parseClock(startText);
  const endMinutes = parseClock(endText);

  // 지운 분류로 적어둔 기록도 고칠 수 있어야 한다 — 목록에 그 분류만 되살려 끼운다
  const pickable = categories.some(c => c.id === categoryId)
    ? categories
    : [...categories, allCategories.find(c => c.id === categoryId)].filter(
      (c): c is Category => !!c,
    );

  const range = startMinutes == null
    ? null
    : normalizeRange(day, startMinutes, running ? minutesOfDay(now) : (endMinutes ?? startMinutes));

  const minutes = range ? (range.end - range.start) / MINUTE : 0;

  const overlaps = range
    ? overlapsOf(entries, range.start, running ? range.start + MINUTE : range.end, entry?.id ?? null, now)
    : [];

  const nameOf = (id: string) =>
    allCategories.find(c => c.id === id)?.name ?? UNKNOWN_CATEGORY.name;

  const saveDisabledReason =
    startMinutes == null ? '시작 시각을 읽을 수 없어요. 9:30 처럼 적어주세요.'
      : (!running && endMinutes == null) ? '끝난 시각을 읽을 수 없어요. 9:30 처럼 적어주세요.'
        : !categoryId ? '분류를 골라주세요.'
          : undefined;

  const rows = [
    { label: '길이', value: running ? '진행 중' : durationText(minutes), strong: true },
    ...(range && range.crossesMidnight && !running
      ? [{
        label: '끝난 시각',
        value: `다음날 ${clockOfMinutes(endMinutes ?? 0)}`,
      }]
      : []),
    ...(overlaps.length
      ? [{
        label: '겹치는 기록',
        value: overlaps.slice(0, 2).map(e => nameOf(e.categoryId)).join(', ')
          + (overlaps.length > 2 ? ` 외 ${overlaps.length - 2}건` : ''),
      }]
      : []),
  ];

  const handleSave = () => {
    if (saveDisabledReason || !range) return;
    onSave({
      categoryId,
      startedAt: range.start,
      endedAt: running ? null : range.end,
      memo: memo.trim(),
    });
  };

  return (
    <Sheet
      title={entry ? '기록 고치기' : '직접 적기'}
      onClose={onClose}
      onSave={handleSave}
      onDelete={onDelete}
      saveDisabledReason={saveDisabledReason}
    >
      <CategoryField
        label="무엇을 했나요"
        categories={pickable}
        value={categoryId}
        onChange={setCategoryId}
      />

      <DateField
        label="날짜"
        value={day}
        onChange={setDay}
        hint={day === today ? undefined : dayLabel(day, today)}
      />

      <ClockField
        label="시작"
        value={startText}
        onChange={setStartText}
        invalid={startMinutes == null}
        quick={[{ label: '지금', minutes: minutesOfDay(now) }]}
      />

      {!running && (
        <ClockField
          label="끝"
          value={endText}
          onChange={setEndText}
          invalid={endMinutes == null}
          quick={[{ label: '지금', minutes: minutesOfDay(now) }]}
          hint={range?.crossesMidnight ? '시작보다 이르니 다음날로 봅니다.' : undefined}
        />
      )}

      <label
        style={{
          display: 'flex', alignItems: 'center', gap: 9, marginBottom: 14,
          padding: '11px 13px', borderRadius: 9,
          border: `1px solid ${running ? COLOR.accent : COLOR.line}`,
          background: running ? '#f3f2fe' : '#fbfcfd',
          cursor: 'pointer', fontSize: 14, color: COLOR.text,
        }}
      >
        <input
          type="checkbox"
          checked={running}
          onChange={e => setRunning(e.target.checked)}
          style={{ width: 18, height: 18, accentColor: COLOR.accent }}
        />
        아직 하는 중 (지금부터 계속 쌓기)
      </label>

      <PreviewBox rows={rows} tone={overlaps.length ? 'warn' : 'plain'} />

      {overlaps.length > 0 && (
        <p style={{ margin: '-6px 0 14px', fontSize: 12, color: COLOR.warn, lineHeight: 1.6 }}>
          이 시간대에 이미 적어둔 기록이 있어요. 그대로 저장해도 되지만,
          <strong> 같은 시간을 두 번 세지는 않습니다.</strong>
        </p>
      )}

      <TextField
        label="메모 (안 적어도 됩니다)"
        value={memo}
        onChange={setMemo}
        placeholder="보고서 정리, 둘째 목욕…"
      />
    </Sheet>
  );
}

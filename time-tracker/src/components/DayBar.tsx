import React from 'react';
import { Category, DateKey, Segment, UNKNOWN_CATEGORY } from '../types';
import { DAY_MINUTES, minutesOfDay } from '../utils/time';
import { COLOR } from './ui';

interface Props {
  day: DateKey;
  today: DateKey;
  segments: Segment[];
  categories: Category[];
  now: number;
}

const TICKS = [0, 6, 12, 18, 24];

/**
 * 하루를 24시간짜리 막대 하나로.
 *
 * 숫자 표를 보기 전에 **빈 칸이 먼저 눈에 들어오는 게** 이 화면의 목적이다.
 * 회색으로 남은 자리가 곧 '어디로 샜는지 모르는 시간'이다.
 */
export default function DayBar({ day, today, segments, categories, now }: Props) {
  const colorOf = (id: string) =>
    categories.find(c => c.id === id)?.color ?? UNKNOWN_CATEGORY.color;

  const nowPercent = day === today ? (minutesOfDay(now) / DAY_MINUTES) * 100 : null;

  return (
    <div style={{ padding: '0 16px' }}>
      <div
        style={{
          position: 'relative',
          height: 26,
          borderRadius: 7,
          background: COLOR.blank,
          overflow: 'hidden',
        }}
      >
        {/* 6시간마다 옅은 눈금 — 막대 어디쯤이 몇 시인지 감이 잡힌다 */}
        {[6, 12, 18].map(h => (
          <div
            key={h}
            style={{
              position: 'absolute', top: 0, bottom: 0, left: `${(h / 24) * 100}%`,
              width: 1, background: 'rgba(255,255,255,0.7)',
            }}
          />
        ))}

        {segments.map(s => {
          const left = (minutesOfDay(s.start) / DAY_MINUTES) * 100;
          const width = (s.minutes / DAY_MINUTES) * 100;
          return (
            <div
              key={`${s.entryId}:${s.start}`}
              title={s.day}
              style={{
                position: 'absolute', top: 0, bottom: 0,
                left: `${left}%`,
                width: `${Math.max(width, 0.35)}%`,
                background: colorOf(s.categoryId),
                opacity: s.running ? 0.75 : 1,
              }}
            />
          );
        })}

        {nowPercent != null && (
          <div
            aria-hidden
            style={{
              position: 'absolute', top: 0, bottom: 0, left: `${nowPercent}%`,
              width: 2, background: COLOR.text, opacity: 0.55,
            }}
          />
        )}
      </div>

      <div style={{ position: 'relative', height: 14, marginTop: 3 }}>
        {TICKS.map(h => (
          <span
            key={h}
            style={{
              position: 'absolute',
              left: `${(h / 24) * 100}%`,
              transform: h === 0 ? 'none' : h === 24 ? 'translateX(-100%)' : 'translateX(-50%)',
              fontSize: 10,
              color: COLOR.faint,
            }}
          >
            {h}시
          </span>
        ))}
      </div>
    </div>
  );
}

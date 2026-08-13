import React from 'react';
import { Category } from '../types';
import { durationText } from '../utils/time';
import { COLOR, sectionTitle } from './ui';

interface Props {
  categories: Category[];
  runningCategoryId: string | null;
  /** 오늘 이 분류로 쌓인 시간(분) */
  todayMinutes: Record<string, number>;
  onStart: (categoryId: string) => void;
  onStop: () => void;
}

/**
 * 분류 하나를 눌러 바로 시작하기.
 *
 * ★ 이 앱에서 가장 자주 눌리는 화면이라 **한 번의 탭**으로 끝나야 한다.
 *   돌던 기록은 자동으로 그 순간 끝나므로 '멈추고 → 시작하고'가 필요 없다.
 *   지금 돌아가는 분류를 다시 누르면 멈춘다.
 */
export default function QuickStart({
  categories, runningCategoryId, todayMinutes, onStart, onStop,
}: Props) {
  return (
    <>
      <div style={sectionTitle}>
        {runningCategoryId ? '다른 걸 시작하면 지금 기록이 끝납니다' : '무엇부터 시작할까요'}
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 8,
          padding: '0 16px',
        }}
      >
        {categories.map(c => {
          const on = c.id === runningCategoryId;
          const minutes = todayMinutes[c.id] ?? 0;
          return (
            <button
              key={c.id}
              onClick={() => (on ? onStop() : onStart(c.id))}
              style={{
                padding: '11px 3px 9px',
                borderRadius: 12,
                border: `1px solid ${on ? c.color : COLOR.line}`,
                background: on ? c.color : '#fff',
                color: on ? '#fff' : COLOR.text,
                cursor: 'pointer',
                font: 'inherit',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                overflow: 'hidden',
                boxShadow: on ? `0 3px 10px ${c.color}55` : '0 1px 3px rgba(0,0,0,0.05)',
              }}
            >
              <span style={{ fontSize: 21, lineHeight: 1 }}>{on ? '■' : c.emoji}</span>
              <span
                style={{
                  fontSize: 12, fontWeight: on ? 700 : 600, maxWidth: '100%',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}
              >
                {on ? '멈추기' : c.name}
              </span>
              <span
                style={{
                  fontSize: 10.5,
                  color: on ? 'rgba(255,255,255,0.85)' : (minutes ? COLOR.faint : 'transparent'),
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {minutes ? durationText(minutes) : '0분'}
              </span>
            </button>
          );
        })}
      </div>
    </>
  );
}

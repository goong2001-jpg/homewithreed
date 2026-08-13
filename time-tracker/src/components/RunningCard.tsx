import React from 'react';
import { Category, Entry, UNKNOWN_CATEGORY } from '../types';
import { useNow } from '../hooks/useNow';
import { clock, stopwatch } from '../utils/time';
import { COLOR, card, tabular } from './ui';

interface Props {
  running: Entry | null;
  categories: Category[];
  onStop: () => void;
  onEdit: (e: Entry) => void;
}

/**
 * 지금 돌아가는 기록.
 *
 * 여기만 1초마다 다시 그린다 — 화면 전체를 초 단위로 갱신할 이유는 없고,
 * 그렇다고 경과 시간이 분 단위로만 움직이면 '멈춘 것처럼' 보인다.
 */
export default function RunningCard({ running, categories, onStop, onEdit }: Props) {
  const now = useNow(1000);

  if (!running) {
    return (
      <div
        style={{
          ...card,
          textAlign: 'center',
          color: COLOR.faint,
          fontSize: 14,
          lineHeight: 1.7,
          padding: '22px 16px',
        }}
      >
        지금 뭐 하고 있나요?<br />
        아래에서 <strong style={{ color: COLOR.sub }}>분류를 누르면</strong> 그 순간부터 시간이 쌓입니다.
      </div>
    );
  }

  const c = categories.find(x => x.id === running.categoryId);
  const color = c?.color ?? UNKNOWN_CATEGORY.color;
  const emoji = c?.emoji ?? UNKNOWN_CATEGORY.emoji;
  const name = c?.name ?? UNKNOWN_CATEGORY.name;

  return (
    <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
      <button
        onClick={() => onEdit(running)}
        style={{
          display: 'block', width: '100%', padding: '18px 16px 16px',
          background: `linear-gradient(180deg, ${color}14, ${color}05)`,
          border: 'none', borderBottom: `1px solid ${COLOR.line}`,
          cursor: 'pointer', textAlign: 'left', font: 'inherit', color: COLOR.text,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <span
            aria-hidden
            style={{
              width: 8, height: 8, borderRadius: '50%', background: color,
              animation: 'live-pulse 1.6s ease-in-out infinite',
            }}
          />
          <span style={{ fontSize: 15, fontWeight: 700 }}>{emoji} {name}</span>
          <span style={{ marginLeft: 'auto', fontSize: 12, color: COLOR.sub }}>
            {clock(running.startedAt)} 부터
          </span>
        </div>

        <div style={{ ...tabular, fontSize: 40, fontWeight: 800, letterSpacing: '-1px', color }}>
          {stopwatch(now - running.startedAt)}
        </div>

        {running.memo && (
          <div style={{ marginTop: 6, fontSize: 13, color: COLOR.sub }}>{running.memo}</div>
        )}
      </button>

      <div style={{ display: 'flex' }}>
        <button
          onClick={onStop}
          style={{
            flex: 1, padding: '14px 8px', background: 'none', border: 'none',
            cursor: 'pointer', font: 'inherit', fontSize: 15, fontWeight: 700, color: COLOR.text,
          }}
        >
          ■ 멈추기
        </button>
        <div style={{ width: 1, background: COLOR.line }} />
        <button
          onClick={() => onEdit(running)}
          style={{
            flex: 1, padding: '14px 8px', background: 'none', border: 'none',
            cursor: 'pointer', font: 'inherit', fontSize: 15, color: COLOR.sub,
          }}
        >
          고치기
        </button>
      </div>
    </div>
  );
}

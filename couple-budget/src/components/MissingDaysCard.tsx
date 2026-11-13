import React from 'react';
import { DateKey } from '../types';
import { dateLabel } from '../utils/format';

interface Props {
  /** 어제부터 거꾸로 연달아 기록이 없는 날 (오래된 날부터) — budget.ts missingDays */
  days: DateKey[];
  /** 그날 쓴 돈을 적으러 간다 (날짜가 미리 채워진다) */
  onFill: (date: DateKey) => void;
  /** 그날들은 안 썼다고 표시한다 */
  onMarkNoSpend: () => void;
}

/**
 * 홈 — 입력이 빠진 날 알림.
 * 안 적은 날은 '안 쓴 날'로 계산돼 여유돈이 실제보다 좋아 보인다. 그래서 숨기지 않고 묻는다.
 */
export default function MissingDaysCard({ days, onFill, onMarkNoSpend }: Props) {
  if (days.length === 0) return null;
  const first = days[0];
  const last = days[days.length - 1];
  const range = days.length === 1 ? dateLabel(last) : `${dateLabel(first)} ~ ${dateLabel(last)}`;

  const btn: React.CSSProperties = {
    flex: 1, padding: '10px 6px', borderRadius: 9, fontSize: 13, fontWeight: 700,
    cursor: 'pointer', whiteSpace: 'nowrap',
  };

  return (
    <div style={{
      margin: '0 12px 10px', background: '#FFF7E0', border: 'none',
      borderRadius: 20, padding: '16px 18px',
    }}>
      <div style={{ fontSize: 13.5, fontWeight: 700, color: '#8a6d1a' }}>
        {days.length === 1 ? '어제 기록이 없어요' : `${days.length}일째 기록이 없어요`}
      </div>
      <div style={{ fontSize: 12, color: '#a08a4f', margin: '3px 0 11px', lineHeight: 1.6 }}>
        {range} · 안 적은 날은 안 쓴 걸로 계산돼서 여유돈이 실제보다 많아 보여요.
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={() => onFill(last)}
          style={{ ...btn, background: '#12B76A', color: '#fff', border: 'none' }}
        >
          쓴 돈 적기
        </button>
        <button
          onClick={onMarkNoSpend}
          style={{ ...btn, background: '#fff', color: '#8a6d1a', border: '1.5px solid #f0d9a8' }}
        >
          {days.length === 1 ? '안 썼어요' : `${days.length}일 다 안 썼어요`}
        </button>
      </div>
    </div>
  );
}

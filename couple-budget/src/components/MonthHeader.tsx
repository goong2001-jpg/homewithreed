import React from 'react';
import { MonthKey, MonthPhase, SyncStatus } from '../types';
import { monthLabel } from '../utils/format';
import SyncBadge from './SyncBadge';

interface Props {
  month: MonthKey;
  phase?: MonthPhase;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  syncStatus?: SyncStatus;
  onSyncClick?: () => void;
  right?: React.ReactNode;
}

/** receipt-tracker/src/components/MonthlyList.tsx 의 스티키 월 헤더를 뽑아낸 것 */
export default function MonthHeader({
  month, phase, onPrev, onNext, onToday, syncStatus, onSyncClick, right,
}: Props) {
  const arrow: React.CSSProperties = {
    background: 'none', border: 'none', fontSize: 22, cursor: 'pointer',
    padding: '2px 6px', color: '#555', lineHeight: 1,
  };

  return (
    <div
      style={{
        background: '#fff',
        padding: '12px 14px',
        boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
        position: 'sticky',
        top: 0,
        zIndex: 10,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
        <button onClick={onPrev} style={arrow} aria-label="이전 달">‹</button>
        <span style={{ fontSize: 17, fontWeight: 700, whiteSpace: 'nowrap' }}>{monthLabel(month)}</span>
        <button onClick={onNext} style={arrow} aria-label="다음 달">›</button>

        {phase === 'future' && (
          <span style={{
            fontSize: 10, fontWeight: 700, color: '#8e6f00', background: '#fff8e1',
            border: '1px solid #ffe082', borderRadius: 10, padding: '2px 7px', whiteSpace: 'nowrap',
          }}>
            예정
          </span>
        )}
        {phase === 'past' && (
          <span style={{
            fontSize: 10, fontWeight: 700, color: '#546e7a', background: '#eceff1',
            border: '1px solid #cfd8dc', borderRadius: 10, padding: '2px 7px', whiteSpace: 'nowrap',
          }}>
            마감
          </span>
        )}
        {phase !== 'current' && (
          <button
            onClick={onToday}
            style={{
              fontSize: 11, padding: '4px 9px', border: '1px solid #ddd', borderRadius: 12,
              background: '#f5f5f5', color: '#666', cursor: 'pointer', whiteSpace: 'nowrap',
            }}
          >
            이번달
          </button>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        {right}
        {syncStatus && <SyncBadge status={syncStatus} onClick={onSyncClick} />}
      </div>
    </div>
  );
}

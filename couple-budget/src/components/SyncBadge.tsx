import React from 'react';
import { SyncStatus } from '../types';

interface Props {
  status: SyncStatus;
  onClick?: () => void;
}

const TEXT: Record<SyncStatus, string> = {
  off: '이 기기에만 저장',
  connecting: '연결 중…',
  live: '함께 쓰는 중',
  error: '동기화 오류',
};

const DOT: Record<SyncStatus, string> = {
  off: '#B0B8C1',
  connecting: '#F59F00',
  live: '#12B76A',
  error: '#F04452',
};

export default function SyncBadge({ status, onClick }: Props) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 5,
        background: '#F2F4F6',
        border: 'none',
        borderRadius: 8,
        padding: '6px 10px',
        fontSize: 12,
        fontWeight: 500,
        color: '#6B7684',
        cursor: onClick ? 'pointer' : 'default',
        whiteSpace: 'nowrap',
      }}
    >
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: '50%',
          background: DOT[status],
          flexShrink: 0,
          animation: status === 'connecting' ? 'piggy-pulse 1.2s ease-in-out infinite' : 'none',
        }}
      />
      {TEXT[status]}
    </button>
  );
}

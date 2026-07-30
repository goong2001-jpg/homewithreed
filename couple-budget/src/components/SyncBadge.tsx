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
  off: '#b0bec5',
  connecting: '#f39c12',
  live: '#27ae60',
  error: '#e74c3c',
};

export default function SyncBadge({ status, onClick }: Props) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 5,
        background: '#f5f7f8',
        border: 'none',
        borderRadius: 20,
        padding: '5px 10px',
        fontSize: 11,
        color: '#607d8b',
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

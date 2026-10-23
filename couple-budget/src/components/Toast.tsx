import React, { useEffect } from 'react';
import { TAB_BAR_HEIGHT } from './TabBar';

export interface ToastMessage {
  /** 같은 글자가 연달아 와도 다시 띄우도록 매번 다른 값 */
  key: number;
  text: string;
  tone: 'warn' | 'over';
}

interface Props {
  toast: ToastMessage | null;
  onDone: () => void;
  ms?: number;
}

/**
 * 탭바 바로 위에 잠깐 떠 있는 한 줄 알림.
 * 지출 저장 뒤 홈으로 넘어가도 보여야 해서 App 이 들고 있다.
 */
export default function Toast({ toast, onDone, ms = 3000 }: Props) {
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(onDone, ms);
    return () => clearTimeout(t);
  }, [toast, onDone, ms]);

  if (!toast) return null;
  const color = toast.tone === 'over' ? '#e74c3c' : '#f39c12';

  return (
    <div
      role="status"
      style={{
        position: 'fixed', left: 16, right: 16, bottom: TAB_BAR_HEIGHT + 14, zIndex: 50,
        background: '#2c3e50', color: '#fff', borderRadius: 12, padding: '12px 14px',
        fontSize: 13.5, fontWeight: 600, lineHeight: 1.5,
        boxShadow: '0 6px 20px rgba(0,0,0,0.18)', borderLeft: `5px solid ${color}`,
      }}
    >
      {toast.text}
    </div>
  );
}

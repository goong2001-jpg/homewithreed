import React, { useEffect } from 'react';
import { COLOR, dangerButton, primaryButton } from './ui';

interface Props {
  title: string;
  onClose: () => void;
  onSave: () => void;
  /** 있으면 하단에 삭제 버튼을 띄운다 (새로 추가할 때는 없다) */
  onDelete?: () => void;
  deleteLabel?: string;
  saveLabel?: string;
  /** 저장을 막을 이유 — 있으면 버튼이 잠기고 그 이유를 보여준다 */
  saveDisabledReason?: string;
  children: React.ReactNode;
}

/**
 * 아래에서 올라오는 편집 시트.
 *
 * "수정도 쉽게"의 핵심 — 자산·대출·고정비·분류가 전부 이 시트를 쓰고
 * 안에 들어가는 입력 칸만 달라진다.
 */
export default function Sheet({
  title, onClose, onSave, onDelete,
  deleteLabel = '삭제', saveLabel = '저장', saveDisabledReason, children,
}: Props) {
  // 시트가 떠 있는 동안 뒷 화면이 같이 스크롤되지 않게 막는다
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  // 안드로이드 뒤로가기 대신 쓰는 ESC (PC에서 확인할 때 편하다)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 50,
        background: 'rgba(0,0,0,0.35)',
        display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
        animation: 'fade-in 0.15s ease-out',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: COLOR.card,
          borderRadius: '16px 16px 0 0',
          maxHeight: '92vh',
          overflowY: 'auto',
          paddingBottom: 'calc(16px + env(safe-area-inset-bottom))',
          animation: 'sheet-up 0.22s ease-out',
        }}
      >
        {/* 손잡이 — 아래로 쓸어내리면 닫힌다는 신호 */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0 4px' }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: '#dfe4e8' }} />
        </div>

        <div
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '4px 16px 12px',
          }}
        >
          <strong style={{ fontSize: 17 }}>{title}</strong>
          <button
            onClick={onClose}
            aria-label="닫기"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 22, color: COLOR.faint, padding: '0 4px', lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>

        <div style={{ padding: '0 16px' }}>{children}</div>

        <div style={{ padding: '16px 16px 0' }}>
          {saveDisabledReason && (
            <p style={{ margin: '0 0 8px', fontSize: 13, color: COLOR.debt }}>
              {saveDisabledReason}
            </p>
          )}
          <button
            onClick={onSave}
            disabled={!!saveDisabledReason}
            style={{
              ...primaryButton,
              opacity: saveDisabledReason ? 0.4 : 1,
              cursor: saveDisabledReason ? 'not-allowed' : 'pointer',
            }}
          >
            {saveLabel}
          </button>

          {onDelete && (
            <button onClick={onDelete} style={{ ...dangerButton, marginTop: 6 }}>
              {deleteLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

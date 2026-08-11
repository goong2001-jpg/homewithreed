import React, { useState } from 'react';
import { AssetKind, KIND_COLORS, KIND_EMOJIS } from '../types';
import { TextField } from './Field';
import Sheet from './Sheet';
import { COLOR } from './ui';

interface Props {
  kind: AssetKind | null;
  /** 이 분류를 쓰고 있는 자산 개수 — 삭제할 때 경고에 쓴다 */
  usedBy: number;
  onSave: (v: { name: string; color: string; emoji: string }) => void;
  onDelete?: () => void;
  onClose: () => void;
}

export default function KindSheet({ kind, usedBy, onSave, onDelete, onClose }: Props) {
  const [name, setName] = useState(kind?.name ?? '');
  const [color, setColor] = useState(kind?.color ?? KIND_COLORS[0]);
  const [emoji, setEmoji] = useState(kind?.emoji ?? KIND_EMOJIS[0]);

  const reason = !name.trim() ? '분류 이름을 적어주세요.' : undefined;

  const handleDelete = onDelete
    ? () => {
        const msg = usedBy > 0
          ? `이 분류를 쓰는 자산이 ${usedBy}개 있어요.\n분류를 지워도 자산은 남고 '기타'로 옮겨집니다.\n\n지울까요?`
          : '이 분류를 지울까요?\n설정 화면에서 되살릴 수 있어요.';
        if (window.confirm(msg)) onDelete();
      }
    : undefined;

  return (
    <Sheet
      title={kind ? '분류 수정' : '분류 추가'}
      onClose={onClose}
      onDelete={handleDelete}
      saveDisabledReason={reason}
      onSave={() => onSave({ name: name.trim(), color, emoji })}
    >
      <TextField label="분류 이름" value={name} onChange={setName} placeholder="예) 자동차, 퇴직연금" />

      <div style={{ marginBottom: 14 }}>
        <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: COLOR.sub, marginBottom: 6 }}>
          아이콘
        </label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {KIND_EMOJIS.map(e => (
            <button
              key={e}
              onClick={() => setEmoji(e)}
              style={{
                width: 44, height: 44, fontSize: 20,
                borderRadius: 9, cursor: 'pointer',
                border: `2px solid ${e === emoji ? color : COLOR.line}`,
                background: e === emoji ? '#f4f7f9' : '#fbfcfd',
              }}
            >
              {e}
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: 14 }}>
        <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: COLOR.sub, marginBottom: 6 }}>
          색
        </label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {KIND_COLORS.map(c => (
            <button
              key={c}
              onClick={() => setColor(c)}
              aria-label={`색 ${c}`}
              style={{
                width: 38, height: 38, borderRadius: '50%', cursor: 'pointer',
                background: c,
                border: c === color ? '3px solid #222' : '3px solid transparent',
              }}
            />
          ))}
        </div>
      </div>

      {/* 고른 값이 목록에서 어떻게 보일지 미리 */}
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 9,
          background: '#f4f7f9', borderRadius: 9, padding: '12px 14px',
        }}
      >
        <span
          style={{
            width: 30, height: 30, borderRadius: 8, background: color,
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
          }}
        >
          {emoji}
        </span>
        <strong style={{ fontSize: 15 }}>{name.trim() || '분류 이름'}</strong>
      </div>
    </Sheet>
  );
}

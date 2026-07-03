import React from 'react';
import { COURSES } from '../curriculum/math';
import { playClick } from '../utils/sounds';

interface Props {
  currentCourseId: string;
  unlockedCourseIds: string[];
  courseLevels: Record<string, number>;
  onSelect: (courseId: string) => void;
  onClose: () => void;
}

export default function CourseSelect({ currentCourseId, unlockedCourseIds, courseLevels, onSelect, onClose }: Props) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 150, padding: 16,
    }}>
      <div style={{
        background: 'linear-gradient(160deg, #e0f7fa, #fce4ec)',
        borderRadius: 28, padding: 24, maxWidth: 420, width: '100%',
        maxHeight: '90vh', overflowY: 'auto',
        boxShadow: '0 25px 80px rgba(0,0,0,0.3)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <div style={{ fontSize: 24, fontWeight: 800 }}>📚 코스 고르기</div>
          <button onClick={onClose} style={{
            background: 'rgba(0,0,0,0.15)', border: 'none', borderRadius: '50%',
            width: 36, height: 36, fontSize: 18, cursor: 'pointer', fontWeight: 700,
          }}>✕</button>
        </div>
        <div style={{ fontSize: 13, color: '#888', marginBottom: 16 }}>
          하고 싶은 코스를 골라봐! 언제든 바꿀 수 있어요.
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {COURSES.map((c, idx) => {
            const unlocked = unlockedCourseIds.includes(c.id);
            const isCurrent = c.id === currentCourseId;
            const savedLevel = courseLevels[c.id];

            return (
              <button
                key={c.id}
                disabled={!unlocked}
                onClick={() => {
                  if (!unlocked || isCurrent) { onClose(); return; }
                  playClick();
                  onSelect(c.id);
                  onClose();
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '14px 16px', borderRadius: 16,
                  border: isCurrent ? '3px solid #27ae60' : '2px solid transparent',
                  background: isCurrent
                    ? 'linear-gradient(135deg, #84fab0, #8fd3f4)'
                    : unlocked ? 'white' : '#ececec',
                  cursor: unlocked ? 'pointer' : 'not-allowed',
                  opacity: unlocked ? 1 : 0.65,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                  textAlign: 'left',
                  fontFamily: 'inherit',
                }}
              >
                <span style={{ fontSize: 32, filter: unlocked ? 'none' : 'grayscale(1)' }}>
                  {unlocked ? c.emoji : '🔒'}
                </span>
                <span style={{ flex: 1 }}>
                  <span style={{ display: 'block', fontSize: 16, fontWeight: 800, color: unlocked ? '#2c3e50' : '#999' }}>
                    {idx + 1}단계 · {c.name}
                  </span>
                  <span style={{ display: 'block', fontSize: 12, color: unlocked ? '#888' : '#aaa', marginTop: 2 }}>
                    {isCurrent
                      ? '✓ 지금 하고 있어요'
                      : unlocked
                      ? (savedLevel ? `레벨 ${savedLevel}부터 이어서 해요` : '처음부터 시작해요')
                      : '앞 코스를 열심히 하면 열려요!'}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

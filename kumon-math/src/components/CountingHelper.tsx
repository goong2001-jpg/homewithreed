import React, { useState, useEffect, useRef } from 'react';
import { Problem } from '../types';
import { playClick } from '../utils/sounds';

interface Props {
  problem: Problem;
  onClose: () => void;
}

const EMOJIS = ['🍎', '🍊', '🍋', '🍇', '🍓', '🫐', '🍒', '🍑'];

export default function CountingHelper({ problem, onClose }: Props) {
  const emojiRef = useRef(EMOJIS[Math.floor(Math.random() * EMOJIS.length)]);
  const emoji = emojiRef.current;
  const [selectedCount, setSelectedCount] = useState(0);

  useEffect(() => { setSelectedCount(0); }, [problem]);

  const isAdd = problem.operation === 'add';
  const totalItems = isAdd ? problem.num1 + problem.num2 : problem.num1;
  const baseItems = problem.num1;
  const addItems = isAdd ? problem.num2 : 0;
  const removeTarget = isAdd ? 0 : problem.num2;

  const handleClick = (idx: number) => {
    if (isAdd) {
      if (idx >= baseItems) {
        const clickedPos = idx - baseItems + 1;
        setSelectedCount(prev => prev === clickedPos ? prev - 1 : clickedPos);
        playClick();
      }
    } else {
      if (idx >= totalItems - removeTarget) {
        const clickedFromEnd = totalItems - idx;
        setSelectedCount(prev => prev === clickedFromEnd ? prev - 1 : clickedFromEnd);
        playClick();
      }
    }
  };

  const progress = isAdd ? selectedCount === addItems : selectedCount === removeTarget;

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 100, padding: 20,
    }}>
      <div style={{
        background: 'white', borderRadius: 24, padding: '28px 24px',
        maxWidth: 480, width: '100%', textAlign: 'center',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
      }}>
        <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 6, color: '#e74c3c' }}>
          괜찮아, 같이 해보자! 😊
        </div>
        <div style={{ fontSize: 16, marginBottom: 18, color: '#666' }}>
          {emoji}을 직접 {isAdd ? '눌러서 더해' : '눌러서 빼'}볼까?
        </div>

        <div style={{
          background: '#fff9f0', borderRadius: 16, padding: '18px 14px', marginBottom: 18,
          border: '2px dashed #ffcc80',
        }}>
          <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 14, color: '#e67e22' }}>
            {problem.num1} {isAdd ? '+' : '-'} {problem.num2} = ?
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center', marginBottom: 10 }}>
            {Array.from({ length: totalItems }).map((_, i) => {
              const isAddable = isAdd && i >= baseItems;
              const isRemovable = !isAdd && i >= totalItems - removeTarget;
              const isSelected = isAdd
                ? i >= baseItems && i < baseItems + selectedCount
                : i >= totalItems - selectedCount;

              return (
                <div
                  key={i}
                  onClick={() => handleClick(i)}
                  style={{
                    fontSize: 30,
                    cursor: (isAddable || isRemovable) ? 'pointer' : 'default',
                    opacity: isRemovable && isSelected ? 0.25 : 1,
                    transform: isSelected ? 'scale(1.25)' : 'scale(1)',
                    transition: 'all 0.15s',
                    background: isAddable
                      ? (isSelected ? '#c8f7c5' : '#f0fff0')
                      : isRemovable
                      ? (isSelected ? '#ffd6d6' : '#fff5f5')
                      : 'transparent',
                    borderRadius: 8,
                    padding: 3,
                    border: (isAddable || isRemovable) ? '2px dashed #aaa' : '2px solid transparent',
                  }}
                >
                  {emoji}
                </div>
              );
            })}
          </div>

          <div style={{ fontSize: 14, color: '#999', marginTop: 6 }}>
            {isAdd
              ? `👆 점선 칸 ${addItems}개를 손가락으로 눌러봐!`
              : `👆 점선 칸 ${removeTarget}개를 눌러서 없애봐!`}
          </div>
        </div>

        {progress && (
          <div style={{
            background: 'linear-gradient(135deg, #84fab0, #8fd3f4)',
            borderRadius: 16, padding: 16, marginBottom: 16,
            fontSize: 20, fontWeight: 700, color: '#2c3e50',
            animation: 'fadeIn 0.3s ease',
          }}>
            🎉 정답은 <span style={{ color: '#e74c3c', fontSize: 28 }}>{problem.answer}</span> 이야!
          </div>
        )}

        <button
          onClick={onClose}
          style={{
            background: 'linear-gradient(135deg, #667eea, #764ba2)',
            color: 'white', border: 'none', borderRadius: 12,
            padding: '13px 36px', fontSize: 16, fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          다시 풀어볼게요! ✊
        </button>
      </div>
    </div>
  );
}

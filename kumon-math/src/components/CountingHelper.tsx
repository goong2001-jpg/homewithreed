import React, { useState, useEffect } from 'react';
import { Problem } from '../types';

interface Props {
  problem: Problem;
  onClose: () => void;
}

const EMOJIS = ['🍎', '🍊', '🍋', '🍇', '🍓', '🫐', '🍒', '🍑'];

export default function CountingHelper({ problem, onClose }: Props) {
  const emoji = EMOJIS[Math.floor(Math.random() * EMOJIS.length)];
  const [selectedCount, setSelectedCount] = useState(0);

  useEffect(() => {
    setSelectedCount(0);
  }, [problem]);

  const isAdd = problem.operation === 'add';
  const totalItems = isAdd ? problem.num1 + problem.num2 : problem.num1;
  const baseItems = isAdd ? problem.num1 : problem.num1;
  const addItems = isAdd ? problem.num2 : 0;
  const removeTarget = isAdd ? 0 : problem.num2;

  const handleClick = (idx: number) => {
    if (isAdd) {
      if (idx >= baseItems) {
        setSelectedCount(prev => {
          const clickedPos = idx - baseItems + 1;
          return prev === clickedPos ? prev - 1 : clickedPos;
        });
      }
    } else {
      if (idx >= totalItems - removeTarget) {
        const clickedFromEnd = totalItems - idx;
        setSelectedCount(prev => prev === clickedFromEnd ? prev - 1 : clickedFromEnd);
      }
    }
  };

  const progress = isAdd
    ? selectedCount === addItems
    : selectedCount === removeTarget;

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 100, padding: 20,
    }}>
      <div style={{
        background: 'white', borderRadius: 24, padding: 32,
        maxWidth: 500, width: '100%', textAlign: 'center',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
      }}>
        <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 8, color: '#e74c3c' }}>
          앗! 틀렸어요 😢
        </div>
        <div style={{ fontSize: 17, marginBottom: 20, color: '#555' }}>
          같이 {emoji}를 {isAdd ? '더해' : '빼'}볼까요?
        </div>

        <div style={{
          background: '#fff9f0', borderRadius: 16, padding: 20, marginBottom: 20,
          border: '2px dashed #ffcc80',
        }}>
          <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 16, color: '#e67e22' }}>
            {problem.num1} {isAdd ? '+' : '-'} {problem.num2} = ?
          </div>

          <div style={{
            display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center',
            marginBottom: 12,
          }}>
            {Array.from({ length: totalItems }).map((_, i) => {
              const isBase = i < (isAdd ? baseItems : totalItems - removeTarget);
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
                    fontSize: 28,
                    cursor: (isAddable || isRemovable) ? 'pointer' : 'default',
                    opacity: isRemovable && isSelected ? 0.3 : 1,
                    transform: isSelected ? 'scale(1.2)' : 'scale(1)',
                    transition: 'all 0.15s',
                    filter: isBase && !isRemovable ? 'none' : isSelected ? 'brightness(1.3)' : 'grayscale(30%)',
                    background: isAddable ? (isSelected ? '#c8f7c5' : '#f0fff0') : isRemovable ? (isSelected ? '#ffd6d6' : '#fff') : 'transparent',
                    borderRadius: 8,
                    padding: 2,
                    border: (isAddable || isRemovable) ? '2px dashed #aaa' : '2px solid transparent',
                  }}
                >
                  {emoji}
                </div>
              );
            })}
          </div>

          <div style={{ fontSize: 15, color: '#888', marginTop: 8 }}>
            {isAdd
              ? `👆 오른쪽 ${addItems}개를 눌러보세요!`
              : `👆 오른쪽 ${removeTarget}개를 눌러서 빼보세요!`}
          </div>
        </div>

        {progress && (
          <div style={{
            background: 'linear-gradient(135deg, #84fab0, #8fd3f4)',
            borderRadius: 16, padding: 16, marginBottom: 16,
            fontSize: 22, fontWeight: 700, color: '#2c3e50',
            animation: 'fadeIn 0.3s ease',
          }}>
            🎉 정답은 <span style={{ color: '#e74c3c', fontSize: 28 }}>{problem.answer}</span> 이에요!
          </div>
        )}

        <button
          onClick={onClose}
          style={{
            background: 'linear-gradient(135deg, #667eea, #764ba2)',
            color: 'white', border: 'none', borderRadius: 12,
            padding: '12px 32px', fontSize: 16, fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          다시 풀어볼게요! ✊
        </button>
      </div>
    </div>
  );
}

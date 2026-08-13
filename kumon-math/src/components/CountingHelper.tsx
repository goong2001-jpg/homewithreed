import React, { useState, useRef } from 'react';
import { Problem } from '../types';
import { playClick } from '../utils/sounds';

interface Props {
  problem: Problem;
  onClose: () => void;
}

const EMOJIS = ['🍎', '🍊', '🍋', '🍇', '🍓', '🫐', '🍒', '🍑'];

const OP_SYMBOL: Record<Problem['operation'], string> = {
  add: '+', subtract: '-', multiply: '×',
};

type Mode = 'simple' | 'tens' | 'groups';

function getMode(p: Problem): Mode {
  if (p.operation === 'multiply') return 'groups';
  const total = p.operation === 'add' ? p.num1 + p.num2 : p.num1;
  return total <= 20 ? 'simple' : 'tens';
}

/* ── 모드 1: 20 이하 낱개 세기 (기존 방식) ── */
function SimpleCounting({ problem, emoji, onSolved }: { problem: Problem; emoji: string; onSolved: (ok: boolean) => void }) {
  const [selectedCount, setSelectedCount] = useState(0);
  const isAdd = problem.operation === 'add';
  const totalItems = isAdd ? problem.num1 + problem.num2 : problem.num1;
  const baseItems = problem.num1;
  const addItems = isAdd ? problem.num2 : 0;
  const removeTarget = isAdd ? 0 : problem.num2;

  const report = (count: number) => onSolved(isAdd ? count === addItems : count === removeTarget);

  const handleClick = (idx: number) => {
    if (isAdd) {
      if (idx >= baseItems) {
        const clickedPos = idx - baseItems + 1;
        const next = selectedCount === clickedPos ? clickedPos - 1 : clickedPos;
        setSelectedCount(next);
        report(next);
        playClick();
      }
    } else {
      if (idx >= totalItems - removeTarget) {
        const clickedFromEnd = totalItems - idx;
        const next = selectedCount === clickedFromEnd ? clickedFromEnd - 1 : clickedFromEnd;
        setSelectedCount(next);
        report(next);
        playClick();
      }
    }
  };

  return (
    <>
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
    </>
  );
}

/* ── 모드 2: 두자리 수 — 10묶음 + 낱개로 세기 ── */
function TensCounting({ problem, emoji, onSolved }: { problem: Problem; emoji: string; onSolved: (ok: boolean) => void }) {
  const isAdd = problem.operation === 'add';

  // 요소 구성: strip(10짜리 묶음) / dot(낱개 1)
  interface El { value: 10 | 1; owner: 1 | 2; }
  let els: El[] = [];

  if (isAdd) {
    const t1 = Math.floor(problem.num1 / 10), o1 = problem.num1 % 10;
    const t2 = Math.floor(problem.num2 / 10), o2 = problem.num2 % 10;
    els = [
      ...Array.from({ length: t1 }, (): El => ({ value: 10, owner: 1 })),
      ...Array.from({ length: o1 }, (): El => ({ value: 1, owner: 1 })),
      ...Array.from({ length: t2 }, (): El => ({ value: 10, owner: 2 })),
      ...Array.from({ length: o2 }, (): El => ({ value: 1, owner: 2 })),
    ];
  } else {
    // 받아내림 필요하면 10묶음 하나를 낱개 10개로 미리 바꿔서 보여줌
    const o1 = problem.num1 % 10, o2 = problem.num2 % 10;
    const borrow = o1 < o2;
    const strips = Math.floor(problem.num1 / 10) - (borrow ? 1 : 0);
    const dots = o1 + (borrow ? 10 : 0);
    els = [
      ...Array.from({ length: strips }, (): El => ({ value: 10, owner: 1 })),
      ...Array.from({ length: dots }, (): El => ({ value: 1, owner: 1 })),
    ];
  }

  const [sel, setSel] = useState<boolean[]>(() => els.map(() => false));
  const count = els.reduce((sum, el, i) => sum + (sel[i] ? el.value : 0), 0);

  const toggle = (i: number) => {
    const next = [...sel];
    next[i] = !next[i];
    setSel(next);
    playClick();
    const newCount = els.reduce((sum, el, j) => sum + (next[j] ? el.value : 0), 0);
    onSolved(isAdd ? next.every(Boolean) : newCount === problem.num2);
  };

  const t2 = Math.floor(problem.num2 / 10), o2 = problem.num2 % 10;
  const complete = isAdd ? sel.every(Boolean) : count === problem.num2;

  return (
    <>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center', marginBottom: 10 }}>
        {els.map((el, i) => el.value === 10 ? (
          <div
            key={i}
            onClick={() => toggle(i)}
            style={{
              width: 52, height: 30, borderRadius: 8,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14, fontWeight: 800, color: 'white',
              background: sel[i]
                ? (isAdd ? '#27ae60' : '#bbb')
                : (el.owner === 1 ? 'linear-gradient(135deg,#5da8ff,#3f7fd6)' : 'linear-gradient(135deg,#67d98b,#3cb46a)'),
              opacity: !isAdd && sel[i] ? 0.35 : 1,
              textDecoration: !isAdd && sel[i] ? 'line-through' : 'none',
              cursor: 'pointer',
              boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
              transform: sel[i] ? 'scale(1.08)' : 'scale(1)',
              transition: 'all 0.15s',
            }}
          >
            10
          </div>
        ) : (
          <div
            key={i}
            onClick={() => toggle(i)}
            style={{
              fontSize: 24,
              cursor: 'pointer',
              opacity: !isAdd && sel[i] ? 0.25 : 1,
              transform: sel[i] ? 'scale(1.2)' : 'scale(1)',
              transition: 'all 0.15s',
              background: sel[i] ? (isAdd ? '#c8f7c5' : '#ffd6d6') : (el.owner === 2 ? '#f0fff0' : 'transparent'),
              borderRadius: 8, padding: 2,
            }}
          >
            {emoji}
          </div>
        ))}
      </div>

      {/* 세는 중에만 도와주는 숫자 — 다 세고 나면 감춰서 직접 답을 떠올리게 한다 */}
      {!complete && (
        <div style={{ fontSize: 17, fontWeight: 800, color: '#e67e22', margin: '8px 0 4px' }}>
          {isAdd ? `지금까지 센 수: ${count}` : `뺀 수: ${count}`}
        </div>
      )}
      <div style={{ fontSize: 14, color: '#999' }}>
        {isAdd
          ? '👆 파란 묶음은 10씩! 전부 눌러서 세어보자!'
          : `👆 10묶음 ${t2}개와 낱개 ${o2}개를 눌러서 빼보자! 남은 걸 세어봐!`}
      </div>
    </>
  );
}

/* ── 모드 3: 구구단 — 묶음으로 뛰어세기 ── */
function GroupsCounting({ problem, emoji, onSolved }: { problem: Problem; emoji: string; onSolved: (ok: boolean) => void }) {
  const per = problem.num1;     // N씩
  const groups = problem.num2;  // M묶음
  const [tapped, setTapped] = useState(0);

  const handleClick = (idx: number) => {
    const pos = idx + 1;
    const next = tapped === pos ? pos - 1 : pos;
    setTapped(next);
    playClick();
    onSolved(next === groups);
  };

  return (
    <>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginBottom: 10 }}>
        {Array.from({ length: groups }).map((_, g) => {
          const isTapped = g < tapped;
          return (
            <div
              key={g}
              onClick={() => handleClick(g)}
              style={{
                border: isTapped ? '3px solid #27ae60' : '2px dashed #aaa',
                background: isTapped ? '#eafff0' : '#fffdf5',
                borderRadius: 12, padding: '6px 8px',
                cursor: 'pointer',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                transform: isTapped ? 'scale(1.06)' : 'scale(1)',
                transition: 'all 0.15s',
                minWidth: 40,
              }}
            >
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 1, justifyContent: 'center', maxWidth: 64 }}>
                {Array.from({ length: per }).map((_, i) => (
                  <span key={i} style={{ fontSize: 14 }}>{emoji}</span>
                ))}
              </div>
              <div style={{ fontSize: 14, fontWeight: 800, color: isTapped ? '#27ae60' : '#ccc' }}>
                {isTapped ? per * (g + 1) : '?'}
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ fontSize: 17, fontWeight: 800, color: '#e67e22', margin: '8px 0 4px' }}>
        {tapped === 0
          ? `${per}씩 뛰어 세어보자!`
          : tapped < groups
          ? `${per}씩 ${tapped}묶음까지 셌어!`
          : '다 셌어! 마지막 숫자가 몇이었지? 🤔'}
      </div>
      <div style={{ fontSize: 14, color: '#999' }}>
        👆 묶음을 차례로 눌러봐! {per}, {per * 2}, {per * 3}...
      </div>
    </>
  );
}

/* ── 메인 컴포넌트 ── */
export default function CountingHelper({ problem, onClose }: Props) {
  const emojiRef = useRef(EMOJIS[Math.floor(Math.random() * EMOJIS.length)]);
  const emoji = emojiRef.current;
  const [solved, setSolved] = useState(false);
  const mode = getMode(problem);

  const introText =
    mode === 'groups' ? `${emoji}을 묶음으로 세어볼까?` :
    mode === 'tens' ? '10씩 묶어서 세어볼까?' :
    `${emoji}을 직접 ${problem.operation === 'add' ? '눌러서 더해' : '눌러서 빼'}볼까?`;

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
        maxHeight: '90vh', overflowY: 'auto',
      }}>
        <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 6, color: '#e74c3c' }}>
          괜찮아, 같이 해보자! 😊
        </div>
        <div style={{ fontSize: 16, marginBottom: 18, color: '#666' }}>
          {introText}
        </div>

        <div style={{
          background: '#fff9f0', borderRadius: 16, padding: '18px 14px', marginBottom: 18,
          border: '2px dashed #ffcc80',
        }}>
          <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 14, color: '#e67e22' }}>
            {problem.num1} {OP_SYMBOL[problem.operation]} {problem.num2} = ?
          </div>

          {mode === 'simple' && <SimpleCounting problem={problem} emoji={emoji} onSolved={setSolved} />}
          {mode === 'tens' && <TensCounting problem={problem} emoji={emoji} onSolved={setSolved} />}
          {mode === 'groups' && <GroupsCounting problem={problem} emoji={emoji} onSolved={setSolved} />}
        </div>

        {/* 정답을 알려주지 않는다 — 세어본 걸 떠올려 직접 답을 쓰게 한다 */}
        {solved && (
          <div style={{
            background: 'linear-gradient(135deg, #84fab0, #8fd3f4)',
            borderRadius: 16, padding: 16, marginBottom: 16,
            fontSize: 18, fontWeight: 800, color: '#1e5c40',
            animation: 'fadeIn 0.3s ease', lineHeight: 1.5,
          }}>
            잘 셌어! 👏<br />
            <span style={{ fontSize: 15, fontWeight: 700 }}>
              몇 개인지 알겠지? 이제 직접 답을 써보자! ✏️
            </span>
          </div>
        )}

        <button
          onClick={onClose}
          style={{
            background: solved
              ? 'linear-gradient(135deg, #27ae60, #2ecc71)'
              : 'linear-gradient(135deg, #667eea, #764ba2)',
            color: 'white', border: 'none', borderRadius: 12,
            padding: '13px 36px', fontSize: 16, fontWeight: 700,
            cursor: 'pointer', transition: 'background 0.3s',
          }}
        >
          {solved ? '알겠어! 답 쓰러 갈래 ✏️' : '이 문제 다시 풀어볼래 ✊'}
        </button>
      </div>
    </div>
  );
}

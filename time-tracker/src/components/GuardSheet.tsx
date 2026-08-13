import React, { useEffect, useState } from 'react';
import { Category, GoalKind } from '../types';
import { categoryMeta, scriptLines } from '../utils/block';
import { durationText } from '../utils/time';
import { COLOR, ghostButton, primaryButton } from './ui';

interface Props {
  category: Category;
  allCategories: Category[];
  /** 오늘 이 분류로 쓴 시간(분) */
  todayMinutes: number;
  /** 이번 주 이 분류로 쓴 시간(분) */
  weekMinutes: number;
  /** 이번 주에 참은 횟수 */
  resistCount: number;
  onClose: () => void;
  onResist: () => void;
  onSwap: (categoryId: string) => void;
  onProceed: () => void;
  onEditScript: () => void;
}

/** 충동과 행동 사이에 억지로 벌려두는 간극(초) */
const DELAY_SECONDS = 3;

const STEPS: { key: 'away' | 'swap' | 'dislike'; emoji: string; title: string; hint: string }[] = [
  { key: 'away', emoji: '🚧', title: '멀리하기', hint: '손이 안 닿게 만들어 둔 것' },
  { key: 'swap', emoji: '🔄', title: '대체하기', hint: '대신 하기로 한 것' },
  { key: 'dislike', emoji: '🙅', title: '싫어하기', hint: '매력을 떨어뜨리는 방법' },
];

/**
 * 줄이려는 분류를 시작하려 할 때 한 번 붙잡는 시트.
 *
 * ★ 막으려는 게 아니라 **간극을 벌리려는** 화면이다.
 *   충동에서 행동까지 3초와 한 번의 확인이 끼면, 그 사이에 미리 적어둔 대본을 읽게 된다.
 *   그래도 하겠다면 하면 된다 — 대신 그건 충동이 아니라 결정이다.
 */
export default function GuardSheet({
  category, allCategories, todayMinutes, weekMinutes, resistCount,
  onClose, onResist, onSwap, onProceed, onEditScript,
}: Props) {
  const [left, setLeft] = useState(DELAY_SECONDS);

  useEffect(() => {
    if (left <= 0) return;
    const id = setTimeout(() => setLeft(n => n - 1), 1000);
    return () => clearTimeout(id);
  }, [left]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const goal = category.weeklyGoalMinutes;
  const kind: GoalKind = category.goalKind;
  const remaining = goal != null && kind === '이하' ? goal - weekMinutes : null;
  const swapTo = category.swapCategoryId
    ? allCategories.find(c => c.id === category.swapCategoryId && !c.deleted) ?? null
    : null;

  const filled = STEPS
    .map(s => ({ ...s, lines: scriptLines(category[s.key]) }))
    .filter(s => s.lines.length > 0);

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
          maxHeight: '92vh', overflowY: 'auto',
          paddingBottom: 'calc(16px + env(safe-area-inset-bottom))',
          animation: 'sheet-up 0.22s ease-out',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0 4px' }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: '#dfe4e8' }} />
        </div>

        <div style={{ padding: '6px 16px 0' }}>
          <strong style={{ fontSize: 18 }}>
            {category.emoji} {category.name}, 지금 시작할까요?
          </strong>

          <p style={{ margin: '10px 0 0', fontSize: 13, color: COLOR.sub, lineHeight: 1.7 }}>
            오늘 이미 <strong style={{ color: COLOR.text }}>{durationText(todayMinutes)}</strong>
            {' · '}이번 주 <strong style={{ color: COLOR.text }}>{durationText(weekMinutes)}</strong>
            {remaining != null && (
              remaining > 0
                ? <> · 목표까지 <strong style={{ color: COLOR.warn }}>{durationText(remaining)}</strong> 남음</>
                : <> · 이번 주 목표를 <strong style={{ color: COLOR.danger }}>{durationText(-remaining)}</strong> 넘겼어요</>
            )}
          </p>

          {resistCount > 0 && (
            <p style={{ margin: '6px 0 0', fontSize: 13, color: COLOR.good, lineHeight: 1.6 }}>
              이번 주에 <strong>{resistCount}번</strong> 참았어요. 한 번 더 쌓아볼까요?
            </p>
          )}
        </div>

        {/* ── 미리 적어둔 3단계 대본 ─────────────── */}
        <div style={{ padding: '14px 16px 0' }}>
          {filled.length === 0 ? (
            <div
              style={{
                padding: '14px', borderRadius: 10, background: '#f4f6fa',
                fontSize: 13, color: COLOR.sub, lineHeight: 1.7,
              }}
            >
              이 분류엔 아직 <strong>대본이 없어요.</strong><br />
              충동이 온 순간에 방법을 생각해내는 건 거의 항상 실패합니다.
              한가할 때 미리 적어두면 그 순간엔 읽기만 하면 돼요.
              <button
                onClick={onEditScript}
                style={{ ...ghostButton, marginTop: 12 }}
              >
                멀리하기 · 대체하기 · 싫어하기 적으러 가기
              </button>
            </div>
          ) : (
            filled.map(s => (
              <div
                key={s.key}
                style={{
                  padding: '11px 13px', borderRadius: 10, marginBottom: 8,
                  background: '#f4f6fa',
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 700, color: COLOR.sub, marginBottom: 6 }}>
                  {s.emoji} {s.title} <span style={{ fontWeight: 500, color: COLOR.faint }}>· {s.hint}</span>
                </div>
                {s.lines.map((line, i) => (
                  <div key={i} style={{ fontSize: 14, lineHeight: 1.65, color: COLOR.text }}>
                    · {line}
                  </div>
                ))}
              </div>
            ))
          )}
        </div>

        {/* ── 고르기 ─────────────────────────── */}
        <div style={{ padding: '10px 16px 0' }}>
          <button
            onClick={onResist}
            style={{ ...primaryButton, background: COLOR.good }}
          >
            참을게요
          </button>

          {swapTo && (
            <button
              onClick={() => onSwap(swapTo.id)}
              style={{ ...ghostButton, marginTop: 8 }}
            >
              대신 {swapTo.emoji} {categoryMeta(allCategories, swapTo.id).name} 시작하기
            </button>
          )}

          <button
            onClick={onProceed}
            disabled={left > 0}
            style={{
              width: '100%', marginTop: 8, padding: '13px 16px',
              borderRadius: 10, border: 'none', background: 'none',
              color: left > 0 ? COLOR.faint : COLOR.sub,
              fontSize: 15, fontWeight: 600, font: 'inherit',
              cursor: left > 0 ? 'not-allowed' : 'pointer',
            }}
          >
            {left > 0 ? `그래도 할래요 (${left}초)` : '그래도 할래요'}
          </button>

          <p style={{ margin: '2px 0 0', fontSize: 11.5, color: COLOR.faint, textAlign: 'center', lineHeight: 1.6 }}>
            {left > 0
              ? '3초만 생각해볼까요. 충동은 대체로 그 사이에 지나갑니다.'
              : '결정했다면 하세요. 충동으로 한 게 아니라면 그걸로 충분합니다.'}
          </p>
        </div>
      </div>
    </div>
  );
}

import React from 'react';
import { BlockReport, BlockState, Category } from '../types';
import { blocksLeft, categoryMeta, missedBlocks } from '../utils/block';
import { topic } from '../utils/text';
import { clockOfMinutes, durationText } from '../utils/time';
import { COLOR, sectionTitle } from './ui';

interface Props {
  reports: BlockReport[];
  categories: Category[];
  /** 오늘이 아닌 날을 보고 있으면 회복 문구를 띄우지 않는다 */
  isToday: boolean;
  onPick: (blockId: string) => void;
}

const MARK: Record<BlockState, string> = {
  kept: '✓',
  missed: '✕',
  now: '●',
  upcoming: '',
  unplanned: '·',
};

function colorOf(state: BlockState): { fg: string; bg: string; border: string } {
  switch (state) {
    case 'kept': return { fg: '#1e7e45', bg: '#e8f6ee', border: '#bde5cd' };
    case 'missed': return { fg: '#b9770e', bg: '#fdf3e3', border: '#f0dcb4' };
    case 'now': return { fg: '#fff', bg: COLOR.accent, border: COLOR.accent };
    case 'unplanned': return { fg: COLOR.faint, bg: '#f4f6f8', border: COLOR.line };
    default: return { fg: COLOR.faint, bg: '#fff', border: COLOR.line };
  }
}

/**
 * 하루를 여섯 조각으로 끊어 보여주는 띠.
 *
 * ★ 이 화면이 존재하는 이유는 성적표가 아니라 **회복 지점**이다.
 *   오후에 한 번 무너져도 저녁·밤이 남아 있다는 게 눈에 보여야
 *   '오늘은 망했으니 내일부터'로 안 간다.
 */
export default function BlockStrip({ reports, categories, isToday, onPick }: Props) {
  if (reports.length === 0) return null;

  const missed = missedBlocks(reports);
  const left = blocksLeft(reports);
  const current = reports.find(r => r.state === 'now');

  return (
    <>
      <div style={sectionTitle}>타임블록 · 눌러서 계획 세우기</div>

      <div style={{ display: 'flex', gap: 5, padding: '0 16px' }}>
        {reports.map(r => {
          const c = colorOf(r.state);
          const planned = categoryMeta(categories, r.plannedCategoryId);
          return (
            <button
              key={r.blockId}
              onClick={() => onPick(r.blockId)}
              style={{
                flex: 1, minWidth: 0, padding: '8px 2px 7px',
                borderRadius: 10, border: `1px solid ${c.border}`,
                background: c.bg, color: c.fg,
                cursor: 'pointer', font: 'inherit',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
              }}
            >
              <span style={{ fontSize: 15, lineHeight: 1 }}>{r.emoji}</span>
              <span style={{ fontSize: 11, fontWeight: r.state === 'now' ? 800 : 600 }}>{r.name}</span>
              <span
                style={{
                  fontSize: 10, lineHeight: 1.3, height: 13,
                  opacity: r.state === 'now' ? 0.9 : 0.75,
                  overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '100%',
                }}
              >
                {MARK[r.state]}{r.plannedCategoryId ? planned.emoji : ''}
              </span>
            </button>
          );
        })}
      </div>

      {/* 지금 블록의 한 줄 요약 */}
      {isToday && current && (
        <div
          style={{
            margin: '8px 16px 0', padding: '10px 12px', borderRadius: 10,
            background: '#fff', border: `1px solid ${COLOR.line}`,
            fontSize: 13, color: COLOR.sub, lineHeight: 1.6,
          }}
        >
          지금은 <strong style={{ color: COLOR.accent }}>{current.emoji} {current.name}</strong>
          {' '}블록 ({clockOfMinutes(current.startMinutes)}–{clockOfMinutes(current.endMinutes % 1440)})
          {current.plannedCategoryId ? (
            <>
              {' · '}계획은 <strong style={{ color: COLOR.text }}>
                {categoryMeta(categories, current.plannedCategoryId).name}
              </strong>
              {current.plannedMinutes > 0 && <> · 지금까지 {durationText(current.plannedMinutes)}</>}
            </>
          ) : (
            <>{' · '}<span style={{ color: COLOR.faint }}>아직 계획 없음</span></>
          )}
          {current.planMemo && (
            <div style={{ marginTop: 4, color: COLOR.text, fontSize: 13 }}>“{current.planMemo}”</div>
          )}
        </div>
      )}

      {/* ★ 자포자기 방지 — 놓친 블록이 있어도 남은 블록을 세어준다 */}
      {isToday && missed.length > 0 && left.length > 0 && (
        <div
          style={{
            margin: '8px 16px 0', padding: '11px 13px', borderRadius: 10,
            background: '#f3f2fe', border: `1px solid #ddd9fb`,
            fontSize: 13, color: '#4b3fbb', lineHeight: 1.65,
          }}
        >
          <strong>{missed.map(b => b.name).join('·')}</strong>{topic(missed[missed.length - 1].name)} 놓쳤지만,
          아직 <strong>{left.map(b => b.name).join('·')}</strong> {left.length}블록이 남았어요.
          <br />오늘 하루가 망한 게 아니라 <strong>조각 {missed.length}개</strong>가 어긋났을 뿐입니다.
        </div>
      )}
    </>
  );
}

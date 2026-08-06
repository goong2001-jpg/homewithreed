import React from 'react';
import { MonthBudget, MonthKey, SyncStatus } from '../types';
import { LEVEL_COLOR, LEVEL_LABEL } from '../utils/budget';
import { shortWon, signedWon, won } from '../utils/format';
import MonthHeader from './MonthHeader';
import PiggyGauge from './PiggyGauge';
import StatRow from './StatRow';
import PersonBars from './PersonBars';

interface Props {
  month: MonthKey;
  budget: MonthBudget;
  fixedCount: number;
  syncStatus: SyncStatus;
  /** 지난달 수입 합계 (0이면 복사할 게 없다) */
  prevMonthIncome: number;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onGoSettings: () => void;
  onGoAdd: () => void;
  onCopyPrevIncome: () => void;
  onSelectPerson: (personId: string) => void;
}

export default function HomeView({
  month, budget, fixedCount, syncStatus, prevMonthIncome,
  onPrev, onNext, onToday, onGoSettings, onGoAdd, onCopyPrevIncome, onSelectPerson,
}: Props) {
  const color = LEVEL_COLOR[budget.level];
  const future = budget.phase === 'future';

  return (
    <>
      <MonthHeader
        month={month}
        phase={budget.phase}
        onPrev={onPrev}
        onNext={onNext}
        onToday={onToday}
        syncStatus={syncStatus}
        onSyncClick={onGoSettings}
      />

      {budget.fixedOverIncome && (
        <div style={{
          margin: '12px 16px 0', background: '#fef9e7', border: '1px solid #f7dc6f',
          borderRadius: 10, padding: '12px 14px', fontSize: 13, color: '#9a7d0a', lineHeight: 1.6,
        }}>
          ⚠️ 고정지출이 수입보다 <b>{shortWon(Math.abs(budget.spendable))}</b> 많아요.
          하루 쓸 수 있는 돈이 마이너스입니다.
        </div>
      )}

      {!budget.hasIncome ? (
        <div style={{
          background: '#fff', margin: '16px', borderRadius: 12, padding: '36px 24px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)', textAlign: 'center',
        }}>
          <div style={{ fontSize: 52, marginBottom: 14 }}>🐷</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#2c3e50', marginBottom: 8 }}>
            이 달 수입을 먼저 입력해주세요
          </div>
          <div style={{ fontSize: 13, color: '#8a959b', lineHeight: 1.7, marginBottom: 20 }}>
            월 수입을 넣으면 {budget.daysInMonth}일로 나눠서
            <br />하루에 얼마 쓸 수 있는지 알려드려요.
          </div>

          {/* 급여는 보통 매달 같으니, 달이 바뀌면 한 번 눌러 그대로 가져올 수 있게 한다 */}
          {prevMonthIncome > 0 && (
            <button
              onClick={onCopyPrevIncome}
              style={{
                width: '100%', padding: 14, background: '#27ae60', color: '#fff', border: 'none',
                borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: 'pointer', marginBottom: 9,
              }}
            >
              지난달과 같이 ({shortWon(prevMonthIncome)})
            </button>
          )}

          <button
            onClick={onGoSettings}
            style={{
              width: '100%', padding: 14,
              background: prevMonthIncome > 0 ? '#f5f7f8' : '#27ae60',
              color: prevMonthIncome > 0 ? '#607d8b' : '#fff',
              border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: 'pointer',
            }}
          >
            {prevMonthIncome > 0 ? '직접 입력하기' : '수입 입력하러 가기'}
          </button>
        </div>
      ) : (
        <>
          {/* 저금통 + 가운데 여유돈 오버레이.
              오버레이를 SVG와 같은 상자에 넣어야 위치가 정확히 맞는다.
              반투명 알약 배경을 깔면 채움 색이 무엇이든 글자가 읽힌다. */}
          <div style={{ padding: '16px 16px 2px' }}>
            <div style={{ position: 'relative', width: '100%', maxWidth: 290, margin: '0 auto' }}>
              <PiggyGauge budget={budget} />

              <div style={{
                position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', pointerEvents: 'none',
              }}>
                <div style={{
                  // 저금통이 비어 회색일 때도 흰 글자가 읽히도록 충분히 진하게
                  background: 'rgba(38,50,56,0.6)',
                  backdropFilter: 'blur(2px)',
                  WebkitBackdropFilter: 'blur(2px)',
                  borderRadius: 14,
                  padding: '8px 16px 9px',
                  textAlign: 'center',
                  maxWidth: '80%',
                }}>
                  <div style={{
                    fontSize: 10, color: 'rgba(255,255,255,0.9)', fontWeight: 700,
                    letterSpacing: 0.2, marginBottom: 1,
                  }}>
                    {future ? '이 달 예상 여유돈' : '지금 여유돈'}
                  </div>
                  <div style={{
                    fontSize: 24, fontWeight: 800, color: '#fff', lineHeight: 1.15,
                    whiteSpace: 'nowrap',
                  }}>
                    {future ? won(budget.spendable) : signedWon(budget.freeCash)}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 상태 라벨 */}
          <div style={{ textAlign: 'center', marginBottom: 4 }}>
            <span style={{
              fontSize: 13, fontWeight: 700, color, background: `${color}18`,
              borderRadius: 20, padding: '5px 14px',
            }}>
              {future ? '📅 아직 오지 않은 달이에요' : LEVEL_LABEL[budget.level]}
            </span>
          </div>

          {/* 하루 수입 — 이 앱의 주인공 숫자 */}
          <div style={{
            background: '#fff', margin: '14px 16px 12px', borderRadius: 12, padding: '18px 16px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.06)', textAlign: 'center',
          }}>
            <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>하루 쓸 수 있는 돈</div>
            <div style={{ fontSize: 34, fontWeight: 800, color: '#2c3e50', lineHeight: 1.15 }}>
              {won(Math.floor(budget.dailyBudget))}
            </div>
            <div style={{ fontSize: 11.5, color: '#aaa', marginTop: 7, lineHeight: 1.6 }}>
              수입 {shortWon(budget.totalIncome)}
              {budget.totalFixed > 0 && <> − 고정지출 {shortWon(budget.totalFixed)}</>}
              {' '}÷ {budget.daysInMonth}일
            </div>
          </div>

          <StatRow budget={budget} />
          <PersonBars budget={budget} onSelectPerson={onSelectPerson} />

          <button
            onClick={onGoSettings}
            style={{
              width: 'calc(100% - 32px)', margin: '0 16px 8px',
              background: '#fff', border: 'none', borderRadius: 12, padding: '14px 16px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.06)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              fontSize: 13, color: '#555',
            }}
          >
            <span>
              고정지출 {fixedCount}건
              {budget.totalFixed > 0 && (
                <span style={{ color: '#aaa' }}> · {won(budget.totalFixed)} (이미 차감됨)</span>
              )}
            </span>
            <span style={{ color: '#bbb' }}>›</span>
          </button>

          {budget.phase === 'current' && (
            <button
              onClick={onGoAdd}
              style={{
                display: 'block', width: 'calc(100% - 32px)', margin: '4px 16px 16px',
                padding: 15, background: '#27ae60', color: '#fff', border: 'none',
                borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: 'pointer',
              }}
            >
              오늘 쓴 돈 입력하기
            </button>
          )}
        </>
      )}
    </>
  );
}

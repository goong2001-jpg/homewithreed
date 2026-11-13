import React from 'react';
import {
  BudgetStatusRow, DateKey, MonthBudget, MonthKey, RecurringCandidate, SyncStatus,
} from '../types';
import { LEVEL_COLOR, LEVEL_LABEL } from '../utils/budget';
import { shortWon, signedWon, won } from '../utils/format';
import { WeeklyReport } from '../utils/weekly';
import MonthHeader from './MonthHeader';
import PiggyGauge from './PiggyGauge';
import StatRow from './StatRow';
import PersonBars from './PersonBars';
import BudgetLimits from './BudgetLimits';
import WeeklyReportCard from './WeeklyReportCard';
import MissingDaysCard from './MissingDaysCard';
import RecurringCard from './RecurringCard';

interface Props {
  month: MonthKey;
  budget: MonthBudget;
  fixedCount: number;
  syncStatus: SyncStatus;
  /** 지난달 수입 합계 (0이면 복사할 게 없다) */
  prevMonthIncome: number;
  /** 상한을 정한 카테고리의 사용 현황 (없으면 빈 배열 = 아무것도 안 그린다) */
  budgetRows: BudgetStatusRow[];
  /** 일·월요일에만 들어온다 — 그 외엔 null */
  weeklyReport: WeeklyReport | null;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onGoSettings: () => void;
  onGoAdd: () => void;
  /** 들어온 돈 입력 — 부업 일당처럼 수시로 들어오는 수입을 여기서 바로 더한다 */
  onGoAddIncome: () => void;
  onCopyPrevIncome: () => void;
  onSelectPerson: (personId: string) => void;
  /** 어제부터 거꾸로 연달아 기록이 없는 날 */
  missingDays: DateKey[];
  onFillMissing: (date: DateKey) => void;
  onMarkNoSpend: () => void;
  /** 고정지출로 옮기자고 권할 반복 지출 */
  recurring: RecurringCandidate[];
  onMoveRecurring: (item: RecurringCandidate) => void;
  onDismissRecurring: (key: string) => void;
}

export default function HomeView({
  month, budget, fixedCount, syncStatus, prevMonthIncome, budgetRows, weeklyReport,
  onPrev, onNext, onToday, onGoSettings, onGoAdd, onGoAddIncome,
  onCopyPrevIncome, onSelectPerson,
  missingDays, onFillMissing, onMarkNoSpend, recurring, onMoveRecurring, onDismissRecurring,
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
          borderRadius: 14, padding: '12px 14px', fontSize: 13, color: '#9a7d0a', lineHeight: 1.6,
        }}>
          ⚠️ 고정지출이 수입보다 <b>{shortWon(Math.abs(budget.spendable))}</b> 많아요.
          하루 쓸 수 있는 돈이 마이너스입니다.
        </div>
      )}

      {!budget.hasIncome ? (
        <div style={{
          background: '#fff', margin: '16px', borderRadius: 20, padding: '36px 24px',
          boxShadow: 'none', textAlign: 'center',
        }}>
          <div style={{ fontSize: 52, marginBottom: 14 }}>🐷</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#191F28', marginBottom: 8 }}>
            이 달 수입을 먼저 입력해주세요
          </div>
          <div style={{ fontSize: 13, color: '#8B95A1', lineHeight: 1.7, marginBottom: 20 }}>
            월 수입을 넣으면 {budget.daysInMonth}일로 나눠서
            <br />하루에 얼마 쓸 수 있는지 알려드려요.
          </div>

          {/* 급여는 보통 매달 같으니, 달이 바뀌면 한 번 눌러 그대로 가져올 수 있게 한다 */}
          {prevMonthIncome > 0 && (
            <button
              onClick={onCopyPrevIncome}
              style={{
                width: '100%', padding: 14, background: '#12B76A', color: '#fff', border: 'none',
                borderRadius: 14, fontSize: 15, fontWeight: 700, cursor: 'pointer', marginBottom: 9,
              }}
            >
              지난달과 같이 ({shortWon(prevMonthIncome)})
            </button>
          )}

          <button
            onClick={onGoAddIncome}
            style={{
              width: '100%', padding: 14,
              background: prevMonthIncome > 0 ? '#F2F4F6' : '#12B76A',
              color: prevMonthIncome > 0 ? '#6B7684' : '#fff',
              border: 'none', borderRadius: 14, fontSize: 15, fontWeight: 700, cursor: 'pointer',
            }}
          >
            {prevMonthIncome > 0 ? '직접 입력하기' : '수입 입력하러 가기'}
          </button>
        </div>
      ) : (
        <>
          {/* 맨 위 흰 면 — 여유돈 숫자가 주인공이고, 저금통은 오른쪽 위에서 같은 내용을 그림으로 보여준다 */}
          <div style={{
            background: '#fff', padding: '14px 20px 22px', borderRadius: '0 0 24px 24px',
            position: 'relative', marginBottom: 10,
          }}>
            <div style={{ position: 'absolute', right: 12, top: 2, width: 122 }}>
              <PiggyGauge budget={budget} />
            </div>

            <div style={{ fontSize: 14, color: '#4E5968', fontWeight: 500 }}>
              {future ? '이 달 예상 여유돈' : '지금 여유돈'}
            </div>
            <div style={{
              fontSize: 34, fontWeight: 800, letterSpacing: -1.2, lineHeight: 1.25, marginTop: 2,
              color: budget.level === '초과' ? '#F04452' : '#191F28', whiteSpace: 'nowrap',
              maxWidth: 'calc(100% - 118px)',
            }}>
              {future ? won(budget.spendable) : signedWon(budget.freeCash)}
            </div>

            {/* 하루 수입 — 이 앱의 주인공 숫자 */}
            <div style={{ fontSize: 14, color: '#4E5968', marginTop: 6 }}>
              하루 <b style={{ color: '#0E9F5B', fontWeight: 700 }}>{won(Math.floor(budget.dailyBudget))}</b>씩 쓸 수 있어요
            </div>
            <div style={{ fontSize: 11.5, color: '#B0B8C1', marginTop: 3 }}>
              수입 {shortWon(budget.totalIncome)}
              {budget.totalFixed > 0 && <> − 고정지출 {shortWon(budget.totalFixed)}</>}
              {' '}÷ {budget.daysInMonth}일
            </div>

            {/* 이번 달 예산 막대 — 저금통 물높이와 같은 숫자다. 검은 선 = 오늘까지 목표 */}
            <div style={{ marginTop: 18 }}>
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
                fontSize: 12.5, color: '#8B95A1', fontWeight: 500,
              }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: color }} />
                  <span style={{ color, fontWeight: 700 }}>
                    {future ? '아직 오지 않은 달이에요' : LEVEL_LABEL[budget.level]}
                  </span>
                </span>
                <b style={{ color: '#191F28', fontWeight: 700 }}>
                  이번 달 예산 {Math.round(budget.fillRatio * 100)}% 남음
                </b>
              </div>
              <div style={{
                position: 'relative', height: 8, borderRadius: 4, background: '#F2F4F6', marginTop: 8,
              }}>
                <div style={{
                  position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 4, background: color,
                  width: `${Math.round(budget.fillRatio * 100)}%`, transition: 'width 500ms ease',
                }} />
                {budget.phase === 'current' && (
                  <div style={{
                    position: 'absolute', top: -4, bottom: -4, width: 2, borderRadius: 1,
                    background: '#191F28', left: `calc(${Math.round(budget.paceRatio * 100)}% - 1px)`,
                  }} />
                )}
              </div>
              {budget.phase === 'current' && (
                <div style={{ fontSize: 11.5, color: '#8B95A1', marginTop: 8 }}>
                  검은 선이 오늘까지 목표예요 ·{' '}
                  {budget.fillRatio >= budget.paceRatio ? '목표보다 넉넉해요' : '목표보다 빨리 쓰고 있어요'}
                </div>
              )}
            </div>

            {budget.phase === 'current' && (
              <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
                <button
                  onClick={onGoAdd}
                  style={{
                    flex: 1, height: 54, background: '#12B76A', color: '#fff', border: 'none',
                    borderRadius: 14, fontSize: 16, fontWeight: 700, cursor: 'pointer',
                  }}
                >
                  오늘 쓴 돈 입력
                </button>
                {/* 부업 일당처럼 수시로 들어오는 돈도 한 번에 닿을 수 있어야 한다 */}
                <button
                  onClick={onGoAddIncome}
                  style={{
                    flex: '0 0 96px', height: 54, background: '#F2F4F6', color: '#4E5968',
                    border: 'none', borderRadius: 14, fontSize: 15, fontWeight: 700, cursor: 'pointer',
                  }}
                >
                  + 수입
                </button>
              </div>
            )}
          </div>

          {/* 입력이 빠진 날 — 이번 달을 볼 때만 */}
          {budget.phase === 'current' && (
            <MissingDaysCard days={missingDays} onFill={onFillMissing} onMarkNoSpend={onMarkNoSpend} />
          )}

          <StatRow budget={budget} />
          <PersonBars budget={budget} onSelectPerson={onSelectPerson} />
          <BudgetLimits rows={budgetRows} onGoSettings={onGoSettings} />

          {/* 일요일·월요일에만 — 주말을 넘기는 동안 한 주를 돌아본다 */}
          {weeklyReport && budget.phase === 'current' && (
            <WeeklyReportCard report={weeklyReport} style={{ margin: '0 12px 10px' }} />
          )}

          {budget.phase === 'current' && (
            <RecurringCard items={recurring} onMove={onMoveRecurring} onDismiss={onDismissRecurring} />
          )}

          <button
            onClick={onGoSettings}
            style={{
              width: 'calc(100% - 24px)', margin: '0 12px 16px',
              background: '#fff', border: 'none', borderRadius: 20, padding: '14px 16px',
              boxShadow: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              fontSize: 13, color: '#4E5968',
            }}
          >
            <span>
              고정지출 {fixedCount}건
              {budget.totalFixed > 0 && (
                <span style={{ color: '#B0B8C1' }}> · {won(budget.totalFixed)} (이미 차감됨)</span>
              )}
            </span>
            <span style={{ color: '#B0B8C1' }}>›</span>
          </button>

        </>
      )}
    </>
  );
}

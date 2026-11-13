import React, { useState } from 'react';
import { CATEGORY_COLOR, CATEGORY_EMOJI } from '../types';
import { won } from '../utils/format';
import { WeeklyReport, deltaLabel, diffLabel, shortDate, weekRangeLabel } from '../utils/weekly';
import { ShareOutcome, shareWeeklyReport } from '../utils/weeklyShare';

interface Props {
  report: WeeklyReport;
  /** 홈에서는 양옆 여백을 쓰고, 설정 카드 안에서는 안 쓴다 */
  style?: React.CSSProperties;
}

/**
 * 월~일 한 주 리포트. 일·월요일 홈에 뜨고, 설정에서는 언제나 열 수 있다.
 * '카톡으로 공유'는 canvas 로 그린 PNG 를 Web Share 로 보낸다 (utils/weeklyShare.ts).
 */
export default function WeeklyReportCard({ report: r, style }: Props) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<ShareOutcome | null>(null);

  async function handleShare() {
    setBusy(true);
    try {
      const out = await shareWeeklyReport(r);
      setNote(out.message ? out : null);
    } finally {
      setBusy(false);
    }
  }

  const over = r.hasIncome && r.diff < 0;
  const accent = !r.hasIncome ? '#8B95A1' : over ? '#F04452' : '#12B76A';
  const d = r.deltaRatio;
  const dColor = d === null ? '#8B95A1' : d > 0.005 ? '#F04452' : d < -0.005 ? '#12B76A' : '#8B95A1';
  const maxCat = r.topCategories[0]?.amount || 1;

  return (
    <div style={{
      background: '#fff', borderRadius: 20, padding: 16,
      boxShadow: 'none', ...style,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
        <h3 style={{ margin: 0, fontSize: 14, color: '#191F28' }}>📊 주간 리포트</h3>
        <span style={{ fontSize: 11, color: '#B0B8C1' }}>{weekRangeLabel(r)}</span>
      </div>

      {/* 이번 주 지출 · 예산 대비 */}
      <div style={{ textAlign: 'center', padding: '6px 0 10px' }}>
        <div style={{ fontSize: 11.5, color: '#8B95A1', marginBottom: 2 }}>이번 주 쓴 돈 · {r.count}건</div>
        <div style={{ fontSize: 28, fontWeight: 800, color: '#191F28', lineHeight: 1.2 }}>{won(r.totalSpent)}</div>
        <div style={{
          display: 'inline-block', marginTop: 8, fontSize: 12.5, fontWeight: 700,
          color: accent, background: `${accent}18`, borderRadius: 20, padding: '4px 12px',
        }}>
          {diffLabel(r)}
        </div>
        {r.hasIncome && (
          <div style={{ fontSize: 11, color: '#B0B8C1', marginTop: 7 }}>
            하루 {won(Math.floor(r.dailyIncome))} × 7일 = {won(Math.floor(r.weeklyBudget))}
          </div>
        )}
      </div>

      {/* 많이 쓴 곳 */}
      <div style={{ fontSize: 12, fontWeight: 600, color: '#8B95A1', margin: '8px 0 6px' }}>많이 쓴 곳</div>
      {r.topCategories.length === 0 ? (
        <div style={{ fontSize: 12.5, color: '#B0B8C1', padding: '4px 0 8px' }}>이번 주 지출이 없어요</div>
      ) : (
        r.topCategories.map(c => (
          <div key={c.category} style={{ marginBottom: 7 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 3 }}>
              <span style={{ color: '#191F28', fontWeight: 500 }}>{CATEGORY_EMOJI[c.category]} {c.category}</span>
              <span style={{ color: '#F04452', fontWeight: 700 }}>{won(c.amount)}</span>
            </div>
            <div style={{ background: '#F2F4F6', borderRadius: 99, height: 5, overflow: 'hidden' }}>
              <div style={{
                width: `${Math.max(3, Math.round((c.amount / maxCat) * 100))}%`, height: '100%',
                background: CATEGORY_COLOR[c.category], borderRadius: 99,
              }} />
            </div>
          </div>
        ))
      )}

      {/* 큰 지출 TOP3 */}
      {r.topExpenses.length > 0 && (
        <>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#8B95A1', margin: '12px 0 4px' }}>큰 지출 TOP 3</div>
          {r.topExpenses.map((e, i) => (
            <div key={e.id} style={{
              display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12.5,
              padding: '5px 0', borderBottom: i < r.topExpenses.length - 1 ? '1px solid #F2F4F6' : undefined,
            }}>
              <span style={{ color: '#4E5968', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                <span style={{ color: '#B0B8C1', marginRight: 6 }}>{shortDate(e.date)}</span>{e.content}
              </span>
              <span style={{ fontWeight: 700, color: '#191F28', flexShrink: 0 }}>{won(e.amount)}</span>
            </div>
          ))}
        </>
      )}

      {/* 지난주 대비 */}
      <div style={{ textAlign: 'center', marginTop: 12, fontSize: 13, fontWeight: 700, color: dColor }}>
        {deltaLabel(r)}
        {r.prevTotal > 0 && (
          <span style={{ fontSize: 11, color: '#B0B8C1', fontWeight: 400, marginLeft: 6 }}>
            지난주 {won(r.prevTotal)}
          </span>
        )}
      </div>

      <button
        onClick={() => { void handleShare(); }}
        disabled={busy}
        style={{
          width: '100%', marginTop: 12, padding: 12, border: 'none', borderRadius: 14,
          background: '#fee500', color: '#3c1e1e', fontSize: 14, fontWeight: 700,
          cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.6 : 1,
        }}
      >
        {busy ? '만드는 중…' : '카톡으로 공유'}
      </button>

      {note && (
        <div style={{
          marginTop: 10, padding: '9px 12px', borderRadius: 12, fontSize: 12.5, lineHeight: 1.6,
          background: note.tone === 'ok' ? '#E8F8F0' : note.tone === 'err' ? '#FFEEF0' : '#F2F4F6',
          color: note.tone === 'ok' ? '#0E9F5B' : note.tone === 'err' ? '#D22030' : '#4E5968',
        }}>
          {note.message}
        </div>
      )}
    </div>
  );
}

import React from 'react';
import { LESSONS } from '../data/lessons';
import { ExamRecord } from '../data/types';

interface Props {
  learned: number[];
  exams: ExamRecord[];
  onReset: () => void;
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const two = (n: number) => String(n).padStart(2, '0');
  return `${d.getMonth() + 1}월 ${d.getDate()}일 ${two(d.getHours())}:${two(d.getMinutes())}`;
}

export default function HistoryView({ learned, exams, onReset }: Props) {
  const best = exams.reduce((max, e) => Math.max(max, e.correct), 0);
  const average = exams.length
    ? Math.round((exams.reduce((sum, e) => sum + e.correct, 0) / exams.length) * 10) / 10
    : 0;

  return (
    <>
      <div className="card">
        <div className="card-head">
          <span className="label">학습 진도</span>
          <span className="badge">{learned.length} / {LESSONS.length} 세트</span>
        </div>
        <div className="grid">
          {LESSONS.map((l) => (
            <div key={l.id} className={`chip ${learned.includes(l.id) ? 'learned' : ''}`}>
              {l.id}
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <span className="label">시험 성적</span>
          <span className="label">
            {exams.length ? `최고 ${best}점 · 평균 ${average}점` : '아직 없음'}
          </span>
        </div>
        {exams.length === 0 ? (
          <div className="empty">시험을 보면 여기에 기록이 쌓입니다.</div>
        ) : (
          exams.map((e, i) => (
            <div key={`${e.takenAt}-${i}`} className="record">
              <span className="when">{formatWhen(e.takenAt)}</span>
              <span>
                {e.wrongSetIds.length > 0 && (
                  <span className="when" style={{ marginRight: 8 }}>
                    다시 볼 세트 {e.wrongSetIds.join(', ')}
                  </span>
                )}
                <span className="pts">{e.correct} / {e.total}</span>
              </span>
            </div>
          ))
        )}
      </div>

      <div className="card">
        <div className="label" style={{ marginBottom: 8 }}>기록 지우기</div>
        <p style={{ fontSize: 13.5, color: '#7d7168', marginTop: 0 }}>
          학습 완료 표시와 시험 기록을 모두 지웁니다. 되돌릴 수 없어요.
        </p>
        <button
          type="button"
          className="btn wide"
          onClick={() => {
            if (window.confirm('학습 기록과 시험 기록을 모두 지울까요?')) onReset();
          }}
        >
          전체 초기화
        </button>
      </div>
    </>
  );
}

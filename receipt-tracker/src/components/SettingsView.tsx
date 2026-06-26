import React from 'react';
import { Transaction } from '../types';
import { exportMonthToExcel } from '../utils/excelExport';

interface Props {
  transactions: Transaction[];
  currentMonth: string;
  onBack: () => void;
}

export default function SettingsView({ transactions, currentMonth, onBack }: Props) {
  const monthFiltered = transactions.filter(t => t.date.startsWith(currentMonth));
  const [y, m] = currentMonth.split('-');
  const monthLabel = `${y}년 ${m}월`;

  return (
    <div style={{ minHeight: '100vh', background: '#f8f9fa', padding: '0 0 80px' }}>
      <div style={{
        background: '#fff',
        padding: '16px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
        position: 'sticky',
        top: 0,
        zIndex: 10,
      }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', padding: '4px 8px' }}>←</button>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>설정</h2>
      </div>

      <div style={{ padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <h3 style={{ margin: '0 0 8px', fontSize: 15, color: '#333' }}>Excel 내보내기</h3>
          <p style={{ margin: '0 0 12px', fontSize: 13, color: '#888' }}>
            {monthLabel} 거래내역 {monthFiltered.length}건을 Excel 파일로 저장합니다.
          </p>
          <button
            onClick={() => exportMonthToExcel(monthFiltered, currentMonth)}
            disabled={monthFiltered.length === 0}
            style={{
              width: '100%',
              padding: '12px',
              background: monthFiltered.length === 0 ? '#e0e0e0' : '#27ae60',
              color: monthFiltered.length === 0 ? '#999' : '#fff',
              border: 'none',
              borderRadius: 8,
              fontSize: 15,
              fontWeight: 600,
              cursor: monthFiltered.length === 0 ? 'not-allowed' : 'pointer',
            }}
          >
            {monthLabel} Excel 다운로드
          </button>
        </div>

        <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <h3 style={{ margin: '0 0 8px', fontSize: 15, color: '#333' }}>영수증 인식 정보</h3>
          <p style={{ margin: 0, fontSize: 13, color: '#888', lineHeight: 1.6 }}>
            영수증 글자 인식은 브라우저 안에서 직접 처리됩니다 (Tesseract OCR).
            <br />• 완전 무료 · API 키 불필요
            <br />• 사진은 외부로 전송되지 않아요
            <br />• 처음 한 번만 인식 데이터를 내려받아요
          </p>
        </div>

        <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <h3 style={{ margin: '0 0 8px', fontSize: 15, color: '#333' }}>데이터 저장</h3>
          <p style={{ margin: 0, fontSize: 13, color: '#888', lineHeight: 1.6 }}>
            모든 내역은 이 브라우저에만 저장됩니다.
            정기적으로 Excel로 내보내 백업하는 것을 권장해요.
          </p>
        </div>
      </div>
    </div>
  );
}

import React, { useState } from 'react';
import { Transaction } from '../types';
import { exportMonthToExcel } from '../utils/excelExport';

interface Props {
  apiKey: string;
  onSaveApiKey: (key: string) => void;
  transactions: Transaction[];
  currentMonth: string;
  onBack: () => void;
}

export default function SettingsView({ apiKey, onSaveApiKey, transactions, currentMonth, onBack }: Props) {
  const [input, setInput] = useState(apiKey);
  const [saved, setSaved] = useState(false);

  function handleSave() {
    onSaveApiKey(input.trim());
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

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
          <h3 style={{ margin: '0 0 8px', fontSize: 15, color: '#333' }}>Claude API 키</h3>
          <p style={{ margin: '0 0 12px', fontSize: 13, color: '#888' }}>
            영수증 자동 인식에 사용됩니다. Anthropic Console에서 발급받으세요.
          </p>
          <input
            type="password"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="sk-ant-..."
            style={{
              width: '100%',
              padding: '10px 12px',
              border: '1.5px solid #e0e0e0',
              borderRadius: 8,
              fontSize: 14,
              boxSizing: 'border-box',
              outline: 'none',
            }}
          />
          <button
            onClick={handleSave}
            style={{
              marginTop: 12,
              width: '100%',
              padding: '12px',
              background: saved ? '#27ae60' : '#3498db',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              fontSize: 15,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'background 0.2s',
            }}
          >
            {saved ? '저장되었습니다!' : '저장'}
          </button>
        </div>

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
      </div>
    </div>
  );
}

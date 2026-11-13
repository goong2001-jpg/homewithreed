import React, { useState } from 'react';
import { playClick, playWrong } from '../utils/sounds';

/**
 * 엄마·아빠 확인 — 곱셈 문제를 맞혀야 지나간다.
 * 7살 아이가 혼자 풀기 어려운 문제(6~9단)라서 쿠폰 사용과 엄마·아빠 메뉴를 지키는 데 쓴다.
 */
function makeProblem() {
  const a = 6 + Math.floor(Math.random() * 4);
  const b = 6 + Math.floor(Math.random() * 4);
  return { a, b };
}

export default function ParentGate({ title, onPass, onCancel }: {
  title: string; onPass: () => void; onCancel: () => void;
}) {
  const [problem, setProblem] = useState(makeProblem);
  const [typed, setTyped] = useState('');
  const [wrong, setWrong] = useState(false);

  const press = (d: string) => { playClick(); setWrong(false); setTyped(t => (t + d).slice(0, 3)); };
  const check = () => {
    if (Number(typed) === problem.a * problem.b) { playClick(); onPass(); return; }
    playWrong();
    setWrong(true);
    setTyped('');
    setProblem(makeProblem());
  };

  const key: React.CSSProperties = {
    padding: '12px 0', borderRadius: 12, border: 'none', background: '#f2f0fa', color: '#44405e',
    fontSize: 20, fontWeight: 900, cursor: 'pointer', fontFamily: 'inherit',
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 300, padding: 20,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Nunito','Noto Sans KR',sans-serif",
    }}>
      <div style={{
        background: 'white', borderRadius: 22, padding: '22px 20px', maxWidth: 300, width: '100%',
        textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
      }}>
        <div style={{ fontSize: 30 }}>🔒</div>
        <div style={{ fontSize: 16, fontWeight: 900, color: '#44405e', marginBottom: 2 }}>{title}</div>
        <div style={{ fontSize: 12, color: '#888', marginBottom: 12 }}>엄마·아빠가 답을 눌러 주세요</div>
        <div style={{ fontSize: 26, fontWeight: 900, color: '#5b4b8a', marginBottom: 10 }}>
          {problem.a} × {problem.b} = <span style={{
            display: 'inline-block', minWidth: 56, borderBottom: '3px solid #7c4dff', color: '#7c4dff',
          }}>{typed || '?'}</span>
        </div>
        {wrong && <div style={{ fontSize: 13, fontWeight: 800, color: '#e74c3c', marginBottom: 8 }}>틀렸어요. 새 문제예요!</div>}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: 12 }}>
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(d => (
            <button key={d} onClick={() => press(d)} style={key}>{d}</button>
          ))}
          <button onClick={() => { playClick(); setTyped(t => t.slice(0, -1)); }} style={{ ...key, fontSize: 15 }}>지우기</button>
          <button onClick={() => press('0')} style={key}>0</button>
          <button onClick={check} disabled={!typed} style={{
            ...key, background: typed ? 'linear-gradient(135deg,#667eea,#764ba2)' : '#ddd', color: 'white', fontSize: 15,
          }}>확인</button>
        </div>
        <button onClick={() => { playClick(); onCancel(); }} style={{
          border: 'none', background: 'none', color: '#999', fontSize: 14, fontWeight: 800,
          cursor: 'pointer', fontFamily: 'inherit',
        }}>취소</button>
      </div>
    </div>
  );
}

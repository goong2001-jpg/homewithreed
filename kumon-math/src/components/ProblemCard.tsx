import React, { useState, useEffect, useRef } from 'react';
import { Problem } from '../types';

interface Props {
  problem: Problem;
  onSubmit: (answer: number) => void;
  isCorrect: boolean | null;
}

export default function ProblemCard({ problem, onSubmit, isCorrect }: Props) {
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setInput('');
    inputRef.current?.focus();
  }, [problem]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseInt(input, 10);
    if (!isNaN(val)) onSubmit(val);
  };

  const handleNumPad = (digit: string) => {
    if (digit === '←') {
      setInput(prev => prev.slice(0, -1));
    } else if (digit === '확인') {
      const val = parseInt(input, 10);
      if (!isNaN(val)) onSubmit(val);
    } else {
      setInput(prev => (prev.length < 3 ? prev + digit : prev));
    }
  };

  const numPad = ['1','2','3','4','5','6','7','8','9','←','0','확인'];

  return (
    <div style={{ width: '100%', maxWidth: 380 }}>
      <div style={{
        background: 'white',
        borderRadius: 28,
        padding: '32px 28px',
        boxShadow: isCorrect === true
          ? '0 0 0 4px #27ae60, 0 20px 60px rgba(39,174,96,0.3)'
          : isCorrect === false
          ? '0 0 0 4px #e74c3c, 0 20px 60px rgba(231,76,60,0.3)'
          : '0 20px 60px rgba(0,0,0,0.12)',
        transition: 'box-shadow 0.3s',
        textAlign: 'center',
      }}>
        <div style={{
          fontSize: 52,
          fontWeight: 900,
          color: '#2c3e50',
          letterSpacing: 4,
          marginBottom: 24,
          fontFamily: "'Nunito', sans-serif",
        }}>
          <span style={{ color: '#3498db' }}>{problem.num1}</span>
          {' '}
          <span style={{ color: problem.operation === 'add' ? '#27ae60' : '#e74c3c' }}>
            {problem.operation === 'add' ? '+' : '-'}
          </span>
          {' '}
          <span style={{ color: '#9b59b6' }}>{problem.num2}</span>
          {' '}
          <span style={{ color: '#7f8c8d' }}>=</span>
          {' '}
          <span style={{
            display: 'inline-block',
            minWidth: 64,
            borderBottom: '4px solid #3498db',
            color: input ? '#2c3e50' : '#bbb',
          }}>
            {input || '?'}
          </span>
        </div>

        <form onSubmit={handleSubmit}>
          <input
            ref={inputRef}
            type="number"
            value={input}
            onChange={e => setInput(e.target.value)}
            style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }}
          />
        </form>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 10,
          marginTop: 8,
        }}>
          {numPad.map(d => (
            <button
              key={d}
              onClick={() => handleNumPad(d)}
              style={{
                padding: '14px 0',
                borderRadius: 14,
                border: 'none',
                fontSize: d === '확인' ? 14 : 22,
                fontWeight: 700,
                cursor: 'pointer',
                background: d === '확인'
                  ? 'linear-gradient(135deg, #667eea, #764ba2)'
                  : d === '←'
                  ? '#fadbd8'
                  : '#f0f3ff',
                color: d === '확인' ? 'white' : d === '←' ? '#e74c3c' : '#2c3e50',
                boxShadow: d === '확인'
                  ? '0 4px 12px rgba(118,75,162,0.4)'
                  : '0 2px 6px rgba(0,0,0,0.08)',
                transform: 'scale(1)',
                transition: 'transform 0.1s',
              }}
              onMouseDown={e => (e.currentTarget.style.transform = 'scale(0.92)')}
              onMouseUp={e => (e.currentTarget.style.transform = 'scale(1)')}
            >
              {d}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

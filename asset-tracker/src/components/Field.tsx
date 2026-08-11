import React from 'react';
import { formatAmountInput, formatRateInput, parseAmountInput, shortWon } from '../utils/format';
import { COLOR } from './ui';

/**
 * 편집 시트 안에서 쓰는 입력 칸들.
 * 금액은 전부 AmountField를 거치게 해서 콤마 처리와 파싱이 한 군데에만 있게 한다.
 */

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 13,
  fontWeight: 600,
  color: COLOR.sub,
  marginBottom: 6,
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px 13px',
  fontSize: 16,          // 16px 미만이면 iOS가 입력할 때 화면을 확대해버린다
  border: `1px solid ${COLOR.line}`,
  borderRadius: 9,
  background: '#fbfcfd',
  color: COLOR.text,
  outline: 'none',
};

const wrap: React.CSSProperties = { marginBottom: 14 };

const hintStyle: React.CSSProperties = {
  margin: '5px 0 0',
  fontSize: 12,
  color: COLOR.faint,
  lineHeight: 1.5,
};

interface BaseProps {
  label: string;
  hint?: string;
}

export function TextField(
  { label, hint, value, onChange, placeholder }:
  BaseProps & { value: string; onChange: (v: string) => void; placeholder?: string },
) {
  return (
    <div style={wrap}>
      <label style={labelStyle}>{label}</label>
      <input
        style={inputStyle}
        value={value}
        placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
      />
      {hint && <p style={hintStyle}>{hint}</p>}
    </div>
  );
}

/**
 * 금액 입력. 화면에는 콤마가 붙은 문자열을 두고 저장할 때만 숫자로 바꾼다.
 * 큰 금액은 아래에 '3.2억원'으로 되짚어줘서 0을 하나 더 치거나 덜 친 걸 눈치채게 한다.
 */
export function AmountField(
  { label, hint, value, onChange, placeholder, allowEmpty }:
  BaseProps & {
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
    allowEmpty?: boolean;
  },
) {
  const n = parseAmountInput(value);
  const showEcho = n >= 10_000;
  return (
    <div style={wrap}>
      <label style={labelStyle}>{label}</label>
      <div style={{ position: 'relative' }}>
        <input
          style={{ ...inputStyle, paddingRight: 40, textAlign: 'right' }}
          inputMode="numeric"
          value={value}
          placeholder={placeholder ?? (allowEmpty ? '비워두면 계산 안 함' : '0')}
          onChange={e => onChange(formatAmountInput(e.target.value))}
        />
        <span
          style={{
            position: 'absolute', right: 13, top: '50%', transform: 'translateY(-50%)',
            fontSize: 15, color: COLOR.sub, pointerEvents: 'none',
          }}
        >
          원
        </span>
      </div>
      {showEcho && (
        <p style={{ ...hintStyle, color: COLOR.sub, fontWeight: 600 }}>= {shortWon(n)}</p>
      )}
      {hint && <p style={hintStyle}>{hint}</p>}
    </div>
  );
}

/** 연이율 — 소수점 한 개까지 허용한다 */
export function RateField(
  { label, hint, value, onChange }:
  BaseProps & { value: string; onChange: (v: string) => void },
) {
  return (
    <div style={wrap}>
      <label style={labelStyle}>{label}</label>
      <div style={{ position: 'relative' }}>
        <input
          style={{ ...inputStyle, paddingRight: 34, textAlign: 'right' }}
          inputMode="decimal"
          value={value}
          placeholder="3.5"
          onChange={e => onChange(formatRateInput(e.target.value))}
        />
        <span
          style={{
            position: 'absolute', right: 13, top: '50%', transform: 'translateY(-50%)',
            fontSize: 15, color: COLOR.sub, pointerEvents: 'none',
          }}
        >
          %
        </span>
      </div>
      {hint && <p style={hintStyle}>{hint}</p>}
    </div>
  );
}

export function NumberField(
  { label, hint, value, onChange, suffix, min, max }:
  BaseProps & {
    value: string;
    onChange: (v: string) => void;
    suffix?: string;
    min?: number;
    max?: number;
  },
) {
  return (
    <div style={wrap}>
      <label style={labelStyle}>{label}</label>
      <div style={{ position: 'relative' }}>
        <input
          style={{ ...inputStyle, paddingRight: suffix ? 44 : 13, textAlign: 'right' }}
          inputMode="numeric"
          value={value}
          min={min}
          max={max}
          onChange={e => onChange(e.target.value.replace(/[^0-9]/g, ''))}
        />
        {suffix && (
          <span
            style={{
              position: 'absolute', right: 13, top: '50%', transform: 'translateY(-50%)',
              fontSize: 15, color: COLOR.sub, pointerEvents: 'none',
            }}
          >
            {suffix}
          </span>
        )}
      </div>
      {hint && <p style={hintStyle}>{hint}</p>}
    </div>
  );
}

export function DateField(
  { label, hint, value, onChange, clearable }:
  BaseProps & { value: string; onChange: (v: string) => void; clearable?: boolean },
) {
  return (
    <div style={wrap}>
      <label style={labelStyle}>{label}</label>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          type="date"
          style={{ ...inputStyle, flex: 1 }}
          value={value}
          onChange={e => onChange(e.target.value)}
        />
        {clearable && value && (
          <button
            onClick={() => onChange('')}
            style={{
              padding: '0 14px', borderRadius: 9, border: `1px solid ${COLOR.line}`,
              background: '#fbfcfd', color: COLOR.sub, fontSize: 14, cursor: 'pointer',
            }}
          >
            지움
          </button>
        )}
      </div>
      {hint && <p style={hintStyle}>{hint}</p>}
    </div>
  );
}

/** 버튼 여러 개 중 하나 고르기 — select보다 폰에서 훨씬 빠르다 */
export function ChoiceField<T extends string>(
  { label, hint, value, options, onChange, columns }:
  BaseProps & {
    value: T;
    options: { value: T; label: string; color?: string }[];
    onChange: (v: T) => void;
    columns?: number;
  },
) {
  return (
    <div style={wrap}>
      <label style={labelStyle}>{label}</label>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${columns ?? options.length}, 1fr)`,
          gap: 6,
        }}
      >
        {options.map(o => {
          const on = o.value === value;
          return (
            <button
              key={o.value}
              onClick={() => onChange(o.value)}
              style={{
                padding: '11px 4px',
                borderRadius: 9,
                border: `1px solid ${on ? (o.color ?? COLOR.accent) : COLOR.line}`,
                background: on ? (o.color ?? COLOR.accent) : '#fbfcfd',
                color: on ? '#fff' : COLOR.sub,
                fontSize: 14,
                fontWeight: on ? 700 : 500,
                cursor: 'pointer',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {o.label}
            </button>
          );
        })}
      </div>
      {hint && <p style={hintStyle}>{hint}</p>}
    </div>
  );
}

/** 계산 결과를 시트 안에서 미리 보여주는 상자 */
export function PreviewBox({ rows }: { rows: { label: string; value: string; strong?: boolean }[] }) {
  return (
    <div
      style={{
        background: '#f4f7f9',
        borderRadius: 9,
        padding: '12px 14px',
        marginBottom: 14,
      }}
    >
      {rows.map((r, i) => (
        <div
          key={r.label}
          style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
            marginTop: i ? 7 : 0,
          }}
        >
          <span style={{ fontSize: 13, color: COLOR.sub }}>{r.label}</span>
          <strong
            style={{
              fontSize: r.strong ? 16 : 14,
              color: r.strong ? COLOR.asset : COLOR.text,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {r.value}
          </strong>
        </div>
      ))}
    </div>
  );
}

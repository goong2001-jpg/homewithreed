import React from 'react';
import { Category } from '../types';
import { clockOfMinutes, parseClock } from '../utils/time';
import { COLOR } from './ui';

/**
 * 편집 시트 안에서 쓰는 입력 칸들.
 * 시각은 전부 ClockField를 거치게 해서 '9시 30분'을 읽는 규칙이 한 군데에만 있게 한다.
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
 * 여러 줄 입력 — 3단계 대본처럼 '한 줄에 하나씩' 적는 칸.
 * 줄바꿈이 곧 항목 구분이라 따로 목록 UI를 만들지 않는다.
 */
export function TextAreaField(
  { label, hint, value, onChange, placeholder, rows }:
  BaseProps & { value: string; onChange: (v: string) => void; placeholder?: string; rows?: number },
) {
  return (
    <div style={wrap}>
      <label style={labelStyle}>{label}</label>
      <textarea
        style={{ ...inputStyle, minHeight: 44, lineHeight: 1.6, resize: 'vertical' }}
        rows={rows ?? 3}
        value={value}
        placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
      />
      {hint && <p style={hintStyle}>{hint}</p>}
    </div>
  );
}

export function DateField(
  { label, hint, value, onChange }:
  BaseProps & { value: string; onChange: (v: string) => void },
) {
  return (
    <div style={wrap}>
      <label style={labelStyle}>{label}</label>
      <input
        type="date"
        style={inputStyle}
        value={value}
        onChange={e => onChange(e.target.value)}
      />
      {hint && <p style={hintStyle}>{hint}</p>}
    </div>
  );
}

/**
 * 시각 입력.
 *
 * `type="time"` 을 안 쓰는 이유: 브라우저마다 오전/오후 선택기가 제각각이라
 * '아까 9시 반쯤부터'를 적는 데 탭이 너무 많이 든다.
 * 여기서는 `930`, `9:30`, `9` 를 전부 받아 넘어갈 때 09:30으로 고쳐 적는다.
 */
export function ClockField(
  { label, hint, value, onChange, invalid, quick }:
  BaseProps & {
    value: string;
    onChange: (v: string) => void;
    invalid?: boolean;
    /** '지금' 처럼 한 번에 채워 넣는 버튼 */
    quick?: { label: string; minutes: number }[];
  },
) {
  return (
    <div style={wrap}>
      <label style={labelStyle}>{label}</label>
      <div style={{ display: 'flex', gap: 6 }}>
        <input
          style={{
            ...inputStyle,
            flex: 1,
            textAlign: 'center',
            fontVariantNumeric: 'tabular-nums',
            letterSpacing: '0.5px',
            borderColor: invalid ? COLOR.danger : COLOR.line,
          }}
          inputMode="numeric"
          value={value}
          placeholder="09:30"
          onChange={e => onChange(e.target.value)}
          onBlur={() => {
            const m = parseClock(value);
            if (m != null) onChange(clockOfMinutes(m));
          }}
        />
        {quick?.map(q => (
          <button
            key={q.label}
            onClick={() => onChange(clockOfMinutes(q.minutes))}
            style={{
              padding: '0 12px', borderRadius: 9, border: `1px solid ${COLOR.line}`,
              background: '#fbfcfd', color: COLOR.accent, fontSize: 13,
              fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
            }}
          >
            {q.label}
          </button>
        ))}
      </div>
      {hint && <p style={hintStyle}>{hint}</p>}
    </div>
  );
}

/** 주간 목표처럼 '몇 시간'을 적는 칸. 3.5 같은 소수도 받는다 */
export function HoursField(
  { label, hint, value, onChange }:
  BaseProps & { value: string; onChange: (v: string) => void },
) {
  return (
    <div style={wrap}>
      <label style={labelStyle}>{label}</label>
      <div style={{ position: 'relative' }}>
        <input
          style={{ ...inputStyle, paddingRight: 46, textAlign: 'right' }}
          inputMode="decimal"
          value={value}
          placeholder="3.5"
          onChange={e => {
            const cleaned = e.target.value.replace(/[^0-9.]/g, '');
            const [head, ...rest] = cleaned.split('.');
            onChange(rest.length ? `${head}.${rest.join('').slice(0, 1)}` : head);
          }}
        />
        <span
          style={{
            position: 'absolute', right: 13, top: '50%', transform: 'translateY(-50%)',
            fontSize: 15, color: COLOR.sub, pointerEvents: 'none',
          }}
        >
          시간
        </span>
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

/** 분류 고르기 — 이모지가 있어서 글자보다 빨리 찾힌다 */
export function CategoryField(
  { label, categories, value, onChange }:
  { label: string; categories: Category[]; value: string; onChange: (id: string) => void },
) {
  return (
    <div style={wrap}>
      <label style={labelStyle}>{label}</label>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
        {categories.map(c => {
          const on = c.id === value;
          return (
            <button
              key={c.id}
              onClick={() => onChange(c.id)}
              style={{
                padding: '9px 2px 8px',
                borderRadius: 9,
                border: `1px solid ${on ? c.color : COLOR.line}`,
                background: on ? c.color : '#fbfcfd',
                color: on ? '#fff' : COLOR.sub,
                fontSize: 12,
                fontWeight: on ? 700 : 500,
                cursor: 'pointer',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                overflow: 'hidden',
              }}
            >
              <span style={{ fontSize: 17, lineHeight: 1 }}>{c.emoji}</span>
              <span style={{ maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {c.name}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** 색·이모지 고르기 */
export function PalettePicker(
  { label, options, value, onChange, isColor }:
  { label: string; options: readonly string[]; value: string; onChange: (v: string) => void; isColor?: boolean },
) {
  return (
    <div style={wrap}>
      <label style={labelStyle}>{label}</label>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {options.map(o => {
          const on = o === value;
          return (
            <button
              key={o}
              onClick={() => onChange(o)}
              aria-label={o}
              style={{
                width: 38, height: 38, borderRadius: 10, cursor: 'pointer',
                border: on ? `2px solid ${COLOR.text}` : `1px solid ${COLOR.line}`,
                background: isColor ? o : '#fbfcfd',
                fontSize: 19, lineHeight: 1, padding: 0,
              }}
            >
              {isColor ? '' : o}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** 계산 결과를 시트 안에서 미리 보여주는 상자 */
export function PreviewBox(
  { rows, tone }:
  { rows: { label: string; value: string; strong?: boolean }[]; tone?: 'plain' | 'warn' },
) {
  return (
    <div
      style={{
        background: tone === 'warn' ? '#fdf3e3' : '#f4f6fa',
        borderRadius: 9,
        padding: '12px 14px',
        marginBottom: 14,
      }}
    >
      {rows.map((r, i) => (
        <div
          key={r.label}
          style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10,
            marginTop: i ? 7 : 0,
          }}
        >
          <span style={{ fontSize: 13, color: COLOR.sub, whiteSpace: 'nowrap' }}>{r.label}</span>
          <strong
            style={{
              fontSize: r.strong ? 16 : 14,
              color: r.strong ? COLOR.text : COLOR.sub,
              fontVariantNumeric: 'tabular-nums',
              textAlign: 'right',
            }}
          >
            {r.value}
          </strong>
        </div>
      ))}
    </div>
  );
}

/** 분류 한 줄의 왼쪽 표식 — 목록에서 반복해서 쓴다 */
export function CategoryMark({ color, emoji }: { color: string; emoji: string }) {
  return (
    <span
      style={{
        width: 34, height: 34, borderRadius: 10, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: `${color}1f`, fontSize: 17,
      }}
    >
      {emoji}
    </span>
  );
}

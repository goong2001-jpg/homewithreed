import React, { useMemo, useState } from 'react';
import { Settings, WeekPlan } from '../types';
import { buildShoppingList, formatQty, toShareText } from '../utils/shopping';
import { C, CARD } from '../theme';

interface Props {
  plan: WeekPlan;
  settings: Settings;
  checked: string[];
  onToggle: (key: string) => void;
  onClear: () => void;
}

export default function ShoppingView({ plan, settings, checked, onToggle, onClear }: Props) {
  const [copied, setCopied] = useState(false);
  const groups = useMemo(() => buildShoppingList(plan, settings), [plan, settings]);
  const checkedSet = new Set(checked);

  const visible = groups
    .map((g) => ({ ...g, items: g.items.filter((i) => !(settings.hidePantry && i.pantry)) }))
    .filter((g) => g.items.length > 0);

  const all = visible.flatMap((g) => g.items);
  const done = all.filter((i) => checkedSet.has(i.key)).length;

  const copy = async () => {
    const text = toShareText(groups, settings.hidePantry);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // 클립보드 권한이 없는 브라우저에서는 직접 고르도록 창을 띄운다.
      window.prompt('아래 내용을 복사하세요', text);
    }
  };

  return (
    <div>
      <h1 style={{ fontSize: 21, margin: '0 0 4px' }}>장보기</h1>
      <p style={{ margin: '0 0 14px', fontSize: 12.5, color: C.muted }}>
        이번 주 식단 {settings.servings}인분에 필요한 전부입니다.
      </p>

      <div style={{ ...CARD, marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 8 }}>
          <span style={{ fontWeight: 700 }}>
            {done} / {all.length}개 담음
          </span>
          <button
            onClick={onClear}
            style={{ background: 'none', border: 'none', color: C.muted, fontSize: 12.5, cursor: 'pointer', padding: 0 }}
          >
            체크 지우기
          </button>
        </div>
        <div style={{ height: 7, background: C.bg, borderRadius: 4, overflow: 'hidden' }}>
          <div
            style={{
              width: all.length ? `${(done / all.length) * 100}%` : '0%',
              height: '100%',
              background: C.accent,
              transition: 'width 0.2s',
            }}
          />
        </div>
        <button
          onClick={copy}
          style={{
            width: '100%',
            marginTop: 12,
            padding: '11px 0',
            background: copied ? C.good : C.accentSoft,
            color: copied ? '#fff' : '#b5622c',
            border: 'none',
            borderRadius: 10,
            fontSize: 14,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          {copied ? '복사했습니다' : '목록 복사하기'}
        </button>
      </div>

      {visible.map((g) => (
        <div key={g.aisle} style={{ ...CARD, marginBottom: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.accent, marginBottom: 4 }}>{g.aisle}</div>
          {g.items.map((item) => {
            const on = checkedSet.has(item.key);
            return (
              <button
                key={item.key}
                onClick={() => onToggle(item.key)}
                aria-pressed={on}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 0',
                  borderTop: `1px solid ${C.border}`,
                  background: 'none',
                  border: 'none',
                  borderTopWidth: 1,
                  borderTopStyle: 'solid',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <span
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: 6,
                    border: `1.5px solid ${on ? C.accent : C.border}`,
                    background: on ? C.accent : '#fff',
                    color: '#fff',
                    fontSize: 12,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  {on ? '✓' : ''}
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span
                    style={{
                      display: 'block',
                      fontSize: 14.5,
                      color: on ? C.muted : C.text,
                      textDecoration: on ? 'line-through' : 'none',
                    }}
                  >
                    {item.name} {formatQty(item.qty, item.unit)}
                  </span>
                  {item.usedIn.length > 0 && (
                    <span
                      style={{
                        display: 'block',
                        fontSize: 11.5,
                        color: C.muted,
                        marginTop: 2,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {item.usedIn.slice(0, 3).join(', ')}
                      {item.usedIn.length > 3 ? ` 외 ${item.usedIn.length - 3}개` : ''}
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      ))}

      {settings.hidePantry && (
        <p style={{ fontSize: 12, color: C.muted, lineHeight: 1.6, margin: '4px 2px 0' }}>
          간장·참기름 같은 상비 양념은 목록에서 빼 두었습니다. 설정에서 켜면 같이 보입니다.
        </p>
      )}
    </div>
  );
}

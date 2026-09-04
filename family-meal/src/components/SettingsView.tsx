import React, { useState } from 'react';
import { getRecipe } from '../data/recipes';
import { ALLERGENS, Allergen, Settings } from '../types';
import { QUICK_PICKS } from '../utils/ingredients';
import { C, CARD } from '../theme';

interface Props {
  settings: Settings;
  onChange: (next: Settings) => void;
  onReset: () => void;
}

const MINUTE_OPTIONS = [20, 30, 40, 60];

export default function SettingsView({ settings, onChange, onReset }: Props) {
  const [draft, setDraft] = useState('');
  const set = (patch: Partial<Settings>) => onChange({ ...settings, ...patch });

  const addHave = (name: string) => {
    const clean = name.trim();
    if (clean.length < 2 || settings.haveAtHome.includes(clean)) return;
    set({ haveAtHome: [...settings.haveAtHome, clean] });
  };
  const removeHave = (name: string) =>
    set({ haveAtHome: settings.haveAtHome.filter((n) => n !== name) });

  const quickPicks = QUICK_PICKS.filter((n) => !settings.haveAtHome.includes(n));

  const toggleAllergen = (a: Allergen) =>
    set({
      avoid: settings.avoid.includes(a) ? settings.avoid.filter((x) => x !== a) : [...settings.avoid, a],
    });

  return (
    <div>
      <h1 style={{ fontSize: 21, margin: '0 0 4px' }}>설정</h1>
      <p style={{ margin: '0 0 14px', fontSize: 12.5, color: C.muted }}>
        바꾸면 이번 주 식단을 그 자리에서 다시 맞춥니다.
      </p>

      <div style={{ ...CARD, marginBottom: 12 }}>
        <Label text="몇 인분으로 만들까요" hint="어른 2명 + 7살 + 아기면 3인분이 대체로 맞습니다." />
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 10 }}>
          <Round onClick={() => set({ servings: Math.max(1, settings.servings - 1) })}>−</Round>
          <span style={{ fontSize: 20, fontWeight: 700, minWidth: 54, textAlign: 'center' }}>
            {settings.servings}인분
          </span>
          <Round onClick={() => set({ servings: Math.min(8, settings.servings + 1) })}>+</Round>
        </div>
      </div>

      <div style={{ ...CARD, marginBottom: 12 }}>
        <Label text="빼야 하는 재료" hint="고른 재료가 들어간 메뉴는 아예 추천하지 않습니다." />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: 10 }}>
          {ALLERGENS.map((a) => {
            const on = settings.avoid.includes(a);
            return (
              <button
                key={a}
                onClick={() => toggleAllergen(a)}
                aria-pressed={on}
                style={{
                  padding: '7px 12px',
                  borderRadius: 20,
                  border: `1px solid ${on ? C.accent : C.border}`,
                  background: on ? C.accent : '#fff',
                  color: on ? '#fff' : C.text,
                  fontSize: 13,
                  fontWeight: on ? 700 : 500,
                  cursor: 'pointer',
                }}
              >
                {a}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ ...CARD, marginBottom: 12 }}>
        <Label
          text="냉장고에 있는 재료"
          hint="여기 적은 재료를 쓰는 메뉴를 먼저 추천하고, 장보기 목록에서는 빼 줍니다."
        />
        <form
          onSubmit={(e) => {
            e.preventDefault();
            addHave(draft);
            setDraft('');
          }}
          style={{ display: 'flex', gap: 7, marginTop: 10 }}
        >
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="예: 애호박"
            aria-label="냉장고에 있는 재료 추가"
            style={{
              flex: 1,
              padding: '10px 12px',
              borderRadius: 10,
              border: `1px solid ${C.border}`,
              fontSize: 14,
              minWidth: 0,
            }}
          />
          <button
            type="submit"
            style={{
              padding: '0 16px',
              borderRadius: 10,
              border: 'none',
              background: C.accent,
              color: '#fff',
              fontSize: 14,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            추가
          </button>
        </form>

        {settings.haveAtHome.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: 10 }}>
            {settings.haveAtHome.map((name) => (
              <button
                key={name}
                onClick={() => removeHave(name)}
                aria-label={`${name} 빼기`}
                style={{
                  padding: '7px 10px 7px 12px',
                  borderRadius: 20,
                  border: 'none',
                  background: C.good,
                  color: '#fff',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {name} <span style={{ opacity: 0.75 }}>×</span>
              </button>
            ))}
          </div>
        )}

        <div style={{ fontSize: 12, color: C.muted, marginTop: 12, marginBottom: 6 }}>자주 쓰는 재료</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {quickPicks.map((name) => (
            <button
              key={name}
              onClick={() => addHave(name)}
              style={{
                padding: '6px 10px',
                borderRadius: 20,
                border: `1px solid ${C.border}`,
                background: '#fff',
                color: C.text,
                fontSize: 12.5,
                cursor: 'pointer',
              }}
            >
              + {name}
            </button>
          ))}
        </div>
      </div>

      <div style={{ ...CARD, marginBottom: 12 }}>
        <Label text="한 메뉴 최대 조리 시간" hint="후보가 모자라면 앱이 알아서 조금 늘려 잡습니다." />
        <div style={{ display: 'flex', gap: 7, marginTop: 10 }}>
          {MINUTE_OPTIONS.map((m) => {
            const on = settings.maxMinutes === m;
            return (
              <button
                key={m}
                onClick={() => set({ maxMinutes: m })}
                aria-pressed={on}
                style={{
                  flex: 1,
                  padding: '9px 0',
                  borderRadius: 10,
                  border: `1px solid ${on ? C.accent : C.border}`,
                  background: on ? C.accentSoft : '#fff',
                  color: on ? '#b5622c' : C.text,
                  fontSize: 13.5,
                  fontWeight: on ? 700 : 500,
                  cursor: 'pointer',
                }}
              >
                {m}분
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ ...CARD, marginBottom: 12 }}>
        <Switch
          text="장보기 줄이기"
          hint="아침은 네 가지를 돌려 먹고 반찬은 이틀씩 먹습니다. 이미 사기로 한 재료를 다시 쓰는 메뉴를 앞세워 살 것을 줄입니다."
          on={settings.saveShopping}
          onToggle={() => set({ saveShopping: !settings.saveShopping })}
        />
        <div style={{ height: 1, background: C.border, margin: '12px 0' }} />
        <Switch
          text="매운 메뉴 빼기"
          hint="김치찌개·제육볶음처럼 아이가 못 먹는 메뉴를 아예 추천하지 않습니다."
          on={settings.noSpicy}
          onToggle={() => set({ noSpicy: !settings.noSpicy })}
        />
        <div style={{ height: 1, background: C.border, margin: '12px 0' }} />
        <Switch
          text="상비 양념 접어 두기"
          hint="간장·참기름·다진마늘처럼 늘 있는 것을 장보기 목록에서 뺍니다."
          on={settings.hidePantry}
          onToggle={() => set({ hidePantry: !settings.hidePantry })}
        />
      </div>

      {(settings.excluded.length > 0 || settings.favorites.length > 0) && (
        <div style={{ ...CARD, marginBottom: 12 }}>
          <Label
            text="식구들 입맛"
            hint="레시피 화면에서 눌러 둔 것들입니다. 여기서 되돌릴 수 있습니다."
          />
          <MenuList
            title="⭐ 잘 먹는 메뉴"
            ids={settings.favorites}
            onRemove={(id) => set({ favorites: settings.favorites.filter((x) => x !== id) })}
          />
          <MenuList
            title="🚫 추천에서 뺀 메뉴"
            ids={settings.excluded}
            onRemove={(id) => set({ excluded: settings.excluded.filter((x) => x !== id) })}
          />
        </div>
      )}

      <button
        onClick={onReset}
        style={{
          width: '100%',
          padding: '12px 0',
          background: '#fff',
          color: C.warn,
          border: `1px solid ${C.border}`,
          borderRadius: 12,
          fontSize: 14,
          cursor: 'pointer',
        }}
      >
        설정과 식단 초기화
      </button>
    </div>
  );
}

function MenuList({
  title,
  ids,
  onRemove,
}: {
  title: string;
  ids: string[];
  onRemove: (id: string) => void;
}) {
  if (ids.length === 0) return null;
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ fontSize: 12.5, color: C.muted, marginBottom: 6 }}>{title}</div>
      {ids.map((id) => (
        <div
          key={id}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 0',
            borderTop: `1px solid ${C.border}`,
            fontSize: 14,
          }}
        >
          <span>{getRecipe(id)?.name ?? id}</span>
          <button
            onClick={() => onRemove(id)}
            style={{
              background: 'none',
              border: `1px solid ${C.border}`,
              borderRadius: 8,
              padding: '5px 10px',
              fontSize: 12.5,
              color: C.muted,
              cursor: 'pointer',
            }}
          >
            되돌리기
          </button>
        </div>
      ))}
    </div>
  );
}

function Label({ text, hint }: { text: string; hint: string }) {
  return (
    <div>
      <div style={{ fontSize: 14.5, fontWeight: 700 }}>{text}</div>
      <div style={{ fontSize: 12, color: C.muted, marginTop: 3, lineHeight: 1.5 }}>{hint}</div>
    </div>
  );
}

function Round({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: 38,
        height: 38,
        borderRadius: 19,
        border: `1px solid ${C.border}`,
        background: '#fff',
        fontSize: 18,
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  );
}

function Switch({
  text,
  hint,
  on,
  onToggle,
}: {
  text: string;
  hint: string;
  on: boolean;
  onToggle: () => void;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ flex: 1 }}>
        <Label text={text} hint={hint} />
      </div>
      <button
        onClick={onToggle}
        role="switch"
        aria-checked={on}
        aria-label={text}
        style={{
          width: 48,
          height: 28,
          borderRadius: 14,
          border: 'none',
          background: on ? C.accent : C.border,
          position: 'relative',
          cursor: 'pointer',
          flexShrink: 0,
          transition: 'background 0.15s',
        }}
      >
        <span
          style={{
            position: 'absolute',
            top: 3,
            left: on ? 23 : 3,
            width: 22,
            height: 22,
            borderRadius: 11,
            background: '#fff',
            transition: 'left 0.15s',
          }}
        />
      </button>
    </div>
  );
}

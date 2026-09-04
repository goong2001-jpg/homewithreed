import React, { useMemo, useState } from 'react';
import IngredientPicker from './IngredientPicker';
import { Settings, Slot, SLOT_LABEL } from '../types';
import { FridgeMatch, matchRecipes } from '../utils/fridge';
import { C, CARD } from '../theme';

interface Props {
  settings: Settings;
  /** 재료만 저장한다. 이 화면에서 식단이 저절로 바뀌지는 않는다. */
  onChangeHave: (have: string[]) => void;
  /** 지금 재료를 반영해 이번 주 식단을 다시 짠다 */
  onReplan: () => void;
  onPick: (recipeId: string) => void;
}

const SLOT_TABS: { key: Slot | 'all'; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'main', label: '메인' },
  { key: 'soup', label: '국' },
  { key: 'side', label: '반찬' },
  { key: 'onedish', label: '한 그릇' },
  { key: 'breakfast', label: '아침' },
];

/** 사야 할 개수로 묶어 보여준다. 세 개 이상 사야 하면 "냉장고 털기"가 아니다. */
const BUCKETS = [
  { missing: 0, title: '지금 바로 만들 수 있어요', color: C.good },
  { missing: 1, title: '한 가지만 사면 돼요', color: C.accent },
  { missing: 2, title: '두 가지 사면 돼요', color: C.muted },
];

export default function FridgeView({ settings, onChangeHave, onReplan, onPick }: Props) {
  const [slot, setSlot] = useState<Slot | 'all'>('all');
  const have = settings.haveAtHome;

  const matches = useMemo(
    () => matchRecipes(have, settings, slot === 'all' ? undefined : slot),
    [have, settings, slot]
  );

  const buckets = BUCKETS.map((b) => ({
    ...b,
    items: matches.filter((m) => m.missing.length === b.missing).slice(0, 12),
  })).filter((b) => b.items.length > 0);

  return (
    <div>
      <h1 style={{ fontSize: 21, margin: '0 0 4px' }}>냉장고 털기</h1>
      <p style={{ margin: '0 0 14px', fontSize: 12.5, color: C.muted }}>
        지금 집에 있는 걸 넣으면 그걸로 만들 수 있는 메뉴를 찾아 줍니다. 간장·참기름 같은 상비 양념과
        쌀·밥은 있는 것으로 칩니다.
      </p>

      <div style={{ ...CARD, marginBottom: 14 }}>
        <IngredientPicker have={have} onChange={onChangeHave} />
      </div>

      {have.length === 0 ? (
        <div style={{ ...CARD, textAlign: 'center', padding: '28px 16px' }}>
          <div style={{ fontSize: 30, marginBottom: 8 }}>🧊</div>
          <div style={{ fontSize: 14.5, fontWeight: 700, marginBottom: 4 }}>재료를 넣어 보세요</div>
          <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.6 }}>
            두세 개만 넣어도 만들 수 있는 메뉴가 나옵니다.
          </div>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4, marginBottom: 12 }}>
            {SLOT_TABS.map((t) => {
              const on = slot === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => setSlot(t.key)}
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
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }}
                >
                  {t.label}
                </button>
              );
            })}
          </div>

          {buckets.length === 0 && (
            <div style={{ ...CARD, marginBottom: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>두 가지 안에 되는 메뉴가 없습니다</div>
              <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.6 }}>
                재료를 몇 개 더 넣거나 위의 자리 선택을 <b>전체</b>로 바꿔 보세요.
              </div>
            </div>
          )}

          {buckets.map((b) => (
            <div key={b.missing} style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: b.color, margin: '0 2px 8px' }}>
                {b.title} · {b.items.length}개
              </div>
              {b.items.map((m) => (
                <MatchRow key={m.recipe.id} match={m} onPick={() => onPick(m.recipe.id)} />
              ))}
            </div>
          ))}

          <button
            onClick={onReplan}
            style={{
              width: '100%',
              padding: '13px 0',
              background: C.accentSoft,
              color: '#b5622c',
              border: 'none',
              borderRadius: 12,
              fontSize: 14,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            이 재료로 이번 주 식단 다시 짜기
          </button>
          <p style={{ fontSize: 12, color: C.muted, lineHeight: 1.6, margin: '8px 2px 0' }}>
            재료만 넣는다고 식단이 저절로 바뀌지는 않습니다. 위 버튼을 눌러야 이번 주 상이 다시 짜입니다.
          </p>
        </>
      )}
    </div>
  );
}

function MatchRow({ match, onPick }: { match: FridgeMatch; onPick: () => void }) {
  const { recipe, have, total, missing } = match;
  return (
    <button
      onClick={onPick}
      style={{
        ...CARD,
        width: '100%',
        textAlign: 'left',
        marginBottom: 8,
        cursor: 'pointer',
        display: 'block',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span style={{ fontSize: 15, fontWeight: 700 }}>{recipe.name}</span>
        {recipe.spicy && <span title="매운 메뉴">🌶</span>}
        <span style={{ fontSize: 11.5, color: C.muted, marginLeft: 'auto', flexShrink: 0 }}>
          {SLOT_LABEL[recipe.slot]} · {recipe.minutes}분
        </span>
      </div>
      <div style={{ fontSize: 12.5, color: C.muted, marginTop: 5 }}>
        재료 {have}/{total}개 있음
        {missing.length > 0 && (
          <>
            {' · '}
            <span style={{ color: C.warn }}>{missing.join(', ')} 필요</span>
          </>
        )}
      </div>
    </button>
  );
}

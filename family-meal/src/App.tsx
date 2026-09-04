import React, { useEffect, useMemo, useState } from 'react';
import BalanceView from './components/BalanceView';
import FridgeView from './components/FridgeView';
import PlanView from './components/PlanView';
import RecipeSheet from './components/RecipeSheet';
import SettingsView from './components/SettingsView';
import ShoppingView from './components/ShoppingView';
import TabBar, { TAB_BAR_HEIGHT } from './components/TabBar';
import { getRecipe } from './data/recipes';
import { DEFAULT_SETTINGS, Settings, Slot, View, WeekPlan } from './types';
import { dayRecipeIds, generateWeek, planRecipeIds, swapMeal } from './utils/planner';
import { newSeed } from './utils/random';
import { KEYS, load, save } from './utils/storage';
import { C } from './theme';

/** 몇 개의 메뉴까지 "최근에 나왔다"고 기억할지. 레시피 수보다 조금 크게 잡았다. */
const HISTORY_SIZE = 90;

export default function App() {
  const [settings, setSettings] = useState<Settings>(() => ({
    ...DEFAULT_SETTINGS,
    ...load<Partial<Settings>>(KEYS.settings, {}),
  }));
  const [plan, setPlan] = useState<WeekPlan>(() => {
    const saved = load<WeekPlan | null>(KEYS.plan, null);
    if (saved && saved.days?.length === 7) return saved;
    return generateWeek(newSeed(), DEFAULT_SETTINGS);
  });
  const [checked, setChecked] = useState<string[]>(() => load<string[]>(KEYS.checked, []));
  /** 최근 몇 주에 이미 올렸던 메뉴. 매주 같은 국이 나오지 않게 하는 재료다. */
  const [history, setHistory] = useState<string[]>(() => load<string[]>(KEYS.history, []));
  const [view, setView] = useState<View>('plan');
  const [openRecipe, setOpenRecipe] = useState<string | null>(null);

  useEffect(() => save(KEYS.settings, settings), [settings]);
  useEffect(() => save(KEYS.plan, plan), [plan]);
  useEffect(() => save(KEYS.checked, checked), [checked]);
  useEffect(() => save(KEYS.history, history), [history]);

  const regenerate = (seed = newSeed(), next = settings) => {
    // 지금 상에 올라 있던 메뉴를 이력 맨 앞에 넣어, 새 식단이 그걸 피해 가게 한다.
    const past = Array.from(new Set(planRecipeIds(plan).concat(history))).slice(0, HISTORY_SIZE);
    setHistory(past);
    setPlan(generateWeek(seed, next, past));
    // 식단이 바뀌면 필요한 재료도 달라진다. 담아 둔 체크는 의미가 없어지므로 비운다.
    setChecked([]);
  };

  const changeSettings = (next: Settings) => {
    setSettings(next);
    // 씨앗을 그대로 두면 "설정만 반영된 같은 결의 식단"이 나온다.
    regenerate(plan.seed, next);
  };

  const reset = () => {
    setSettings(DEFAULT_SETTINGS);
    setHistory([]);
    setPlan(generateWeek(newSeed(), DEFAULT_SETTINGS));
    setChecked([]);
    setView('plan');
  };

  /**
   * 냉장고 재료는 저장만 하고 식단은 건드리지 않는다.
   * 재료 하나 넣을 때마다 이번 주 상이 뒤집히면 쓸 수가 없다 —
   * 다시 짜는 건 냉장고 화면의 버튼으로 직접 하게 했다.
   */
  const setHaveAtHome = (haveAtHome: string[]) => setSettings({ ...settings, haveAtHome });

  const swap = (dayIndex: number, slot: Slot) => {
    setPlan((p) => swapMeal(p, dayIndex, slot, settings));
    setChecked([]);
  };

  const toggleChecked = (key: string) =>
    setChecked((c) => (c.includes(key) ? c.filter((k) => k !== key) : [...c, key]));

  const recipe = useMemo(() => (openRecipe ? getRecipe(openRecipe) : undefined), [openRecipe]);

  /**
   * 잘 먹는 메뉴와 뺀 메뉴는 서로 반대말이라 한쪽을 켜면 다른 쪽은 꺼 준다.
   * 별 하나 눌렀다고 이번 주 상을 통째로 바꾸면 놀라니, 식단은 그대로 두고
   * 뺀 메뉴가 이번 주에 올라 있을 때만 그 자리를 다른 메뉴로 갈아 끼운다.
   */
  const rate = (id: string, kind: 'favorites' | 'excluded') => {
    const other = kind === 'favorites' ? 'excluded' : 'favorites';
    const turningOn = !settings[kind].includes(id);
    const next: Settings = {
      ...settings,
      [kind]: turningOn ? [...settings[kind], id] : settings[kind].filter((x) => x !== id),
      [other]: settings[other].filter((x) => x !== id),
    };
    setSettings(next);

    if (kind === 'excluded' && turningOn) {
      setPlan((p) => {
        let updated = p;
        p.days.forEach((d, i) =>
          dayRecipeIds(d).forEach(({ slot, id: used }) => {
            if (used === id) updated = swapMeal(updated, i, slot, next);
          })
        );
        return updated;
      });
      setChecked([]);
    }
  };

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', minHeight: '100vh', background: C.bg }}>
      <main style={{ padding: `16px 16px ${TAB_BAR_HEIGHT + 24}px` }}>
        {view === 'plan' && (
          <PlanView
            plan={plan}
            settings={settings}
            onRegenerate={() => regenerate()}
            onSwap={swap}
            onPick={setOpenRecipe}
          />
        )}
        {view === 'fridge' && (
          <FridgeView
            settings={settings}
            onChangeHave={setHaveAtHome}
            onReplan={() => {
              regenerate(plan.seed);
              setView('plan');
            }}
            onPick={setOpenRecipe}
          />
        )}
        {view === 'shopping' && (
          <ShoppingView
            plan={plan}
            settings={settings}
            checked={checked}
            onToggle={toggleChecked}
            onClear={() => setChecked([])}
          />
        )}
        {view === 'balance' && <BalanceView plan={plan} />}
        {view === 'settings' && (
          <SettingsView settings={settings} onChange={changeSettings} onReset={reset} />
        )}
      </main>

      {recipe && (
        <RecipeSheet
          recipe={recipe}
          servings={settings.servings}
          favorite={settings.favorites.includes(recipe.id)}
          excluded={settings.excluded.includes(recipe.id)}
          onToggleFavorite={() => rate(recipe.id, 'favorites')}
          onToggleExcluded={() => rate(recipe.id, 'excluded')}
          onClose={() => setOpenRecipe(null)}
        />
      )}

      <TabBar active={view} onChange={setView} />
    </div>
  );
}

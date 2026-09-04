import React, { useEffect, useMemo, useState } from 'react';
import BalanceView from './components/BalanceView';
import PlanView from './components/PlanView';
import RecipeSheet from './components/RecipeSheet';
import SettingsView from './components/SettingsView';
import ShoppingView from './components/ShoppingView';
import TabBar, { TAB_BAR_HEIGHT } from './components/TabBar';
import { getRecipe } from './data/recipes';
import { DEFAULT_SETTINGS, Settings, Slot, View, WeekPlan } from './types';
import { generateWeek, swapMeal } from './utils/planner';
import { newSeed } from './utils/random';
import { KEYS, load, save } from './utils/storage';
import { C } from './theme';

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
  const [view, setView] = useState<View>('plan');
  const [openRecipe, setOpenRecipe] = useState<string | null>(null);

  useEffect(() => save(KEYS.settings, settings), [settings]);
  useEffect(() => save(KEYS.plan, plan), [plan]);
  useEffect(() => save(KEYS.checked, checked), [checked]);

  const regenerate = (seed = newSeed(), next = settings) => {
    setPlan(generateWeek(seed, next));
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
    regenerate(newSeed(), DEFAULT_SETTINGS);
    setView('plan');
  };

  const swap = (dayIndex: number, slot: Slot) => {
    setPlan((p) => swapMeal(p, dayIndex, slot, settings));
    setChecked([]);
  };

  const toggleChecked = (key: string) =>
    setChecked((c) => (c.includes(key) ? c.filter((k) => k !== key) : [...c, key]));

  const recipe = useMemo(() => (openRecipe ? getRecipe(openRecipe) : undefined), [openRecipe]);

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
        <RecipeSheet recipe={recipe} servings={settings.servings} onClose={() => setOpenRecipe(null)} />
      )}

      <TabBar active={view} onChange={setView} />
    </div>
  );
}

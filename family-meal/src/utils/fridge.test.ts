import { getRecipe, RECIPES } from '../data/recipes';
import { DEFAULT_SETTINGS, Settings } from '../types';
import { matchRecipe, matchRecipes } from './fridge';

test('재료를 안 넣으면 아무것도 추천하지 않는다', () => {
  expect(matchRecipes([], DEFAULT_SETTINGS)).toEqual([]);
});

test('살 것이 적은 메뉴가 먼저 나온다', () => {
  const list = matchRecipes(['달걀', '대파', '당근'], DEFAULT_SETTINGS);
  expect(list.length).toBeGreaterThan(0);
  for (let i = 1; i < list.length; i++) {
    expect(list[i].missing.length).toBeGreaterThanOrEqual(list[i - 1].missing.length);
  }
});

test('가진 재료가 하나도 안 들어가는 메뉴는 빼고 준다', () => {
  matchRecipes(['두부'], DEFAULT_SETTINGS).forEach((m) => expect(m.have).toBeGreaterThan(0));
});

test('재료가 다 있으면 살 것이 없다고 한다', () => {
  const 삼치 = getRecipe('m-samchi')!;
  // 삼치구이는 삼치와 레몬만 있으면 된다 (소금·기름은 상비 양념).
  const m = matchRecipe(삼치, ['손질 삼치', '레몬']);
  expect(m.missing).toEqual([]);
  expect(m.have).toBe(m.total);
});

test('쌀과 밥은 적지 않아도 있는 것으로 본다', () => {
  const 볶음밥 = getRecipe('o-shrimpfried')!;
  expect(matchRecipe(볶음밥, ['칵테일 새우']).missing).not.toContain('밥');
  const 닭죽 = getRecipe('o-dakjuk')!;
  expect(matchRecipe(닭죽, ['닭안심']).missing).not.toContain('쌀');
});

test('양념은 사야 할 것으로 세지 않는다', () => {
  RECIPES.forEach((r) => {
    const pantryNames = r.ingredients.filter((i) => i.pantry).map((i) => i.name);
    const m = matchRecipe(r, ['양파']);
    pantryNames.forEach((n) => expect(m.missing).not.toContain(n));
  });
});

test('알레르기로 뺀 재료가 든 메뉴는 추천하지 않는다', () => {
  const settings: Settings = { ...DEFAULT_SETTINGS, avoid: ['새우'] };
  matchRecipes(['칵테일 새우', '양파', '당근'], settings).forEach((m) =>
    expect(m.recipe.allergens).not.toContain('새우')
  );
});

test('매운 메뉴 빼기와 안 먹는 메뉴 설정을 그대로 지킨다', () => {
  const settings: Settings = {
    ...DEFAULT_SETTINGS,
    noSpicy: true,
    excluded: ['m-bulgogi'],
  };
  const list = matchRecipes(['양파', '대파', '소고기'], settings);
  list.forEach((m) => expect(m.recipe.spicy).toBeFalsy());
  expect(list.map((m) => m.recipe.id)).not.toContain('m-bulgogi');
});

test('한 자리만 골라 볼 수 있다', () => {
  matchRecipes(['달걀', '대파'], DEFAULT_SETTINGS, 'soup').forEach((m) =>
    expect(m.recipe.slot).toBe('soup')
  );
});

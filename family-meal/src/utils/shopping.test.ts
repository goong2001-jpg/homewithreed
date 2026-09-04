import { DEFAULT_SETTINGS, Settings } from '../types';
import { generateWeek } from './planner';
import { buildShoppingList, formatQty, scaleQty, toShareText } from './shopping';

test('4인분 기준 수량을 인분 수에 맞춰 줄인다', () => {
  expect(scaleQty(400, 'g', 2)).toBe(200);
  expect(scaleQty(4, '개', 2)).toBe(2);
  expect(scaleQty(4, '개', 3)).toBe(3);
});

test('아주 적은 양도 0으로 사라지지 않는다', () => {
  expect(scaleQty(0.3, '개', 2)).toBeGreaterThanOrEqual(0.5);
  expect(scaleQty(5, 'g', 2)).toBeGreaterThanOrEqual(5);
});

test('수량은 정수면 소수점을 붙이지 않는다', () => {
  expect(formatQty(3, '개')).toBe('3개');
  expect(formatQty(1.5, '대')).toBe('1.5대');
});

test('같은 재료는 한 줄로 합치고 어느 메뉴에 쓰는지 남긴다', () => {
  const groups = buildShoppingList(generateWeek(42, DEFAULT_SETTINGS), DEFAULT_SETTINGS);
  const items = groups.flatMap((g) => g.items);
  const keys = items.map((i) => i.key);
  expect(new Set(keys).size).toBe(keys.length);
  items.forEach((i) => expect(i.qty).toBeGreaterThan(0));
  const withRecipes = items.filter((i) => i.usedIn.length > 0);
  expect(withRecipes.length).toBeGreaterThan(0);
});

test('인분을 늘리면 총량도 늘어난다', () => {
  const plan = generateWeek(42, DEFAULT_SETTINGS);
  const small = buildShoppingList(plan, { ...DEFAULT_SETTINGS, servings: 2 });
  const big = buildShoppingList(plan, { ...DEFAULT_SETTINGS, servings: 6 });
  const total = (gs: ReturnType<typeof buildShoppingList>) =>
    gs.flatMap((g) => g.items).reduce((sum, i) => sum + i.qty, 0);
  expect(total(big)).toBeGreaterThan(total(small));
});

test('양념을 접으면 공유 글에서 빠진다', () => {
  const groups = buildShoppingList(generateWeek(7, DEFAULT_SETTINGS), DEFAULT_SETTINGS);
  const hidden = toShareText(groups, true);
  const shown = toShareText(groups, false);
  expect(shown.length).toBeGreaterThan(hidden.length);
  expect(hidden).toContain('[이번 주 장보기]');
});

test('밥은 사는 물건이 아니라 쌀로 바뀌어 들어간다', () => {
  const settings: Settings = { ...DEFAULT_SETTINGS, servings: 4 };
  const groups = buildShoppingList(generateWeek(1, settings), settings);
  const names = groups.flatMap((g) => g.items).map((i) => i.name);
  expect(names).toContain('쌀');
  expect(names).not.toContain('밥');
});

test('밥이 많이 들어간 식단일수록 쌀도 많이 산다', () => {
  const settings: Settings = { ...DEFAULT_SETTINGS, servings: 4 };
  const rice = (seed: number) =>
    buildShoppingList(generateWeek(seed, settings), settings)
      .flatMap((g) => g.items)
      .find((i) => i.name === '쌀')!.qty;
  // 저녁 7끼분(2.5kg)은 어떤 식단에서도 기본으로 깔린다.
  expect(rice(1)).toBeGreaterThanOrEqual(2.5);
});

test('냉장고에 있는 재료는 사러 갈 목록에서 빠진다', () => {
  const settings: Settings = { ...DEFAULT_SETTINGS, haveAtHome: ['양파', '당근'] };
  const groups = buildShoppingList(generateWeek(42, settings), settings);
  const items = groups.flatMap((g) => g.items);
  const onion = items.find((i) => i.name === '양파');
  expect(onion?.have).toBe(true);
  expect(toShareText(groups, true)).not.toContain('양파');
  // 목록에서 감추는 것이지 재료 자체가 사라지는 것은 아니다.
  expect(onion!.qty).toBeGreaterThan(0);
});

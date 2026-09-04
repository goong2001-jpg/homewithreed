import { getRecipe } from '../data/recipes';
import { DEFAULT_SETTINGS, Settings } from '../types';
import { generateWeek, planRecipeIds } from './planner';

const SEEDS = [1, 7, 42, 1234, 98765, 2468013];

test('같은 씨앗과 같은 설정이면 같은 식단이 나온다', () => {
  const a = generateWeek(42, DEFAULT_SETTINGS);
  const b = generateWeek(42, DEFAULT_SETTINGS);
  expect(planRecipeIds(a)).toEqual(planRecipeIds(b));
});

test('씨앗이 다르면 식단이 달라진다', () => {
  const a = planRecipeIds(generateWeek(1, DEFAULT_SETTINGS)).join(',');
  const b = planRecipeIds(generateWeek(2, DEFAULT_SETTINGS)).join(',');
  expect(a).not.toEqual(b);
});

test('일주일은 7일이고 하루에 다섯 자리가 모두 찬다', () => {
  const plan = generateWeek(3, DEFAULT_SETTINGS);
  expect(plan.days).toHaveLength(7);
  plan.days.forEach((d) => {
    [d.breakfast, d.lunch, d.soup, d.main, d.side].forEach((id) => {
      expect(getRecipe(id)).toBeDefined();
    });
  });
});

test('제외한 알레르기 재료가 들어간 메뉴는 어떤 씨앗에서도 나오지 않는다', () => {
  const settings: Settings = { ...DEFAULT_SETTINGS, avoid: ['새우', '우유'] };
  SEEDS.forEach((seed) => {
    planRecipeIds(generateWeek(seed, settings)).forEach((id) => {
      const r = getRecipe(id)!;
      expect(r.allergens).not.toContain('새우');
      expect(r.allergens).not.toContain('우유');
    });
  });
});

test('매운 메뉴 빼기를 켜면 매운 메뉴가 하나도 없다', () => {
  const settings: Settings = { ...DEFAULT_SETTINGS, noSpicy: true };
  SEEDS.forEach((seed) => {
    planRecipeIds(generateWeek(seed, settings)).forEach((id) => {
      expect(getRecipe(id)!.spicy).toBeFalsy();
    });
  });
});

test('저녁 메인과 점심 한 그릇은 일주일 안에 겹치지 않는다', () => {
  SEEDS.forEach((seed) => {
    const plan = generateWeek(seed, DEFAULT_SETTINGS);
    const mains = plan.days.map((d) => d.main);
    const lunches = plan.days.map((d) => d.lunch);
    expect(new Set(mains).size).toBe(7);
    expect(new Set(lunches).size).toBe(7);
  });
});

test('같은 국이 이틀 연속 나오지 않는다', () => {
  SEEDS.forEach((seed) => {
    const plan = generateWeek(seed, DEFAULT_SETTINGS);
    for (let i = 1; i < plan.days.length; i++) {
      expect(plan.days[i].soup).not.toBe(plan.days[i - 1].soup);
    }
  });
});

test('조리 시간을 아주 짧게 잡아도 식단은 만들어진다', () => {
  const settings: Settings = { ...DEFAULT_SETTINGS, maxMinutes: 10 };
  const plan = generateWeek(11, settings);
  expect(plan.days).toHaveLength(7);
  planRecipeIds(plan).forEach((id) => expect(getRecipe(id)).toBeDefined());
});

test('알레르기를 많이 제외해도 빈자리 없이 채운다', () => {
  const settings: Settings = {
    ...DEFAULT_SETTINGS,
    avoid: ['새우', '견과', '돼지고기'],
    noSpicy: true,
  };
  const plan = generateWeek(5, settings);
  plan.days.forEach((d) => {
    [d.breakfast, d.lunch, d.soup, d.main, d.side].forEach((id) => expect(id).toBeTruthy());
  });
});

test('같은 날 점심·국·메인의 단백질원이 겹치는 날은 주 1회를 넘지 않는다', () => {
  for (let i = 0; i < 40; i++) {
    const plan = generateWeek(i * 13 + 7, DEFAULT_SETTINGS);
    const dupDays = plan.days.filter((d) => {
      const proteins = [d.lunch, d.soup, d.main]
        .map((id) => getRecipe(id)!.protein)
        .filter((p) => p !== 'none');
      return new Set(proteins).size < proteins.length;
    }).length;
    expect(dupDays).toBeLessThanOrEqual(1);
  }
});

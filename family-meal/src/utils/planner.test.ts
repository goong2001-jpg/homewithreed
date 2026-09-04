import { getRecipe, RECIPES } from '../data/recipes';
import { DEFAULT_SETTINGS, Settings } from '../types';
import { cookedRecipeIds, generateWeek, planRecipeIds } from './planner';

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

test('같은 날 점심·국·메인의 단백질원이 겹치는 날은 주 2회를 넘지 않는다', () => {
  for (let i = 0; i < 40; i++) {
    const plan = generateWeek(i * 13 + 7, DEFAULT_SETTINGS);
    const dupDays = plan.days.filter((d) => {
      const proteins = [d.lunch, d.soup, d.main]
        .map((id) => getRecipe(id)!.protein)
        .filter((p) => p !== 'none');
      return new Set(proteins).size < proteins.length;
    }).length;
    expect(dupDays).toBeLessThanOrEqual(2);
  }
});

test('안 먹는다고 뺀 메뉴는 추천에 나오지 않는다', () => {
  const settings: Settings = {
    ...DEFAULT_SETTINGS,
    excluded: ['m-bulgogi', 's-kimchijjigae', 'o-curry', 'd-myeolchi'],
  };
  SEEDS.forEach((seed) => {
    const ids = planRecipeIds(generateWeek(seed, settings));
    settings.excluded.forEach((id) => expect(ids).not.toContain(id));
  });
});

test('한 자리의 메뉴를 전부 빼 버려도 빈자리 없이 채운다', () => {
  const allSoups = RECIPES.filter((r) => r.slot === 'soup').map((r) => r.id);
  const plan = generateWeek(9, { ...DEFAULT_SETTINGS, excluded: allSoups });
  plan.days.forEach((d) => expect(getRecipe(d.soup)).toBeDefined());
});

test('잘 먹는다고 표시한 메뉴는 그 주에 반드시 올라온다', () => {
  const settings: Settings = { ...DEFAULT_SETTINGS, favorites: ['m-bulgogi', 'o-curry'] };
  SEEDS.forEach((seed) => {
    const ids = planRecipeIds(generateWeek(seed, settings));
    expect(ids).toContain('m-bulgogi');
    expect(ids).toContain('o-curry');
  });
});

test('냉장고에 있는 재료를 쓰는 메뉴가 더 많이 뽑힌다', () => {
  const have = ['두부', '애호박'];
  const countUsing = (settings: Settings) => {
    let used = 0;
    for (let seed = 0; seed < 20; seed++) {
      planRecipeIds(generateWeek(seed * 31 + 5, settings)).forEach((id) => {
        const r = getRecipe(id)!;
        if (r.ingredients.some((i) => have.includes(i.name))) used += 1;
      });
    }
    return used;
  };
  const before = countUsing(DEFAULT_SETTINGS);
  const after = countUsing({ ...DEFAULT_SETTINGS, haveAtHome: have });
  expect(after).toBeGreaterThan(before);
});

test('지난 주에 올렸던 메뉴는 이번 주에 거의 나오지 않는다', () => {
  let recent: string[] = [];
  let prev: string[] = [];
  let worst = 0;
  for (let week = 0; week < 20; week++) {
    const ids = Array.from(new Set(planRecipeIds(generateWeek(week * 137 + 11, DEFAULT_SETTINGS, recent))));
    if (week > 0) worst = Math.max(worst, ids.filter((id) => prev.includes(id)).length);
    prev = ids;
    recent = Array.from(new Set(ids.concat(recent))).slice(0, 90);
  }
  // 한 주에 스물다섯 가지쯤 오르는데, 지난 주와 겹치는 건 많아야 서너 개여야 한다.
  expect(worst).toBeLessThanOrEqual(4);
});

test('장보기 줄이기를 켜면 반찬은 이틀씩, 아침은 네 가지로 돈다', () => {
  const plan = generateWeek(21, { ...DEFAULT_SETTINGS, saveShopping: true });
  expect(plan.days.map((d) => d.side)).toEqual([
    plan.days[0].side,
    plan.days[0].side,
    plan.days[2].side,
    plan.days[2].side,
    plan.days[4].side,
    plan.days[4].side,
    plan.days[6].side,
  ]);
  expect(plan.days.map((d) => !!d.reusedSide)).toEqual([false, true, false, true, false, true, false]);
  expect(new Set(plan.days.map((d) => d.breakfast)).size).toBe(4);
});

test('장보기 줄이기를 끄면 반찬도 아침도 매일 새로 만든다', () => {
  const plan = generateWeek(21, { ...DEFAULT_SETTINGS, saveShopping: false });
  expect(plan.days.every((d) => !d.reusedSide && !d.reusedBreakfast)).toBe(true);
  expect(new Set(plan.days.map((d) => d.side)).size).toBe(7);
});

test('만들어 둔 반찬을 먹는 날은 그날 만드는 목록에서 빠진다', () => {
  const plan = generateWeek(21, { ...DEFAULT_SETTINGS, saveShopping: true });
  plan.days.forEach((d) => {
    const cooked = cookedRecipeIds(d).map((r) => r.slot);
    expect(cooked.includes('side')).toBe(!d.reusedSide);
  });
});

test('매운 메뉴는 주 2회를 넘지 않는다', () => {
  for (let i = 0; i < 30; i++) {
    const plan = generateWeek(i * 53 + 9, DEFAULT_SETTINGS);
    const spicy = planRecipeIds(plan).filter((id) => getRecipe(id)!.spicy).length;
    expect(spicy).toBeLessThanOrEqual(2);
  }
});

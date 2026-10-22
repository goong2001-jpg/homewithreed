import { RECIPES } from './recipes';

/** 재료 이름 → 그 재료가 들어가면 반드시 적어야 하는 알레르기 항목 */
const IMPLIES: Record<string, '생선' | '밀'> = {
  멸치육수팩: '생선',
  부침가루: '밀',
  밀가루: '밀',
  튀김가루: '밀',
};

test('멸치육수팩·밀가루류가 들어간 메뉴는 알레르기 항목을 빠뜨리지 않는다', () => {
  const missing: string[] = [];
  RECIPES.forEach((r) => {
    r.ingredients.forEach((i) => {
      const need = IMPLIES[i.name];
      if (need && !r.allergens.includes(need)) missing.push(`${r.id}: ${i.name} → ${need}`);
    });
  });
  expect(missing).toEqual([]);
});

test('레시피 id 는 겹치지 않고 아기 팁이 전부 있다', () => {
  const ids = RECIPES.map((r) => r.id);
  expect(new Set(ids).size).toBe(ids.length);
  RECIPES.forEach((r) => expect(r.babyTip.length).toBeGreaterThan(0));
});

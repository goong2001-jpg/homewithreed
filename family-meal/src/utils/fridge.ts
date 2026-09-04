import { RECIPES } from '../data/recipes';
import { Recipe, Settings, Slot } from '../types';
import { isAtHome } from './ingredients';

/** 쌀과 밥은 어느 집에나 있다. 냉장고에 적지 않아도 있는 것으로 본다. */
const ALWAYS_HOME = ['쌀', '밥'];

export interface FridgeMatch {
  recipe: Recipe;
  /** 집에 있는 재료 수 (양념 제외) */
  have: number;
  /** 이 메뉴에 필요한 재료 수 (양념 제외) */
  total: number;
  /** 사야 하는 재료 이름 */
  missing: string[];
}

/** 양념과 상비 곡물을 뺀, 실제로 갖고 있어야 하는 재료 */
function realIngredients(r: Recipe): string[] {
  return r.ingredients.filter((i) => !i.pantry && !ALWAYS_HOME.includes(i.name)).map((i) => i.name);
}

export function matchRecipe(r: Recipe, haveList: string[]): FridgeMatch {
  const names = realIngredients(r);
  const missing = names.filter((n) => !isAtHome(haveList, n));
  return { recipe: r, have: names.length - missing.length, total: names.length, missing };
}

/**
 * 집에 있는 재료로 만들 수 있는 메뉴를, 사야 할 것이 적은 순서로 준다.
 * 알레르기·매운맛·뺀 메뉴 설정은 여기서도 그대로 지킨다.
 */
export function matchRecipes(haveList: string[], settings: Settings, slot?: Slot): FridgeMatch[] {
  if (haveList.length === 0) return [];
  return RECIPES.filter((r) => {
    if (slot && r.slot !== slot) return false;
    if (settings.excluded.includes(r.id)) return false;
    if (r.allergens.some((a) => settings.avoid.includes(a))) return false;
    if (settings.noSpicy && r.spicy) return false;
    return true;
  })
    .map((r) => matchRecipe(r, haveList))
    // 가진 재료가 하나도 안 쓰이는 메뉴는 "냉장고 털기"와 상관이 없다.
    .filter((m) => m.have > 0)
    .sort(
      (a, b) =>
        a.missing.length - b.missing.length ||
        b.have - a.have ||
        a.recipe.minutes - b.recipe.minutes ||
        a.recipe.name.localeCompare(b.recipe.name, 'ko')
    );
}

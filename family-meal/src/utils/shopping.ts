import { getRecipe } from '../data/recipes';
import { Aisle, AISLE_ORDER, Ingredient, Settings, WeekPlan } from '../types';
import { planRecipeIds } from './planner';

export interface ShopItem {
  /** 이름+단위. 체크 상태를 저장하는 키로도 쓴다. */
  key: string;
  name: string;
  qty: number;
  unit: string;
  aisle: Aisle;
  pantry: boolean;
  /** 이 재료가 들어가는 메뉴 이름들 */
  usedIn: string[];
}

export interface AisleGroup {
  aisle: Aisle;
  items: ShopItem[];
}

/** 밥 한 공기를 짓는 데 드는 생쌀. 장보기에서는 '밥'이 아니라 '쌀'을 사야 한다. */
const RICE_PER_BOWL_KG = 0.09;

/** 레시피에는 안 적혀 있지만 일주일 내내 필요한 것 */
const BASE_ITEMS: Ingredient[] = [
  // 저녁 7끼분 밥
  { name: '쌀', qty: 4 * 7 * RICE_PER_BOWL_KG, unit: 'kg', aisle: '쌀·면·가공' },
];

/**
 * 4인분 기준 수량을 설정한 인분 수로 줄이고 늘린다.
 * 계량하다 지치지 않도록 어중간한 소수는 눈에 익은 값으로 반올림한다.
 */
export function scaleQty(qty: number, unit: string, servings: number): number {
  const scaled = qty * (servings / 4);
  if (unit === 'g' || unit === 'ml') {
    if (scaled >= 100) return Math.round(scaled / 10) * 10;
    if (scaled >= 20) return Math.round(scaled / 5) * 5;
    return Math.max(5, Math.round(scaled));
  }
  if (unit === 'kg') return Math.max(0.1, Math.round(scaled * 10) / 10);
  // 개·모·대·장처럼 세는 단위는 0.5 단위로 끊는다.
  return Math.max(0.5, Math.round(scaled * 2) / 2);
}

export function formatQty(qty: number, unit: string): string {
  const text = Number.isInteger(qty) ? String(qty) : qty.toFixed(1);
  return `${text}${unit}`;
}

/**
 * 일주일 식단에 들어가는 재료를 전부 더해 코너별로 묶는다.
 * 같은 재료라도 단위가 다르면(예: 두부 '모' vs 'g') 합치지 않고 따로 둔다.
 */
export function buildShoppingList(plan: WeekPlan, settings: Settings): AisleGroup[] {
  const merged = new Map<string, ShopItem>();

  const add = (raw: Ingredient, from: string | null) => {
    // 밥은 사는 물건이 아니다. 필요한 공기 수만큼 쌀로 바꿔 담는다.
    const ing: Ingredient =
      raw.name === '밥'
        ? { name: '쌀', qty: raw.qty * RICE_PER_BOWL_KG, unit: 'kg', aisle: '쌀·면·가공' }
        : raw;
    const key = `${ing.name}|${ing.unit}`;
    const found = merged.get(key);
    if (found) {
      found.qty += ing.qty;
      if (from && !found.usedIn.includes(from)) found.usedIn.push(from);
      return;
    }
    merged.set(key, {
      key,
      name: ing.name,
      qty: ing.qty,
      unit: ing.unit,
      aisle: ing.aisle,
      pantry: !!ing.pantry,
      usedIn: from ? [from] : [],
    });
  };

  BASE_ITEMS.forEach((i) => add(i, null));
  for (const id of planRecipeIds(plan)) {
    const recipe = getRecipe(id);
    if (!recipe) continue;
    recipe.ingredients.forEach((ing) => add(ing, recipe.name));
  }

  // 인분 조정은 다 더한 뒤 한 번만 한다. 재료마다 반올림하면 오차가 쌓인다.
  const items = Array.from(merged.values()).map((item) => ({
    ...item,
    qty: scaleQty(item.qty, item.unit, settings.servings),
  }));

  return AISLE_ORDER.map((aisle) => ({
    aisle,
    items: items.filter((i) => i.aisle === aisle).sort((a, b) => a.name.localeCompare(b.name, 'ko')),
  })).filter((g) => g.items.length > 0);
}

/** 장보기 목록을 카톡이나 메모장에 붙여 넣을 수 있는 글로 만든다. */
export function toShareText(groups: AisleGroup[], hidePantry: boolean): string {
  const lines: string[] = ['[이번 주 장보기]'];
  for (const g of groups) {
    const items = g.items.filter((i) => !(hidePantry && i.pantry));
    if (items.length === 0) continue;
    lines.push('', `■ ${g.aisle}`);
    items.forEach((i) => lines.push(`- ${i.name} ${formatQty(i.qty, i.unit)}`));
  }
  return lines.join('\n');
}

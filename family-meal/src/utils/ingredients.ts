import { Recipe } from '../types';

/**
 * 냉장고에 있는 걸 적을 때 쓰는 말과 레시피에 적힌 이름이 다른 경우.
 * "닭고기"라고 적으면 닭안심·닭다리가 다 걸려야 한다.
 */
const ALIASES: Record<string, string[]> = {
  닭고기: ['닭안심', '닭다리', '닭볶음탕용 닭'],
  생선: ['삼치', '고등어', '연어', '흰살생선'],
  새우: ['칵테일 새우'],
  치즈: ['슬라이스 치즈', '모짜렐라 치즈볼', '파마산 치즈가루'],
  김치: ['배추김치', '신김치'],
  어묵: ['사각어묵'],
};

/** 설정 화면에서 한 번에 누를 수 있는 재료. 우리 집 냉장고에 흔한 것들. */
export const QUICK_PICKS = [
  '양파',
  '대파',
  '당근',
  '감자',
  '애호박',
  '달걀',
  '두부',
  '우유',
  '소고기',
  '돼지고기',
  '닭고기',
  '콩나물',
  '브로콜리',
  '시금치',
  '오이',
  '방울토마토',
  '김치',
  '치즈',
];

/** "소 고기" 와 "소고기"를 같은 것으로 보기 위해 공백을 지운다. */
function normalize(name: string): string {
  return name.replace(/\s+/g, '');
}

/**
 * 냉장고에 있다고 적어 둔 것과 레시피 재료가 같은 것인지 본다.
 * "소고기"라고만 적어도 '소고기 국거리'·'소고기 다짐육'이 다 걸리도록
 * 양쪽 방향의 부분 일치를 인정한다.
 */
export function matchesAtHome(have: string, ingredientName: string): boolean {
  const a = normalize(have);
  const b = normalize(ingredientName);
  if (a.length < 2 || b.length === 0) return false;
  if (b.includes(a) || a.includes(b)) return true;
  return (ALIASES[have] ?? []).some((alias) => b.includes(normalize(alias)));
}

export function isAtHome(haveList: string[], ingredientName: string): boolean {
  return haveList.some((h) => matchesAtHome(h, ingredientName));
}

/** 이 레시피 재료 중 냉장고에 이미 있는 것이 몇 개인지 (양념은 세지 않는다) */
export function countAtHome(recipe: Recipe, haveList: string[]): number {
  if (haveList.length === 0) return 0;
  return recipe.ingredients.filter((i) => !i.pantry && isAtHome(haveList, i.name)).length;
}



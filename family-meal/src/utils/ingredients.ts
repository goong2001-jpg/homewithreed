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

/** "소 고기"와 "소고기"를 같은 것으로 보기 위해 공백을 지운다. */
function squash(name: string): string {
  return name.replace(/\s+/g, '');
}

/**
 * 냉장고에 적어 둔 것과 레시피 재료가 같은 것인지 본다.
 *
 * 단순 부분 일치는 쓰지 않는다 — "두부"가 "순두부"까지 잡아서
 * 순두부가 없는데도 "바로 만들 수 있다"고 말해 버린다.
 * 대신 재료 이름을 낱말로 쪼개, 낱말과 **같거나 그 낱말이 시작되는** 경우만 인정한다.
 *   소고기 → '소고기 국거리'·'불고기용 소고기' ○ / 두부 → '순두부' ×
 * 한 글자짜리(무 등)는 딱 맞을 때만 인정한다. '파'가 '대파'를 잡으면 곤란하다.
 */
export function matchesAtHome(have: string, ingredientName: string): boolean {
  const target = squash(ingredientName);
  if (target.length === 0) return false;

  // "소고기 다짐육"처럼 길게 적었을 때도 첫 낱말로 걸리게 한다.
  // 뒷낱말은 '다짐육'·'국거리' 같은 부위라서 쓰지 않는다 —
  // 그걸 쓰면 소고기 다짐육이 돼지고기 다짐육까지 잡는다.
  const first = have.trim().split(/\s+/)[0] ?? '';
  const keys = [squash(have), squash(first)].filter((k) => k.length > 0);
  const words = [target, ...ingredientName.trim().split(/\s+/).map(squash)];

  for (const key of keys) {
    for (const word of words) {
      if (word === key) return true;
      if (key.length >= 2 && word.startsWith(key)) return true;
    }
  }
  return (ALIASES[have] ?? []).some((alias) => target.includes(squash(alias)));
}

export function isAtHome(haveList: string[], ingredientName: string): boolean {
  return haveList.some((h) => matchesAtHome(h, ingredientName));
}

/** 이 레시피 재료 중 냉장고에 이미 있는 것이 몇 개인지 (양념은 세지 않는다) */
export function countAtHome(recipe: Recipe, haveList: string[]): number {
  if (haveList.length === 0) return 0;
  return recipe.ingredients.filter((i) => !i.pantry && isAtHome(haveList, i.name)).length;
}



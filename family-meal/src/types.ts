/** 식단·레시피·장보기 전체가 공유하는 타입 */

/** 마트에서 도는 코너 순서대로. 장보기 목록을 이 순서로 묶는다. */
export type Aisle = '채소·과일' | '정육' | '수산' | '유제품·달걀' | '쌀·면·가공' | '양념·기타';

export const AISLE_ORDER: Aisle[] = [
  '채소·과일',
  '정육',
  '수산',
  '유제품·달걀',
  '쌀·면·가공',
  '양념·기타',
];

/** 주간 단백질 로테이션의 기준. 'none' 은 채소 위주 반찬. */
export type Protein = 'beef' | 'pork' | 'chicken' | 'fish' | 'shrimp' | 'egg' | 'bean' | 'none';

export const PROTEIN_LABEL: Record<Protein, string> = {
  beef: '소고기',
  pork: '돼지고기',
  chicken: '닭고기',
  fish: '생선',
  shrimp: '새우',
  egg: '달걀',
  bean: '콩·두부',
  none: '채소',
};

/** 우리 집에서 실제로 걸러야 하는 것만 추렸다. */
export type Allergen = '우유' | '달걀' | '밀' | '견과' | '새우' | '생선' | '대두' | '돼지고기';

export const ALLERGENS: Allergen[] = ['우유', '달걀', '밀', '견과', '새우', '생선', '대두', '돼지고기'];

/** 하루 세 끼에서 이 레시피가 앉는 자리 */
export type Slot = 'breakfast' | 'onedish' | 'soup' | 'main' | 'side';

export const SLOT_LABEL: Record<Slot, string> = {
  breakfast: '아침',
  onedish: '점심 한 그릇',
  soup: '국·찌개',
  main: '메인 반찬',
  side: '곁들임',
};

export interface Ingredient {
  name: string;
  /** 4인분 기준 수량. 인분 설정에 따라 앱이 비율로 줄이고 늘린다. */
  qty: number;
  unit: string;
  aisle: Aisle;
  /** 집에 늘 있는 양념. 장보기 목록에서 따로 묶어 보여준다. */
  pantry?: boolean;
}

export interface Recipe {
  id: string;
  name: string;
  slot: Slot;
  /** 손질부터 상에 올리기까지 걸리는 시간(분) */
  minutes: number;
  /** 1 = 섞기만 하면 됨, 2 = 볶고 끓임, 3 = 손이 좀 감 */
  ease: 1 | 2 | 3;
  protein: Protein;
  /** 채소 점수. 0 = 없음, 1 = 곁들임 수준, 2 = 채소가 주인공 */
  veg: 0 | 1 | 2;
  /** 우유·치즈·멸치·두부처럼 칼슘이 실제로 들어가는 메뉴 */
  calcium?: boolean;
  /** 아이가 먹기 매운 메뉴. 없으면 안 맵다는 뜻이다. */
  spicy?: boolean;
  allergens: Allergen[];
  ingredients: Ingredient[];
  steps: string[];
  /** 16개월 아기용 변형 — 모든 레시피에 반드시 있다 */
  babyTip: string;
  /** 7살이 잘 안 먹을 때 쓰는 요령 */
  kidTip?: string;
}

export interface Settings {
  /** 몇 인분으로 계산할지. 어른 2 + 7살 + 아기면 3인분 정도가 맞다. */
  servings: number;
  /** 이 재료가 들어간 메뉴는 아예 추천하지 않는다 */
  avoid: Allergen[];
  /** 매운 메뉴 빼기 */
  noSpicy: boolean;
  /** 한 메뉴에 쓸 수 있는 최대 조리 시간(분) */
  maxMinutes: number;
  /** 이미 갖고 있는 양념을 장보기 목록에서 접어둘지 */
  hidePantry: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  servings: 3,
  avoid: [],
  noSpicy: false,
  maxMinutes: 40,
  hidePantry: true,
};

export interface DayPlan {
  /** 0 = 월요일 */
  day: number;
  breakfast: string;
  lunch: string;
  soup: string;
  main: string;
  side: string;
}

export interface WeekPlan {
  /** 이 식단을 만든 난수 씨앗. 같은 씨앗 + 같은 설정이면 같은 식단이 나온다. */
  seed: number;
  createdAt: string;
  days: DayPlan[];
}

export type View = 'plan' | 'shopping' | 'balance' | 'settings';

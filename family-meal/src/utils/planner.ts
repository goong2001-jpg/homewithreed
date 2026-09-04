import { RECIPES } from '../data/recipes';
import { DayPlan, Recipe, Settings, Slot, WeekPlan } from '../types';
import { countAtHome } from './ingredients';
import { makeRng } from './random';

export const DAY_NAMES = ['월', '화', '수', '목', '금', '토', '일'];

/** 같은 메뉴가 며칠 안에 다시 나오지 않게 할지 (슬롯별) */
const MIN_GAP: Record<Slot, number> = {
  breakfast: 3,
  onedish: 7,
  soup: 4,
  main: 7,
  side: 3,
};

/**
 * 설정에 맞는 후보만 남긴다.
 * 알레르기와 매운맛은 절대 조건이고, 조리 시간은 후보가 모자라면 뒤에서 풀어 준다.
 */
export function candidates(slot: Slot, settings: Settings, maxMinutes: number): Recipe[] {
  return RECIPES.filter((r) => {
    if (r.slot !== slot) return false;
    if (settings.excluded.includes(r.id)) return false;
    if (r.allergens.some((a) => settings.avoid.includes(a))) return false;
    if (settings.noSpicy && r.spicy) return false;
    return r.minutes <= maxMinutes;
  });
}

/**
 * 조리 시간 제한 때문에 후보가 바닥나면 10분씩 늘려 가며 다시 찾는다.
 * 알레르기·매운맛 조건은 절대 풀지 않는다.
 */
function pool(slot: Slot, settings: Settings): Recipe[] {
  for (let limit = settings.maxMinutes; limit <= 120; limit += 10) {
    const found = candidates(slot, settings, limit);
    if (found.length > 0) return found;
  }
  const anyTime = candidates(slot, settings, Infinity);
  if (anyTime.length > 0) return anyTime;
  // 뺀 메뉴가 너무 많아 한 자리가 통째로 비면 빈 상을 내는 것보다는 낫다.
  return candidates(slot, { ...settings, excluded: [] }, Infinity);
}

interface Ctx {
  /** 레시피 id -> 마지막으로 나온 날 */
  lastUsed: Map<string, number>;
  /** 단백질원 -> 이번 주에 쓴 횟수 (국·메인 기준) */
  proteinCount: Map<string, number>;
  fishCount: number;
  calciumCount: number;
  spicyCount: number;
  /** 오늘 저녁(국·메인·곁들임)에 이미 잡아 둔 조리 시간 */
  dinnerMinutes: number;
  /** 오늘 이미 쓴 단백질원 */
  dayProteins: Set<string>;
  /** 오늘 이미 쓴 주재료(각 레시피의 첫 재료) */
  dayHeads: Set<string>;
  /** 오늘 지금까지 쌓인 채소 점수 */
  dayVeg: number;
  /** 어제 저녁 메인의 단백질원 */
  prevMainProtein?: string;
}

function score(r: Recipe, day: number, slot: Slot, ctx: Ctx, rng: () => number, settings: Settings): number {
  let s = rng() * 10;

  // 식구들이 잘 먹는다고 표시한 메뉴는 확실히 앞에 세운다.
  if (settings.favorites.includes(r.id)) s += 25;

  // 냉장고에 있는 재료를 쓰는 메뉴일수록 장바구니가 가벼워진다.
  s += countAtHome(r, settings.haveAtHome) * 7;

  const last = ctx.lastUsed.get(r.id);
  if (last !== undefined) {
    const gap = day - last;
    // 간격 안에 다시 나오는 건 크게 깎는다. 후보가 정말 없으면 결국 이 중에서 뽑힌다.
    s -= gap < MIN_GAP[slot] ? 200 - gap * 10 : 5;
  }

  if (slot === 'soup' || slot === 'main') {
    const used = ctx.proteinCount.get(r.protein) ?? 0;
    s -= used * 8;
    if (r.protein !== 'none' && r.protein === ctx.prevMainProtein) s -= 20;
    // 생선은 주 2회가 목표다. 주 후반까지 못 채웠으면 만회하도록 크게 민다.
    if (r.protein === 'fish' && ctx.fishCount < 2) s += 14 + Math.max(0, day - 3) * 18;
  }

  // 한 상에 같은 재료가 두 번 오르면 종일 같은 걸 먹는 느낌이 든다.
  if (slot !== 'breakfast') {
    if (r.protein !== 'none' && ctx.dayProteins.has(r.protein)) s -= 18;
    if (ctx.dayHeads.has(r.ingredients[0].name)) s -= 14;
  }

  // 저녁 세 가지를 합쳐 1시간이 넘으면 평일에 못 지킨다.
  if (slot === 'soup' || slot === 'main' || slot === 'side') {
    if (ctx.dinnerMinutes + r.minutes > 60) s -= 30;
  }

  // 매운 메뉴는 주 2회까지만. 아기는 못 먹고 7살도 부담스럽다.
  if (r.spicy && ctx.spicyCount >= 2) s -= 45;

  // 칼슘 식품(우유·치즈·두부·멸치·미역)은 주 4회까지 밀어 준다.
  if (r.calcium && ctx.calciumCount < 4) s += 6;

  if (slot === 'side' || slot === 'onedish') s += r.veg * 4;
  // 곁들임은 그날 마지막으로 정하는 자리다. 여기서 하루 채소량을 채운다.
  if (slot === 'side' && ctx.dayVeg + r.veg >= 4) s += 25;
  // 손이 덜 가는 쪽을 기본으로 고른다.
  s += (3 - r.ease) * 3;

  return s;
}

function pick(list: Recipe[], day: number, slot: Slot, ctx: Ctx, rng: () => number, settings: Settings): Recipe {
  let best = list[0];
  let bestScore = -Infinity;
  for (const r of list) {
    const s = score(r, day, slot, ctx, rng, settings);
    if (s > bestScore) {
      bestScore = s;
      best = r;
    }
  }
  ctx.lastUsed.set(best.id, day);
  // 생선 횟수는 국·메인만 센다. 아침 참치주먹밥까지 세면 저녁 생선을 안 넣게 된다.
  if (best.protein === 'fish' && (slot === 'soup' || slot === 'main')) ctx.fishCount += 1;
  if (best.calcium) ctx.calciumCount += 1;
  if (best.spicy) ctx.spicyCount += 1;
  if (slot === 'soup' || slot === 'main' || slot === 'side') ctx.dinnerMinutes += best.minutes;
  if (best.protein !== 'none') ctx.dayProteins.add(best.protein);
  ctx.dayHeads.add(best.ingredients[0].name);
  ctx.dayVeg += best.veg;
  if (slot === 'soup' || slot === 'main') {
    ctx.proteinCount.set(best.protein, (ctx.proteinCount.get(best.protein) ?? 0) + 1);
  }
  return best;
}

/** 씨앗과 설정이 같으면 언제 돌려도 같은 식단이 나온다. */
export function generateWeek(seed: number, settings: Settings): WeekPlan {
  const rng = makeRng(seed);
  const pools: Record<Slot, Recipe[]> = {
    breakfast: pool('breakfast', settings),
    onedish: pool('onedish', settings),
    soup: pool('soup', settings),
    main: pool('main', settings),
    side: pool('side', settings),
  };

  const ctx: Ctx = {
    lastUsed: new Map(),
    proteinCount: new Map(),
    fishCount: 0,
    calciumCount: 0,
    spicyCount: 0,
    dinnerMinutes: 0,
    dayProteins: new Set(),
    dayHeads: new Set(),
    dayVeg: 0,
  };

  const days: DayPlan[] = [];
  for (let day = 0; day < 7; day++) {
    ctx.dinnerMinutes = 0;
    ctx.dayProteins = new Set();
    ctx.dayHeads = new Set();
    ctx.dayVeg = 0;
    const breakfast = pick(pools.breakfast, day, 'breakfast', ctx, rng, settings);
    const lunch = pick(pools.onedish, day, 'onedish', ctx, rng, settings);
    const soup = pick(pools.soup, day, 'soup', ctx, rng, settings);
    const main = pick(pools.main, day, 'main', ctx, rng, settings);
    const side = pick(pools.side, day, 'side', ctx, rng, settings);
    ctx.prevMainProtein = main.protein;
    days.push({
      day,
      breakfast: breakfast.id,
      lunch: lunch.id,
      soup: soup.id,
      main: main.id,
      side: side.id,
    });
  }

  return { seed, createdAt: new Date().toISOString(), days };
}

/** 하루 계획에 들어간 레시피 id 를 상 차리는 순서대로 */
export function dayRecipeIds(d: DayPlan): { slot: Slot; id: string }[] {
  return [
    { slot: 'breakfast' as Slot, id: d.breakfast },
    { slot: 'onedish' as Slot, id: d.lunch },
    { slot: 'soup' as Slot, id: d.soup },
    { slot: 'main' as Slot, id: d.main },
    { slot: 'side' as Slot, id: d.side },
  ];
}

/** 일주일 식단에 쓰인 모든 레시피 id (중복 제거 없이 등장 순서대로) */
export function planRecipeIds(plan: WeekPlan): string[] {
  return plan.days.flatMap((d) => dayRecipeIds(d).map((x) => x.id));
}

/** DayPlan 에서 슬롯이 앉는 칸 이름 */
const SLOT_FIELD: Record<Slot, keyof Omit<DayPlan, 'day'>> = {
  breakfast: 'breakfast',
  onedish: 'lunch',
  soup: 'soup',
  main: 'main',
  side: 'side',
};

/**
 * 한 끼만 다른 메뉴로 바꾼다. 그날 상에 이미 오른 메뉴와
 * 그 주에 같은 자리에 나온 메뉴는 후보에서 뺀다.
 */
export function swapMeal(plan: WeekPlan, dayIndex: number, slot: Slot, settings: Settings): WeekPlan {
  const field = SLOT_FIELD[slot];
  const current = plan.days[dayIndex][field];
  const sameSlotThisWeek = new Set(plan.days.map((d) => d[field]));
  const list = pool(slot, settings);

  let options = list.filter((r) => !sameSlotThisWeek.has(r.id));
  // 후보를 다 써 버렸으면 "지금 것만 아니면 된다"로 조건을 푼다.
  if (options.length === 0) options = list.filter((r) => r.id !== current);
  if (options.length === 0) return plan;

  const next = options[Math.floor(Math.random() * options.length)];
  return {
    ...plan,
    days: plan.days.map((d, i) => (i === dayIndex ? { ...d, [field]: next.id } : d)),
  };
}

/** 월요일을 0으로 보는 오늘 요일 */
export function todayIndex(now = new Date()): number {
  return (now.getDay() + 6) % 7;
}

import { getRecipe, RECIPES } from '../data/recipes';
import { DayPlan, Recipe, Settings, Slot, WeekPlan } from '../types';
import { countAtHome } from './ingredients';
import { makeRng } from './random';

export const DAY_NAMES = ['월', '화', '수', '목', '금', '토', '일'];

/** 장보기 줄이기를 켰을 때 한 주에 만드는 아침 가짓수 */
const BREAKFAST_KINDS = 4;

/**
 * 어제 만든 것을 오늘 또 먹는 자리.
 * 먹는 것에 관한 집계(매운맛·칼슘·채소)에는 오늘 몫을 한 번 더 넣고,
 * 조리 시간은 더하지 않는다 — 오늘은 만들지 않기 때문이다.
 */
function reuse(id: string, slot: Slot, ctx: Ctx, day: number): string {
  const r = getRecipe(id);
  if (r) record(ctx, r, slot, day, false);
  return id;
}

/** 같은 메뉴가 며칠 안에 다시 나오지 않게 할지 (슬롯별) */
const MIN_GAP: Record<Slot, number> = {
  breakfast: 4,
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
  /** 이번 주 장바구니에 이미 담긴 재료 이름 (양념 제외) */
  weekIngredients: Set<string>;
}

/** 이 레시피를 넣으면 장바구니에 새로 담아야 하는 재료 수와, 이미 있는 재료 수 */
function basketEffect(r: Recipe, basket: Set<string>): { fresh: number; reused: number } {
  let fresh = 0;
  let reused = 0;
  r.ingredients.forEach((i) => {
    if (i.pantry || i.name === '밥') return;
    if (basket.has(i.name)) reused += 1;
    else fresh += 1;
  });
  return { fresh, reused };
}

function score(
  r: Recipe,
  day: number,
  slot: Slot,
  ctx: Ctx,
  rng: () => number,
  settings: Settings,
  recent: string[]
): number {
  // 무작위 폭이 좁으면 점수가 제일 높은 메뉴가 매주 똑같이 뽑힌다.
  // 다양성이 영양보다 중요하다는 판단에 따라 폭을 넓게 잡았다.
  let s = rng() * 30;

  // 지난 몇 주에 이미 올렸던 메뉴는 뒤로 미룬다. 어묵탕이 매주 나오던 원인.
  // 최근에 올렸을수록 크게 깎는다. 장보기 절약 점수보다 확실히 커야
  // "재료가 흔한 메뉴"가 매주 반복되는 일이 생기지 않는다.
  const seen = recent.indexOf(r.id);
  if (seen >= 0) s -= 130 - Math.min(100, seen * 2);

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
    // 생선 주 2회는 메인으로만 채운다. 국에도 이 보너스를 주면 생선 국이
    // 어묵탕 하나뿐이라 매주 어묵탕이 강제로 뽑힌다.
    if (slot === 'main' && r.protein === 'fish' && ctx.fishCount < 2) {
      s += 14 + Math.max(0, day - 3) * 16;
    }
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


  // 칼슘 식품(우유·치즈·두부·멸치·미역)은 주 4회까지 밀어 준다.
  if (r.calcium && ctx.calciumCount < 4) s += 6;

  if (settings.saveShopping) {
    // 이미 사기로 한 재료를 다시 쓰는 메뉴를 앞세워 장보기 품목 수를 줄인다.
    const { fresh, reused } = basketEffect(r, ctx.weekIngredients);
    s += reused * 6 - fresh * 9;
  }

  if (slot === 'side' || slot === 'onedish') s += r.veg * 4;
  // 곁들임은 그날 마지막으로 정하는 자리다. 여기서 하루 채소량을 채운다.
  if (slot === 'side' && ctx.dayVeg + r.veg >= 4) s += 25;
  // 손이 덜 가는 쪽을 기본으로 고른다.
  s += (3 - r.ease) * 3;

  return s;
}

function pick(
  list: Recipe[],
  day: number,
  slot: Slot,
  ctx: Ctx,
  rng: () => number,
  settings: Settings,
  recent: string[],
  /** 이 한 번의 조리로 며칠을 먹는지. 반찬을 이틀 먹으면 매운맛도 두 번이다. */
  servesDays = 1
): Recipe {
  // 매운 메뉴 주 2회, 저녁 조리 75분은 점수로 밀면 무작위에 밀려 새 나간다.
  // 후보 자체를 걸러 지키되, 그러다 후보가 없어지면 원래 목록으로 되돌린다.
  const narrow = (from: Recipe[], keep: (r: Recipe) => boolean) => {
    const kept = from.filter(keep);
    return kept.length > 0 ? kept : from;
  };
  let room = list;
  if (ctx.spicyCount + servesDays > 2) room = narrow(room, (r) => !r.spicy);
  if (slot === 'soup' || slot === 'main' || slot === 'side') {
    room = narrow(room, (r) => ctx.dinnerMinutes + r.minutes <= 75);
  }

  let best = room[0];
  let bestScore = -Infinity;
  for (const r of room) {
    const s = score(r, day, slot, ctx, rng, settings, recent);
    if (s > bestScore) {
      bestScore = s;
      best = r;
    }
  }
  record(ctx, best, slot, day);
  return best;
}

/**
 * 고른 메뉴를 이번 주 집계에 반영한다.
 * 아침·반찬을 이틀째 그대로 먹을 때도 반드시 불러야 한다 — 안 그러면
 * 매운 반찬을 이틀 먹었는데 한 번으로 세어져 "주 2회" 약속이 깨진다.
 */
function record(ctx: Ctx, r: Recipe, slot: Slot, day: number, cooked = true): void {
  ctx.lastUsed.set(r.id, day);
  r.ingredients.forEach((i) => {
    if (!i.pantry && i.name !== '밥') ctx.weekIngredients.add(i.name);
  });
  // 생선 횟수는 국·메인만 센다. 아침 참치주먹밥까지 세면 저녁 생선을 안 넣게 된다.
  if (r.protein === 'fish' && (slot === 'soup' || slot === 'main')) ctx.fishCount += 1;
  if (r.calcium) ctx.calciumCount += 1;
  if (r.spicy) ctx.spicyCount += 1;
  if (cooked && (slot === 'soup' || slot === 'main' || slot === 'side')) {
    ctx.dinnerMinutes += r.minutes;
  }
  if (r.protein !== 'none') ctx.dayProteins.add(r.protein);
  ctx.dayHeads.add(r.ingredients[0].name);
  ctx.dayVeg += r.veg;
  if (slot === 'soup' || slot === 'main') {
    ctx.proteinCount.set(r.protein, (ctx.proteinCount.get(r.protein) ?? 0) + 1);
  }
}

/**
 * 씨앗과 설정이 같으면 언제 돌려도 같은 식단이 나온다.
 * `recent` 는 지난 몇 주에 이미 올렸던 메뉴 id 로, 같은 메뉴가 매주
 * 반복되지 않도록 뒤로 미루는 데 쓴다.
 */
export function generateWeek(seed: number, settings: Settings, recent: string[] = []): WeekPlan {
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
    weekIngredients: new Set(),
  };

  const days: DayPlan[] = [];
  for (let day = 0; day < 7; day++) {
    ctx.dinnerMinutes = 0;
    ctx.dayProteins = new Set();
    ctx.dayHeads = new Set();
    ctx.dayVeg = 0;

    // 장보기 줄이기: 아침은 네 가지를 돌려 먹고, 반찬은 이틀씩 먹는다.
    // 아침과 밑반찬까지 매일 새로 만드는 집은 없고, 이게 장바구니를 가장 크게 줄인다.
    const reuseBreakfast = settings.saveShopping && day >= BREAKFAST_KINDS;
    const reuseSide = settings.saveShopping && day % 2 === 1;

    // 이미 만들어 둔 것을 먼저 집계에 넣는다. 그래야 "오늘 매운 반찬을 또
    // 먹는다"는 사실이 오늘 메인을 고를 때 반영된다.
    const keptBreakfast = reuseBreakfast
      ? reuse(days[day - BREAKFAST_KINDS].breakfast, 'breakfast', ctx, day)
      : null;
    const keptSide = reuseSide ? reuse(days[day - 1].side, 'side', ctx, day) : null;

    const servesDays = settings.saveShopping ? 2 : 1;
    const breakfast =
      keptBreakfast ??
      pick(pools.breakfast, day, 'breakfast', ctx, rng, settings, recent, servesDays).id;
    const lunch = pick(pools.onedish, day, 'onedish', ctx, rng, settings, recent);
    const soup = pick(pools.soup, day, 'soup', ctx, rng, settings, recent);
    const main = pick(pools.main, day, 'main', ctx, rng, settings, recent);
    const side =
      keptSide ?? pick(pools.side, day, 'side', ctx, rng, settings, recent, servesDays).id;

    ctx.prevMainProtein = main.protein;
    days.push({
      day,
      breakfast,
      lunch: lunch.id,
      soup: soup.id,
      main: main.id,
      side,
      reusedBreakfast: reuseBreakfast,
      reusedSide: reuseSide,
    });
  }

  return { seed, createdAt: new Date().toISOString(), days };
}

/**
 * 그날 실제로 **만드는** 자리만. 어제 만든 반찬을 먹는 날은 빠진다.
 * 요일별 장보기와 하루 조리 시간이 이걸 기준으로 계산된다.
 */
export function cookedRecipeIds(d: DayPlan): { slot: Slot; id: string }[] {
  return dayRecipeIds(d).filter(({ slot }) => {
    if (slot === 'side') return !d.reusedSide;
    if (slot === 'breakfast') return !d.reusedBreakfast;
    return true;
  });
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

import { getRecipe } from '../data/recipes';
import { Protein, PROTEIN_LABEL, WeekPlan } from '../types';
import { dayRecipeIds } from './planner';

export interface Check {
  label: string;
  /** 왜 이 기준인지 한 줄 설명 */
  why: string;
  value: number;
  target: number;
  ok: boolean;
  /** 값이 target '이상'이어야 하는지, '이하'여야 하는지 */
  direction: 'min' | 'max';
}

export interface Balance {
  checks: Check[];
  /** 국·메인에 쓰인 단백질원별 횟수 */
  proteinCount: { protein: Protein; label: string; count: number }[];
  /** 하루 조리 시간 합계(분) — 아침·점심·저녁 전부 */
  minutesPerDay: number[];
}

/**
 * 칼로리 숫자는 일부러 내지 않는다. 가정식은 계량 오차가 커서
 * 숫자를 붙이면 틀린 값을 맞는 값처럼 보이게 만든다.
 * 대신 식품군이 골고루 들어갔는지를 센다.
 */
export function weekBalance(plan: WeekPlan): Balance {
  const counts = new Map<Protein, number>();
  let fish = 0;
  let calcium = 0;
  let spicy = 0;
  let vegOkDays = 0;
  let heavyDinners = 0;
  const minutesPerDay: number[] = [];

  for (const day of plan.days) {
    let vegScore = 0;
    let minutes = 0;
    let dinnerMinutes = 0;

    for (const { slot, id } of dayRecipeIds(day)) {
      const r = getRecipe(id);
      if (!r) continue;
      // 어제 만들어 둔 것을 먹는 날은 오늘의 조리 시간이 아니다.
      const cooked = !(slot === 'side' && day.reusedSide) && !(slot === 'breakfast' && day.reusedBreakfast);
      if (cooked) minutes += r.minutes;
      if (cooked && (slot === 'soup' || slot === 'main' || slot === 'side')) dinnerMinutes += r.minutes;
      if (slot === 'soup' || slot === 'main') {
        counts.set(r.protein, (counts.get(r.protein) ?? 0) + 1);
        if (r.protein === 'fish') fish += 1;
      }
      if (r.calcium) calcium += 1;
      if (r.spicy) spicy += 1;
      vegScore += r.veg;
    }

    if (vegScore >= 4) vegOkDays += 1;
    if (dinnerMinutes > 60) heavyDinners += 1;
    minutesPerDay.push(minutes);
  }

  const entries = Array.from(counts.entries());
  const kinds = entries.filter(([p, c]) => p !== 'none' && c > 0).length;

  const checks: Check[] = [
    {
      label: '단백질원 종류',
      why: '고기·생선·달걀·콩을 돌려 가며 써야 특정 영양소에 치우치지 않습니다.',
      value: kinds,
      target: 4,
      ok: kinds >= 4,
      direction: 'min',
    },
    {
      label: '생선 반찬',
      why: '아이 성장기에 생선은 주 2회 정도가 무난합니다.',
      value: fish,
      target: 2,
      ok: fish >= 2,
      direction: 'min',
    },
    {
      label: '채소 넉넉한 날',
      why: '하루 중 채소가 주인공인 메뉴가 최소 두 개는 있어야 합니다.',
      value: vegOkDays,
      target: 7,
      ok: vegOkDays >= 7,
      direction: 'min',
    },
    {
      label: '칼슘 메뉴',
      why: '7살과 16개월 모두 뼈가 크는 시기입니다. 두부·치즈·멸치·미역이 여기 듭니다.',
      value: calcium,
      target: 4,
      ok: calcium >= 4,
      direction: 'min',
    },
    {
      label: '매운 메뉴',
      why: '아기는 못 먹고 7살도 부담스럽습니다. 주 2회까지가 적당합니다.',
      value: spicy,
      target: 2,
      ok: spicy <= 2,
      direction: 'max',
    },
    {
      label: '손 많이 가는 저녁',
      why: '저녁 세 가지 합쳐 1시간이 넘는 날이 많으면 식단이 끝까지 안 갑니다.',
      value: heavyDinners,
      target: 2,
      ok: heavyDinners <= 2,
      direction: 'max',
    },
  ];

  const proteinCount = entries
    .filter(([, c]) => c > 0)
    .map(([protein, count]) => ({ protein, label: PROTEIN_LABEL[protein], count }))
    .sort((a, b) => b.count - a.count);

  return { checks, proteinCount, minutesPerDay };
}

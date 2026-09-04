import { Allergen, DEFAULT_SETTINGS, Settings } from '../types';
import { generateWeek } from './planner';
import { weekBalance } from './nutrition';

// 씨앗 40개를 훑어 어떤 추천이 나와도 균형이 무너지지 않는지 본다.
const SEEDS = Array.from({ length: 40 }, (_, i) => i * 977 + 13);

/**
 * 균형은 '지켜야 할 하한선'이지 최우선 목표가 아니다.
 * 다양성을 우선하기로 하면서 가끔 한 항목이 모자란 주가 나올 수 있게 됐고,
 * 그런 주는 영양 탭에 ⚠️ 로 그대로 보여 준다.
 * 여기서는 단백질원·생선·칼슘 같은 핵심이 무너지지 않는지만 못박는다.
 */
test('단백질원 다양성·생선·칼슘은 어떤 씨앗에서도 지켜진다', () => {
  SEEDS.forEach((seed) => {
    const { checks } = weekBalance(generateWeek(seed, DEFAULT_SETTINGS));
    const core = checks.filter((c) => ['단백질원 종류', '생선 반찬', '칼슘 메뉴'].includes(c.label));
    const failed = core.filter((c) => !c.ok).map((c) => `${c.label}(${c.value}/${c.target})`);
    expect(`seed ${seed}: ${failed.join(', ')}`).toBe(`seed ${seed}: `);
  });
});

test('단백질원이 한쪽으로 몰리지 않는다', () => {
  SEEDS.forEach((seed) => {
    const { proteinCount } = weekBalance(generateWeek(seed, DEFAULT_SETTINGS));
    const total = proteinCount.reduce((s, p) => s + p.count, 0);
    expect(total).toBe(14); // 국 7 + 메인 7
    const top = proteinCount[0];
    expect(top.count).toBeLessThanOrEqual(5);
  });
});

test('하루 조리 시간은 7일치가 모두 나온다', () => {
  const { minutesPerDay } = weekBalance(generateWeek(42, DEFAULT_SETTINGS));
  expect(minutesPerDay).toHaveLength(7);
  minutesPerDay.forEach((m) => expect(m).toBeGreaterThan(0));
});

/** 냉장고 재료·잘 먹는 메뉴 같은 설정이 균형을 무너뜨리지 않는지 본다. */
const CASES: Partial<Settings>[] = [
  { haveAtHome: ['두부', '애호박', '양파'] },
  { haveAtHome: ['돼지고기', '감자', '당근'] },
  { favorites: ['m-bulgogi', 'o-curry', 'd-myeolchi'] },
  { haveAtHome: ['달걀'], favorites: ['m-gyeranjangjorim'] },
  { haveAtHome: ['소고기', '양파', '대파', '감자'], noSpicy: true },
  { avoid: ['새우', '돼지고기'] as Allergen[], noSpicy: true },
  { servings: 5, maxMinutes: 30 },
];

test('설정을 바꿔 가며 돌려도 기준을 다 채우는 주가 대부분이다', () => {
  let weeks = 0;
  let missed = 0;
  CASES.forEach((extra) => {
    for (let i = 0; i < 30; i++) {
      const { checks } = weekBalance(generateWeek(i * 41 + 3, { ...DEFAULT_SETTINGS, ...extra }));
      weeks += 1;
      if (checks.some((c) => !c.ok)) missed += 1;
    }
  });
  // 실측 8% 안팎. 20%를 넘으면 다양성 쪽으로 너무 기운 것이니 규칙을 다시 봐야 한다.
  expect(`${((missed / weeks) * 100).toFixed(0)}% <= 20%`).toBe(`${Math.min(20, Math.round((missed / weeks) * 100))}% <= 20%`);
});

test('한 주 안에서 기준을 놓치더라도 두 항목 이상 무너지지는 않는다', () => {
  for (let i = 0; i < 60; i++) {
    const { checks } = weekBalance(generateWeek(i * 97 + 5, DEFAULT_SETTINGS));
    expect(checks.filter((c) => !c.ok).length).toBeLessThanOrEqual(1);
  }
});

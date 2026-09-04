import { Allergen, DEFAULT_SETTINGS, Settings } from '../types';
import { generateWeek } from './planner';
import { weekBalance } from './nutrition';

// 씨앗 40개를 훑어 어떤 추천이 나와도 균형이 무너지지 않는지 본다.
const SEEDS = Array.from({ length: 40 }, (_, i) => i * 977 + 13);

test('기본 설정에서는 모든 균형 기준을 통과한다', () => {
  SEEDS.forEach((seed) => {
    const { checks } = weekBalance(generateWeek(seed, DEFAULT_SETTINGS));
    const failed = checks.filter((c) => !c.ok).map((c) => `${c.label}(${c.value}/${c.target})`);
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

test('설정을 바꿔 가며 돌려도 균형 기준은 그대로 통과한다', () => {
  CASES.forEach((extra, ci) => {
    for (let i = 0; i < 30; i++) {
      const { checks } = weekBalance(generateWeek(i * 41 + 3, { ...DEFAULT_SETTINGS, ...extra }));
      const failed = checks.filter((c) => !c.ok).map((c) => `${c.label}(${c.value}/${c.target})`);
      expect(`case${ci} seed${i}: ${failed.join(', ')}`).toBe(`case${ci} seed${i}: `);
    }
  });
});

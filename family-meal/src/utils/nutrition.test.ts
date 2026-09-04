import { DEFAULT_SETTINGS } from '../types';
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

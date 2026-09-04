import { RECIPES } from '../data/recipes';
import { countAtHome, isAtHome, matchesAtHome, QUICK_PICKS } from './ingredients';

test('짧게 적어도 같은 재료로 알아본다', () => {
  expect(matchesAtHome('소고기', '소고기 국거리')).toBe(true);
  expect(matchesAtHome('소 고기', '소고기 다짐육')).toBe(true);
  expect(matchesAtHome('양파', '양파')).toBe(true);
});

test('다른 재료를 같은 것으로 보지 않는다', () => {
  expect(matchesAtHome('양파', '대파')).toBe(false);
  expect(matchesAtHome('소고기', '돼지고기 앞다리살')).toBe(false);
});

test('두부와 순두부처럼 이름이 겹치는 다른 재료를 구분한다', () => {
  expect(matchesAtHome('두부', '순두부')).toBe(false);
  expect(matchesAtHome('두부', '두부')).toBe(true);
  expect(matchesAtHome('순두부', '순두부')).toBe(true);
  expect(matchesAtHome('토마토', '방울토마토')).toBe(false);
  expect(matchesAtHome('김', '김밥김')).toBe(false);
});

test('길게 적어도 첫 낱말로 알아본다', () => {
  expect(matchesAtHome('소고기 다짐육', '소고기 국거리')).toBe(true);
  expect(matchesAtHome('소고기 다짐육', '돼지고기 다짐육')).toBe(false);
});

test('한 글자 재료는 딱 맞을 때만 인정한다', () => {
  expect(matchesAtHome('무', '무')).toBe(true);
  expect(matchesAtHome('무', '무나물')).toBe(false);
});

test('한 글자만 적으면 아무거나 걸리지 않게 무시한다', () => {
  expect(matchesAtHome('파', '대파')).toBe(false);
  expect(isAtHome(['파'], '양파')).toBe(false);
});

test('레시피에서 집에 있는 재료 수를 센다', () => {
  const bulgogi = RECIPES.find((r) => r.id === 'm-bulgogi')!;
  expect(countAtHome(bulgogi, [])).toBe(0);
  expect(countAtHome(bulgogi, ['양파'])).toBe(1);
  expect(countAtHome(bulgogi, ['양파', '당근'])).toBe(2);
});

test('양념은 냉장고 재료로 세지 않는다', () => {
  const bulgogi = RECIPES.find((r) => r.id === 'm-bulgogi')!;
  // 간장은 상비 양념이라 "집에 있다"고 적어도 점수에 영향이 없어야 한다.
  expect(countAtHome(bulgogi, ['간장'])).toBe(0);
});

test('부르는 이름이 달라도 알아본다', () => {
  expect(matchesAtHome('닭고기', '닭안심')).toBe(true);
  expect(matchesAtHome('닭고기', '닭다리')).toBe(true);
  expect(matchesAtHome('생선', '손질 고등어')).toBe(true);
  expect(matchesAtHome('치즈', '모짜렐라 치즈볼')).toBe(true);
  expect(matchesAtHome('닭고기', '돼지고기 다짐육')).toBe(false);
});

test('빠른 선택 재료는 전부 실제 레시피 재료와 연결된다', () => {
  QUICK_PICKS.forEach((pick) => {
    const hit = RECIPES.some((r) => r.ingredients.some((i) => !i.pantry && matchesAtHome(pick, i.name)));
    expect(`${pick}: ${hit}`).toBe(`${pick}: true`);
  });
});

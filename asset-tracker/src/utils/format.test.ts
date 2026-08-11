import { ddayLabel, monthsLabel, shortWon, signedPercent, signedWon, won } from './format';

describe('shortWon', () => {
  it('억 단위로 줄인다', () => {
    expect(shortWon(300_000_000)).toBe('3억원');
    expect(shortWon(240_000_000)).toBe('2.4억원');
    expect(shortWon(362_000_000)).toBe('3.62억원');
  });

  it('만 단위에 천 단위 콤마를 붙인다', () => {
    expect(shortWon(60_000_000)).toBe('6,000만원');
  });

  it('100만원이 넘으면 소수점을 뗀다 (5231.35만원 같은 건 못 읽는다)', () => {
    expect(shortWon(52_313_500)).toBe('5,231만원');
  });

  it('작은 금액은 소수점 한 자리까지 남긴다', () => {
    expect(shortWon(15_000)).toBe('1.5만원');
  });

  it('만원 미만은 원 단위 그대로', () => {
    expect(shortWon(5_000)).toBe('5,000원');
    expect(shortWon(0)).toBe('0원');
  });

  it('음수는 앞에 − 를 붙인다', () => {
    expect(shortWon(-40_000_000)).toBe('−4,000만원');
  });
});

describe('won / signedWon / signedPercent', () => {
  it('won은 콤마와 원을 붙인다', () => {
    expect(won(939_000)).toBe('939,000원');
  });

  it('signedWon은 부호를 항상 붙이고 0은 그냥 0원', () => {
    expect(signedWon(2_000_000)).toBe('+2,000,000원');
    expect(signedWon(-2_000_000)).toBe('−2,000,000원');
    expect(signedWon(0)).toBe('0원');
  });

  it('signedPercent는 소수점 한 자리까지', () => {
    expect(signedPercent(0.2)).toBe('+20%');
    expect(signedPercent(-0.045)).toBe('−4.5%');
    expect(signedPercent(0)).toBe('0%');
  });
});

describe('ddayLabel', () => {
  const today = '2026-08-11';

  it('오늘이 만기면 D-DAY', () => {
    expect(ddayLabel(today, today)).toBe('D-DAY');
  });

  it('가까운 날은 D-n', () => {
    expect(ddayLabel('2026-09-25', today)).toBe('D-45');
    expect(ddayLabel('2027-08-11', today)).toBe('D-365');
  });

  it('1년을 훌쩍 넘으면 자릿수 대신 년·월로 보여준다', () => {
    expect(ddayLabel('2036-08-11', today)).toBe('10년 남음');
    expect(ddayLabel('2028-01-11', today)).toBe('1년 5개월 남음');
  });

  it('지난 날은 지났다고 알려준다', () => {
    expect(ddayLabel('2026-08-01', today)).toBe('10일 지남');
  });
});

describe('monthsLabel', () => {
  it('개월을 년·월로 읽어준다', () => {
    expect(monthsLabel(126)).toBe('10년 6개월');
    expect(monthsLabel(120)).toBe('10년');
    expect(monthsLabel(7)).toBe('7개월');
    expect(monthsLabel(0)).toBe('0개월');
  });
});

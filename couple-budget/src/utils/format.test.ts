import { formatAmountInput, parseAmountInput, shortWon, signedWon, won } from './format';

describe('shortWon — 짧게 쓰되 값을 바꾸지 않는다', () => {
  it('천 원 단위로 떨어지면 만 단위로 줄인다', () => {
    expect(shortWon(12000)).toBe('1.2만원');
    expect(shortWon(3200000)).toBe('320만원');
    expect(shortWon(800000)).toBe('80만원');
    expect(shortWon(10000)).toBe('1만원');
  });

  it('천 원 단위로 안 떨어지면 원 단위까지 다 쓴다 — 23,500 을 2.4만원으로 올리지 않는다', () => {
    expect(shortWon(23500)).toBe('23,500원');
    expect(shortWon(15030)).toBe('15,030원');
    expect(shortWon(1234560)).toBe('1,234,560원');
    expect(shortWon(10001)).toBe('10,001원');
  });

  it('만 원 미만은 그대로', () => {
    expect(shortWon(1500)).toBe('1,500원');
    expect(shortWon(9000)).toBe('9,000원');
    expect(shortWon(0)).toBe('0원');
  });

  it('억: 천만 단위로 떨어질 때만 억으로, 아니면 만으로', () => {
    expect(shortWon(100000000)).toBe('1억원');
    expect(shortWon(150000000)).toBe('1.5억원');
    expect(shortWon(123450000)).toBe('12,345만원');
    expect(shortWon(123456000)).toBe('12,345.6만원');
  });

  it('음수', () => {
    expect(shortWon(-23500)).toBe('−23,500원');
    expect(shortWon(-120000)).toBe('−12만원');
  });

  it('짧게 쓴 글자를 숫자로 되돌리면 원래 값이다 (반올림 없음)', () => {
    for (const n of [23500, 24000, 12000, 999000, 1005000, 5000, 15030, 150000000, 123450000]) {
      const s = shortWon(n);
      const num = Number(s.replace(/[^\d.]/g, ''));
      const back = s.endsWith('억원') ? num * 1e8 : s.endsWith('만원') ? num * 1e4 : num;
      expect(Math.round(back)).toBe(n);
    }
  });
});

describe('금액 입력 — 넣은 그대로 저장된다', () => {
  it('23500 을 넣으면 23,500 이고 숫자로는 23500', () => {
    expect(formatAmountInput('23500')).toBe('23,500');
    expect(parseAmountInput('23,500')).toBe(23500);
    expect(parseAmountInput(formatAmountInput('23500'))).toBe(23500);
  });

  it('won·signedWon 도 원 단위 그대로', () => {
    expect(won(23500)).toBe('23,500원');
    expect(signedWon(-23500)).toBe('−23,500원');
  });
});

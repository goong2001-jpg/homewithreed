import { normalizeExtracted } from './geminiVision';

describe('normalizeExtracted — 모델 응답 검증', () => {
  it('올바른 값은 그대로 통과한다', () => {
    const out = normalizeExtracted({
      date: '2026-03-01', category: '식비', content: '김밥천국', amount: 8500,
      type: '지출', paymentMethod: '카드',
    });
    expect(out).toEqual({
      date: '2026-03-01', category: '식비', content: '김밥천국', amount: 8500,
      type: '지출', paymentMethod: '카드',
    });
  });

  it('날짜가 YYYY-MM-DD 가 아니면 비운다', () => {
    expect(normalizeExtracted({ date: '2026.03.01' }).date).toBeUndefined();
    expect(normalizeExtracted({ date: '03/01/2026' }).date).toBeUndefined();
    expect(normalizeExtracted({ date: null }).date).toBeUndefined();
    expect(normalizeExtracted({ date: 20260301 }).date).toBeUndefined();
  });

  it('금액은 유한한 0 이상 숫자만 받는다', () => {
    expect(normalizeExtracted({ amount: -100 }).amount).toBeUndefined();
    expect(normalizeExtracted({ amount: NaN }).amount).toBeUndefined();
    expect(normalizeExtracted({ amount: Infinity }).amount).toBeUndefined();
    expect(normalizeExtracted({ amount: 0 }).amount).toBe(0);
  });

  it('"12,500원" 같은 문자열 금액은 숫자로 풀어본다', () => {
    expect(normalizeExtracted({ amount: '12,500원' }).amount).toBe(12500);
    expect(normalizeExtracted({ amount: '얼마' }).amount).toBeUndefined();
  });

  it('허용되지 않은 분류·유형·결제수단은 비운다 (폼이 기본값을 고른다)', () => {
    const out = normalizeExtracted({ category: '음식', type: '환불', paymentMethod: '페이' });
    expect(out.category).toBeUndefined();
    expect(out.type).toBeUndefined();
    expect(out.paymentMethod).toBeUndefined();
  });

  it('내용은 공백을 다듬고, 빈 값은 비운다', () => {
    expect(normalizeExtracted({ content: '  스타벅스  ' }).content).toBe('스타벅스');
    expect(normalizeExtracted({ content: '   ' }).content).toBeUndefined();
  });

  it('객체가 아니면 빈 결과를 준다', () => {
    expect(normalizeExtracted(null)).toEqual({});
    expect(normalizeExtracted('문자열')).toEqual({});
    expect(normalizeExtracted([1, 2])).toEqual({});
  });
});

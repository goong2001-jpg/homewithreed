import { guessCategory, parseSms } from './smsParse';
import { Expense } from '../types';

// 2026-11-13 (금)
const NOW = new Date(2026, 10, 13, 9, 0, 0);

// 실제 문자 모양을 따르되 이름·카드번호·가게 지점은 가짜다 (공개 저장소)
const KEY_VALUE = `금액 1,500원
카드 가나1*2*
손님명 홍*동
거래종류 신용
거래구분 일시불
사용처 구글페이먼트코리아
거래시간 11/11 23:15
누적금액 366,400원`;

const ONE_LINE = `[토스뱅크] 체크카드 국내 결제
홍*동님의 예시카드 카드
15,030원 결제 | 크린토피아 서울역점
잔액 144,816원`;

function ok(raw: string) {
  const r = parseSms(raw, NOW);
  if (!r.ok) throw new Error(`해석 실패: ${r.reason}`);
  return r.parsed;
}

describe('parseSms — 항목이 한 줄씩 오는 문자', () => {
  it('금액·사용처·거래시간을 뽑는다', () => {
    expect(ok(KEY_VALUE)).toEqual({
      amount: 1500, content: '구글페이먼트코리아', date: '2026-11-11', hasDate: true,
    });
  });

  it('누적금액을 쓴 돈으로 착각하지 않는다 (줄 순서가 바뀌어도)', () => {
    const swapped = KEY_VALUE.split('\n').reverse().join('\n');
    expect(ok(swapped).amount).toBe(1500);
  });
});

describe('parseSms — 한 줄 문장형 문자', () => {
  it('금액·가게 이름을 뽑고, 날짜가 없으면 오늘로 채운다', () => {
    expect(ok(ONE_LINE)).toEqual({
      amount: 15030, content: '크린토피아 서울역점', date: '2026-11-13', hasDate: false,
    });
  });

  it('잔액을 쓴 돈으로 착각하지 않는다', () => {
    expect(ok('잔액 144,816원\n15,030원 결제 | 가게').amount).toBe(15030);
  });
});

describe('parseSms — 그 밖', () => {
  it('모르는 형식이어도 금액은 찾는다', () => {
    const p = ok('[Web발신] 예시카드(1234) 승인 홍*동 12,500원 일시불 11/13 12:31 가게이름');
    expect(p.amount).toBe(12500);
    expect(p.date).toBe('2026-11-13');
  });

  it('취소 문자는 채우지 않는다', () => {
    expect(parseSms(`${ONE_LINE}\n결제 취소`, NOW)).toEqual({ ok: false, reason: 'cancel' });
  });

  it('빈 글·금액 없는 글', () => {
    expect(parseSms('   \n ', NOW)).toEqual({ ok: false, reason: 'empty' });
    expect(parseSms('안녕하세요 내일 봬요', NOW)).toEqual({ ok: false, reason: 'noAmount' });
    expect(parseSms('잔액 10,000원', NOW)).toEqual({ ok: false, reason: 'noAmount' });
  });

  it('1월에 붙여넣은 12월 문자는 작년 12월이다', () => {
    const r = parseSms('금액 1,000원\n거래시간 12/30 10:00', new Date(2027, 0, 2, 9));
    expect(r.ok && r.parsed.date).toBe('2026-12-30');
  });

  it('말이 안 되는 날짜는 무시하고 오늘로 채운다', () => {
    const p = ok('금액 1,000원\n거래시간 13/45 10:00');
    expect(p).toMatchObject({ date: '2026-11-13', hasDate: false });
  });

  it('가게 이름이 너무 길면 40자로 자른다', () => {
    expect(ok(`금액 1,000원\n사용처 ${'가'.repeat(60)}`).content).toHaveLength(40);
  });
});

describe('guessCategory — 가게 이름으로 카테고리 짐작', () => {
  const past = (content: string, category: Expense['category'], date: string): Expense => ({
    id: `${content}-${date}`, date, month: date.slice(0, 7), amount: 1000, category, content,
    personId: 'p1', createdAt: 1, updatedAt: 1,
  });

  it('흔한 가게 이름 글자로 짐작한다', () => {
    expect(guessCategory('크린토피아 서울역점', [])).toBe('생활');
    expect(guessCategory('구글페이먼트코리아', [])).toBe('여가');
    expect(guessCategory('스타벅스 강남점', [])).toBe('식비');
    expect(guessCategory('쿠팡이츠', [])).toBe('식비');
    expect(guessCategory('쿠팡', [])).toBe('쇼핑');
    expect(guessCategory('OO주유소', [])).toBe('교통');
    expect(guessCategory('튼튼약국', [])).toBe('의료');
  });

  it('전에 같은 이름으로 적은 카테고리가 먼저다 — 가장 최근 것', () => {
    const history = [
      past('구글페이먼트코리아', '생활', '2026-09-01'),
      past('구글페이먼트코리아', '육아', '2026-10-01'),
    ];
    expect(guessCategory('구글페이먼트코리아', history)).toBe('육아');
  });

  it('지운 기록은 보지 않는다', () => {
    const history = [{ ...past('구글페이먼트코리아', '육아', '2026-10-01'), deleted: true }];
    expect(guessCategory('구글페이먼트코리아', history)).toBe('여가');
  });

  it('모르는 가게·빈 이름은 null', () => {
    expect(guessCategory('가나다라', [])).toBeNull();
    expect(guessCategory('  ', [])).toBeNull();
  });
});

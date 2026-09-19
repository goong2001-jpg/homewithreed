import {
  counterpartyTotals, filterGifts, giftTotalsByPerson, giftYears,
  groupGiftsByMonth, summarizeGifts,
} from './gifts';
import { GiftEntry } from '../types';

function gift(
  id: string,
  date: string,
  direction: 'in' | 'out',
  amount: number,
  counterparty: string,
  extra: Partial<GiftEntry> = {},
): GiftEntry {
  return {
    id,
    date,
    month: date.slice(0, 7),
    direction,
    amount,
    kind: direction === 'in' ? '용돈' : '축의금',
    counterparty,
    personId: 'p1',
    memo: '',
    createdAt: 0,
    updatedAt: 0,
    ...extra,
  };
}

const ROWS: GiftEntry[] = [
  gift('a', '2026-09-05', 'out', 100_000, '김철수 결혼'),
  gift('b', '2026-05-02', 'in', 50_000, '외할머니', { personId: 'k1' }),
  gift('c', '2026-05-02', 'in', 50_000, '외할머니', { personId: 'k2' }),
  gift('d', '2025-11-20', 'out', 50_000, '김철수 결혼', { kind: '부의금', counterparty: '김철수 부친상' }),
  gift('e', '2025-02-10', 'in', 300_000, '친할아버지', { personId: 'k1' }),
  gift('f', '2026-09-01', 'out', 200_000, '이영희 결혼', { personId: 'p2' }),
];

describe('경조사·용돈 장부', () => {
  describe('연도 목록', () => {
    it('기록이 있는 연도만 최근 순으로', () => {
      expect(giftYears(ROWS)).toEqual(['2026', '2025']);
    });

    it('삭제된 건만 있는 연도는 빠진다', () => {
      const gone = { ...gift('z', '2020-01-01', 'in', 1, 'x'), deleted: true };
      expect(giftYears([...ROWS, gone])).toEqual(['2026', '2025']);
    });

    it('기록이 없으면 빈 배열', () => {
      expect(giftYears([])).toEqual([]);
    });
  });

  describe('거르기', () => {
    it('조건이 없으면 전체를 최근 날짜순으로', () => {
      expect(filterGifts(ROWS).map(g => g.id)).toEqual(['a', 'f', 'b', 'c', 'd', 'e']);
    });

    it('같은 날짜면 나중에 입력한 것이 먼저', () => {
      const rows = [
        gift('first', '2026-01-01', 'in', 1, 'x', { createdAt: 100 }),
        gift('second', '2026-01-01', 'in', 1, 'x', { createdAt: 200 }),
      ];
      expect(filterGifts(rows).map(g => g.id)).toEqual(['second', 'first']);
    });

    it('연도로 거른다', () => {
      expect(filterGifts(ROWS, { year: '2025' }).map(g => g.id)).toEqual(['d', 'e']);
    });

    it('받은 것만 / 낸 것만', () => {
      expect(filterGifts(ROWS, { direction: 'in' }).map(g => g.id)).toEqual(['b', 'c', 'e']);
      expect(filterGifts(ROWS, { direction: 'out' }).map(g => g.id)).toEqual(['a', 'f', 'd']);
    });

    it('종류로 거른다', () => {
      expect(filterGifts(ROWS, { kind: '부의금' }).map(g => g.id)).toEqual(['d']);
    });

    it('우리집 사람으로 거른다', () => {
      expect(filterGifts(ROWS, { personId: 'k1' }).map(g => g.id)).toEqual(['b', 'e']);
    });

    it('이름으로 찾는다', () => {
      expect(filterGifts(ROWS, { q: '김철수' }).map(g => g.id)).toEqual(['a', 'd']);
    });

    it('메모에서도 찾는다', () => {
      const withMemo = gift('m', '2026-03-01', 'out', 10_000, '동료', { memo: '돌잔치 봉투' });
      expect(filterGifts([...ROWS, withMemo], { q: '돌잔치' }).map(g => g.id)).toEqual(['m']);
    });

    it('검색은 대소문자와 앞뒤 공백을 무시한다', () => {
      const en = gift('en', '2026-04-01', 'in', 1000, 'Sarah');
      expect(filterGifts([...ROWS, en], { q: '  sarah ' }).map(g => g.id)).toEqual(['en']);
    });

    it('조건을 겹쳐 쓸 수 있다', () => {
      expect(filterGifts(ROWS, { year: '2026', direction: 'in' }).map(g => g.id))
        .toEqual(['b', 'c']);
    });

    it('삭제된 건은 언제나 빠진다', () => {
      const gone = { ...gift('z', '2026-09-09', 'out', 999_999, '김철수'), deleted: true };
      expect(filterGifts([...ROWS, gone], { q: '김철수' }).map(g => g.id)).toEqual(['a', 'd']);
    });
  });

  describe('합계', () => {
    it('받은 돈 · 낸 돈 · 차액', () => {
      expect(summarizeGifts(ROWS)).toEqual({
        received: 400_000,          // 50,000 + 50,000 + 300,000
        given: 350_000,             // 100,000 + 200,000 + 50,000
        net: 50_000,
        count: 6,
      });
    });

    it('빈 목록은 0', () => {
      expect(summarizeGifts([])).toEqual({ received: 0, given: 0, net: 0, count: 0 });
    });

    it('금액이 깨져 있어도 터지지 않는다', () => {
      const bad = { ...gift('bad', '2026-01-01', 'in', NaN as number, 'x') };
      expect(summarizeGifts([bad]).received).toBe(0);
    });
  });

  describe('상대별 집계', () => {
    it('오고 간 금액이 큰 사람부터', () => {
      expect(counterpartyTotals(ROWS).map(c => c.name))
        .toEqual(['친할아버지', '이영희 결혼', '김철수 결혼', '외할머니', '김철수 부친상']);
    });

    it('같은 이름은 한 줄로 묶고 주고받은 걸 따로 센다', () => {
      const rows = [
        gift('1', '2024-05-01', 'in', 100_000, '김철수'),
        gift('2', '2026-09-05', 'out', 150_000, '김철수'),
      ];
      const [c] = counterpartyTotals(rows);
      expect(c).toEqual({
        name: '김철수',
        received: 100_000,
        given: 150_000,
        net: -50_000,
        count: 2,
        lastDate: '2026-09-05',
      });
    });

    it('이름의 대소문자·앞뒤 공백은 같은 사람으로 본다', () => {
      const rows = [
        gift('1', '2026-01-01', 'in', 10_000, 'Sarah'),
        gift('2', '2026-02-01', 'in', 20_000, ' sarah '),
      ];
      const out = counterpartyTotals(rows);
      expect(out).toHaveLength(1);
      expect(out[0].received).toBe(30_000);
      expect(out[0].name).toBe('Sarah');   // 처음 적은 표기를 쓴다
    });

    it('이름이 비어 있으면 한 칸으로 모은다', () => {
      const rows = [gift('1', '2026-01-01', 'in', 10_000, '   ')];
      expect(counterpartyTotals(rows)[0].name).toBe('이름 없음');
    });

    it('빈 목록은 빈 배열', () => {
      expect(counterpartyTotals([])).toEqual([]);
    });
  });

  describe('우리집 사람별 합계', () => {
    it('아이별로 받은 돈을 따로 센다', () => {
      const m = giftTotalsByPerson(ROWS);
      expect(m.get('k1')).toEqual({ received: 350_000, given: 0, net: 350_000, count: 2 });
      expect(m.get('k2')).toEqual({ received: 50_000, given: 0, net: 50_000, count: 1 });
      expect(m.get('p2')).toEqual({ received: 0, given: 200_000, net: -200_000, count: 1 });
    });

    it('기록이 없는 사람은 아예 없다', () => {
      expect(giftTotalsByPerson(ROWS).has('없는사람')).toBe(false);
    });
  });

  describe('달로 묶기', () => {
    it('최근 달부터, 달 안에서는 들어온 순서를 지킨다', () => {
      const groups = groupGiftsByMonth(filterGifts(ROWS));
      expect(groups.map(([m]) => m)).toEqual(['2026-09', '2026-05', '2025-11', '2025-02']);
      expect(groups[0][1].map(g => g.id)).toEqual(['a', 'f']);
      expect(groups[1][1].map(g => g.id)).toEqual(['b', 'c']);
    });

    it('빈 목록은 빈 배열', () => {
      expect(groupGiftsByMonth([])).toEqual([]);
    });
  });
});

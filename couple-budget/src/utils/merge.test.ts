import { mergeById, purgeTombstones, sanitizeForFirestore } from './merge';

interface Rec { id: string; updatedAt: number; deleted?: boolean; amount: number }

const r = (id: string, updatedAt: number, amount: number, deleted?: boolean): Rec =>
  ({ id, updatedAt, amount, ...(deleted !== undefined ? { deleted } : {}) });

describe('mergeById — last-write-wins', () => {
  it('양쪽에만 있는 것들을 합친다', () => {
    const out = mergeById([r('a', 1, 100)], [r('b', 1, 200)]);
    expect(out).toHaveLength(2);
    expect(out.map(x => x.id).sort()).toEqual(['a', 'b']);
  });

  it('나중에 수정된 쪽이 이긴다', () => {
    const out = mergeById([r('a', 100, 111)], [r('a', 200, 222)]);
    expect(out).toHaveLength(1);
    expect(out[0].amount).toBe(222);
  });

  it('로컬이 더 최신이면 로컬을 지킨다', () => {
    const out = mergeById([r('a', 300, 111)], [r('a', 200, 222)]);
    expect(out[0].amount).toBe(111);
  });

  it('시각이 같으면 원격을 택한다 (두 기기가 같은 결과에 도달해야 한다)', () => {
    const out = mergeById([r('a', 100, 111)], [r('a', 100, 222)]);
    expect(out[0].amount).toBe(222);
  });

  it('삭제도 하나의 수정으로 흘러간다', () => {
    const out = mergeById([r('a', 100, 111)], [r('a', 200, 111, true)]);
    expect(out[0].deleted).toBe(true);
  });

  it('오래된 원격 사본이 삭제를 되살리지 못한다', () => {
    // 핵심 시나리오: 한쪽에서 지웠는데 다른 폰의 낡은 사본이 올라오는 경우
    const localDeleted = [r('a', 500, 111, true)];
    const staleRemote = [r('a', 200, 111)];
    const out = mergeById(localDeleted, staleRemote);
    expect(out[0].deleted).toBe(true);
  });

  it('여러 번 병합해도 결과가 같다 (멱등)', () => {
    const local = [r('a', 100, 111), r('b', 100, 222)];
    const remote = [r('a', 200, 999)];
    const once = mergeById(local, remote);
    const twice = mergeById(once, remote);
    expect(twice).toEqual(once);
  });

  it('빈 입력을 견딘다', () => {
    expect(mergeById<Rec>([], [])).toEqual([]);
    expect(mergeById([r('a', 1, 1)], [])).toHaveLength(1);
    expect(mergeById<Rec>([], [r('a', 1, 1)])).toHaveLength(1);
  });
});

describe('purgeTombstones', () => {
  const NOW = 1_000_000_000_000;
  const DAY = 86_400_000;

  it('오래된 삭제 흔적만 지운다', () => {
    const recs = [
      r('old', NOW - 100 * DAY, 1, true),
      r('recent', NOW - 10 * DAY, 1, true),
      r('alive', NOW - 100 * DAY, 1),
    ];
    const out = purgeTombstones(recs, 90 * DAY, NOW);
    expect(out.map(x => x.id).sort()).toEqual(['alive', 'recent']);
  });

  it('살아있는 레코드는 아무리 오래돼도 안 지운다', () => {
    const out = purgeTombstones([r('a', 0, 1)], 90 * DAY, NOW);
    expect(out).toHaveLength(1);
  });
});

describe('sanitizeForFirestore', () => {
  it('undefined 필드를 뺀다 (Firestore가 거부한다)', () => {
    const out = sanitizeForFirestore({ a: 1, b: undefined, c: null, d: '' });
    expect('b' in out).toBe(false);
    expect(out).toEqual({ a: 1, c: null, d: '' });
  });

  it('false와 0은 남긴다', () => {
    const out = sanitizeForFirestore({ deleted: false, amount: 0 });
    expect(out).toEqual({ deleted: false, amount: 0 });
  });
});

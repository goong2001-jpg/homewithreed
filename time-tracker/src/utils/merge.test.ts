import { mergeById, purgeTombstones } from './merge';

interface Rec { id: string; updatedAt: number; deleted?: boolean; name: string }

const r = (id: string, updatedAt: number, name: string, deleted?: boolean): Rec =>
  ({ id, updatedAt, name, ...(deleted !== undefined ? { deleted } : {}) });

describe('mergeById — last-write-wins', () => {
  it('나중에 수정된 쪽이 이기고, 동점이면 들어온 쪽을 택한다', () => {
    expect(mergeById([r('a', 100, 'old')], [r('a', 200, 'new')])[0].name).toBe('new');
    expect(mergeById([r('a', 300, 'mine')], [r('a', 200, 'theirs')])[0].name).toBe('mine');
    expect(mergeById([r('a', 100, 'mine')], [r('a', 100, 'theirs')])[0].name).toBe('theirs');
  });

  it('오래된 사본이 삭제를 되살리지 못한다', () => {
    const out = mergeById([r('a', 500, 'x', true)], [r('a', 200, 'x')]);
    expect(out[0].deleted).toBe(true);
  });
});

describe('purgeTombstones — 오래된 삭제 흔적 정리', () => {
  const NOW = 1_000_000_000_000;
  const DAY = 86_400_000;

  it('기준보다 오래된 툼스톤만 지운다', () => {
    const recs = [
      r('old', NOW - 100 * DAY, 'x', true),
      r('recent', NOW - 10 * DAY, 'x', true),
      r('alive', NOW - 100 * DAY, 'x'),
    ];
    const out = purgeTombstones(recs, 90 * DAY, NOW);
    expect(out.map(x => x.id).sort()).toEqual(['alive', 'recent']);
  });

  it('살아있는 레코드는 아무리 오래돼도 안 지운다', () => {
    expect(purgeTombstones([r('a', 0, 'x')], 90 * DAY, NOW)).toHaveLength(1);
  });

  it('기본값은 90일이다', () => {
    const out = purgeTombstones([r('a', NOW - 91 * DAY, 'x', true), r('b', NOW - 89 * DAY, 'x', true)], undefined, NOW);
    expect(out.map(x => x.id)).toEqual(['b']);
  });
});

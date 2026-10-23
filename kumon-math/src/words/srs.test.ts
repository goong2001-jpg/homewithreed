import { applyResult, pickDue, migrateSrs, isDue, dueCount, INTERVALS, MAX_BOX, SrsMap } from './srs';

const T = '2026-03-10';

describe('간격 반복 — applyResult', () => {
  it('처음 맞히면 1번 상자, 내일 복습', () => {
    const e = applyResult(undefined, true, T);
    expect(e).toEqual({ box: 1, nextDue: '2026-03-11', correct: 1, wrong: 0 });
  });

  it('맞힐 때마다 상자가 오르고 간격은 0·1·3·7·14일, 4번에서 멈춘다', () => {
    let e = applyResult(undefined, true, T);
    expect(e.box).toBe(1);
    e = applyResult(e, true, T); expect(e.box).toBe(2); expect(e.nextDue).toBe('2026-03-13');
    e = applyResult(e, true, T); expect(e.box).toBe(3); expect(e.nextDue).toBe('2026-03-17');
    e = applyResult(e, true, T); expect(e.box).toBe(4); expect(e.nextDue).toBe('2026-03-24');
    e = applyResult(e, true, T); expect(e.box).toBe(MAX_BOX); expect(e.correct).toBe(5);
    expect(INTERVALS).toEqual([0, 1, 3, 7, 14]);
  });

  it('틀리면 0번 상자로 떨어지고 오늘 다시 본다', () => {
    const high = { box: 3, nextDue: '2026-03-17', correct: 3, wrong: 0 };
    const e = applyResult(high, false, T);
    expect(e).toEqual({ box: 0, nextDue: T, correct: 3, wrong: 1 });
    expect(isDue(e, T)).toBe(true);
  });

  it('날짜 표기가 YYYY-M-D 여도 같은 날로 본다', () => {
    const e = applyResult(undefined, true, '2026-3-10');
    expect(e.nextDue).toBe('2026-03-11');
    expect(isDue(e, '2026-3-11')).toBe(true);
    expect(isDue(e, '2026-3-10')).toBe(false);
  });
});

describe('간격 반복 — pickDue', () => {
  const entries: SrsMap = {
    cat:   { box: 2, nextDue: '2026-03-10', correct: 2, wrong: 0 }, // 오늘 복습
    dog:   { box: 0, nextDue: '2026-03-08', correct: 0, wrong: 1 }, // 밀린 복습, 낮은 상자
    sun:   { box: 0, nextDue: '2026-03-09', correct: 0, wrong: 1 }, // 밀린 복습, 덜 오래됨
    pig:   { box: 4, nextDue: '2026-03-20', correct: 4, wrong: 0 }, // 아직 아님
    ant:   { box: 1, nextDue: '2026-03-12', correct: 1, wrong: 0 }, // 아직 아님 (더 가까움)
  };
  const all = ['pig', 'cat', 'bee', 'dog', 'ant', 'sun', 'cow'];

  it('복습 차례(낮은 상자·오래된 순) → 새 단어 → 아직 아닌 단어 순서다', () => {
    expect(pickDue(entries, all, T, 10)).toEqual(['dog', 'sun', 'cat', 'bee', 'cow', 'ant', 'pig']);
  });

  it('n 개만 돌려준다', () => {
    expect(pickDue(entries, all, T, 2)).toEqual(['dog', 'sun']);
    expect(pickDue(entries, all, T, 0)).toEqual([]);
  });

  it('새 단어만 있으면 주어진 순서대로 고른다', () => {
    expect(pickDue({}, ['b', 'a', 'c'], T, 2)).toEqual(['b', 'a']);
  });

  it('같은 단어가 두 번 들어와도 한 번만 나온다', () => {
    expect(pickDue({}, ['a', 'a', 'b'], T, 5)).toEqual(['a', 'b']);
  });

  it('dueCount 는 복습 차례인 단어 수', () => {
    expect(dueCount(entries, T)).toBe(3);
    expect(dueCount(entries, '2026-03-12')).toBe(4);
  });
});

describe('간격 반복 — 예전 데이터 옮기기', () => {
  it('맞힌 단어는 2번, 틀린 단어는 0번(오늘), 보기만 한 단어는 1번 상자', () => {
    const srs = migrateSrs(
      { cat: 2, dog: 1, sun: 3 },
      { cat: 1 },
      { dog: '2026-3-9' },
      T,
    );
    expect(srs.cat).toEqual({ box: 2, nextDue: '2026-03-13', correct: 1, wrong: 0 });
    expect(srs.dog).toEqual({ box: 0, nextDue: '2026-03-10', correct: 0, wrong: 1 });
    expect(srs.sun).toEqual({ box: 1, nextDue: '2026-03-11', correct: 0, wrong: 0 });
  });

  it('틀린 기록이 맞힌 기록보다 우선한다 (상자는 0, 맞힌 횟수는 남긴다)', () => {
    const srs = migrateSrs({ cat: 1 }, { cat: 2 }, { cat: '2026-3-9' }, T);
    expect(srs.cat.box).toBe(0);
    expect(srs.cat.correct).toBe(2);
  });
});

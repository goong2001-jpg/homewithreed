import { addNote, addRead, loadShelf } from './bookShelf';
import { toPrune, Recording } from './voice';

beforeEach(() => { localStorage.clear(); });

describe('책장 기록', () => {
  it('읽은 횟수를 세고 저장한다', () => {
    let s = loadShelf();
    s = addRead(s, 'spa');
    s = addRead(s, 'spa');
    expect(s.reads.spa).toBe(2);
    expect(loadShelf().reads.spa).toBe(2);
  });

  it('내 문장 노트는 최근 것이 앞, 같은 문장은 하나만', () => {
    let s = loadShelf();
    s = addNote(s, { bookId: 'spa', en: 'Pat sat.', ko: '팻이 앉았어요.' }, '2026-11-01');
    s = addNote(s, { bookId: 'nat', en: 'Nat naps.', ko: '냇은 낮잠을 자요.' }, '2026-11-02');
    s = addNote(s, { bookId: 'spa', en: 'Pat sat.', ko: '팻이 앉았어요.' }, '2026-11-03');
    expect(s.notebook.map(n => n.en)).toEqual(['Pat sat.', 'Nat naps.']);
    expect(s.notebook[0].date).toBe('2026-11-03');
  });
});

describe('녹음 정리', () => {
  const r = (id: number, bookId: string, at: number): Recording => ({ id, bookId, at, date: '', pages: [] });

  it('책마다 처음 녹음과 최근 3개만 남긴다', () => {
    const all = [r(1, 'a', 1), r(2, 'a', 2), r(3, 'a', 3), r(4, 'a', 4), r(5, 'a', 5), r(6, 'a', 6), r(7, 'b', 1), r(8, 'b', 2)];
    expect(toPrune(all).sort()).toEqual([2, 3]);
  });

  it('적으면 지우지 않는다', () => {
    expect(toPrune([r(1, 'a', 1), r(2, 'a', 2)])).toEqual([]);
  });
});

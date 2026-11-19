import { isoToday } from './dates';

/**
 * 책장 기록 — 책마다 끝까지 읽은 횟수와, 책을 읽고 고른 "내 문장 노트".
 * (녹음은 용량이 커서 따로 IndexedDB 에 둔다 — voice.ts)
 */
export interface NoteEntry {
  bookId: string;
  en: string;
  ko: string;
  date: string;
}

export interface ShelfState {
  /** 책 id → 끝까지 읽은 횟수 (책장에 ⭐ 로 보여준다, 3번이면 다 읽은 책) */
  reads: Record<string, number>;
  /** 내 문장 노트 — 최근 것부터 */
  notebook: NoteEntry[];
}

const KEY = 'word_books';
/** 책 한 권을 이만큼 읽으면 "다 읽은 책" (문서: 3번 읽기) */
export const READS_FOR_STARS = 3;
const NOTEBOOK_MAX = 100;

export const EMPTY_SHELF: ShelfState = { reads: {}, notebook: [] };

export function loadShelf(): ShelfState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw);
      return { reads: s.reads ?? {}, notebook: Array.isArray(s.notebook) ? s.notebook : [] };
    }
  } catch {}
  return EMPTY_SHELF;
}

function save(s: ShelfState): ShelfState {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {}
  return s;
}

/** 책 한 권을 끝까지 읽었다 */
export function addRead(s: ShelfState, bookId: string): ShelfState {
  return save({ ...s, reads: { ...s.reads, [bookId]: (s.reads[bookId] ?? 0) + 1 } });
}

/** 마음에 드는 문장을 노트에 적는다 (같은 문장이 이미 있으면 맨 앞으로만 옮긴다) */
export function addNote(s: ShelfState, entry: Omit<NoteEntry, 'date'>, today: string = isoToday()): ShelfState {
  const rest = s.notebook.filter(n => n.en !== entry.en);
  return save({ ...s, notebook: [{ ...entry, date: today }, ...rest].slice(0, NOTEBOOK_MAX) });
}

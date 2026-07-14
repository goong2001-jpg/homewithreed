import { ExamRecord, STORAGE_KEYS, WrongNoteEntry } from './data/types';

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function save(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // 저장 실패(프라이빗 모드 등)는 무시
  }
}

export function loadWrongNotes(): WrongNoteEntry[] {
  return load<WrongNoteEntry[]>(STORAGE_KEYS.wrongNotes, []);
}

export function saveWrongNotes(entries: WrongNoteEntry[]): void {
  save(STORAGE_KEYS.wrongNotes, entries);
}

export function addWrongNotes(newEntries: WrongNoteEntry[]): void {
  const existing = loadWrongNotes();
  const merged = [...existing];
  newEntries.forEach((entry) => {
    const idx = merged.findIndex((e) => e.questionId === entry.questionId);
    if (idx >= 0) {
      merged[idx] = entry;
    } else {
      merged.push(entry);
    }
  });
  saveWrongNotes(merged);
}

export function removeWrongNote(questionId: string): void {
  saveWrongNotes(loadWrongNotes().filter((e) => e.questionId !== questionId));
}

export function loadHistory(): ExamRecord[] {
  return load<ExamRecord[]>(STORAGE_KEYS.history, []);
}

export function addHistory(record: ExamRecord): void {
  save(STORAGE_KEYS.history, [record, ...loadHistory()].slice(0, 20));
}

export type PracticalMark = 'known' | 'unknown';

export function loadPracticalProgress(): Record<string, PracticalMark> {
  return load<Record<string, PracticalMark>>(STORAGE_KEYS.practicalProgress, {});
}

export function savePracticalProgress(progress: Record<string, PracticalMark>): void {
  save(STORAGE_KEYS.practicalProgress, progress);
}

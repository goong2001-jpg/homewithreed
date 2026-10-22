import { ExamRecord, InProgressExam, STORAGE_KEYS, WrongNoteEntry } from './data/types';

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

// ── 풀다 만 시험 ──

function isChoiceOrder(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((n) => typeof n === 'number');
}

/** 저장된 진행 중 시험이 제대로 된 모양인지 */
export function isInProgressExam(value: unknown): value is InProgressExam {
  if (typeof value !== 'object' || value === null) return false;
  const e = value as Record<string, unknown>;
  return (
    (e.mode === 'full' || e.mode === 'quick') &&
    Array.isArray(e.questionIds) &&
    e.questionIds.length > 0 &&
    e.questionIds.every((id) => typeof id === 'string') &&
    typeof e.choiceOrders === 'object' &&
    e.choiceOrders !== null &&
    Object.values(e.choiceOrders as Record<string, unknown>).every(isChoiceOrder) &&
    typeof e.answers === 'object' &&
    e.answers !== null &&
    Object.values(e.answers as Record<string, unknown>).every((n) => typeof n === 'number') &&
    typeof e.deadlineAt === 'number' &&
    typeof e.current === 'number'
  );
}

/** 풀다 만 시험. 없거나 손상됐거나 시간이 다 지났으면 null (지난 것은 지운다) */
export function loadInProgressExam(now: number = Date.now()): InProgressExam | null {
  const saved = load<unknown>(STORAGE_KEYS.inProgressExam, null);
  if (!isInProgressExam(saved)) return null;
  if (saved.deadlineAt <= now) {
    clearInProgressExam();
    return null;
  }
  return saved;
}

export function saveInProgressExam(exam: InProgressExam): void {
  save(STORAGE_KEYS.inProgressExam, exam);
}

export function clearInProgressExam(): void {
  try {
    localStorage.removeItem(STORAGE_KEYS.inProgressExam);
  } catch {
    // 무시
  }
}

export type PracticalMark = 'known' | 'unknown';

export function loadPracticalProgress(): Record<string, PracticalMark> {
  return load<Record<string, PracticalMark>>(STORAGE_KEYS.practicalProgress, {});
}

export function savePracticalProgress(progress: Record<string, PracticalMark>): void {
  save(STORAGE_KEYS.practicalProgress, progress);
}

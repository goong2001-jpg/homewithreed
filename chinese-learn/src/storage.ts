import { ExamRecord, STORAGE_KEYS } from './data/types';

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

/** 학습 완료로 표시한 세트 id 목록 */
export function loadLearned(): number[] {
  const ids = load<number[]>(STORAGE_KEYS.learned, []);
  return Array.isArray(ids) ? ids.filter((n) => typeof n === 'number') : [];
}

export function saveLearned(ids: number[]): void {
  save(STORAGE_KEYS.learned, Array.from(new Set(ids)).sort((a, b) => a - b));
}

/** 저장된 기록이 제대로 된 모양인지 (손상된 기록은 화면을 깨뜨리므로 버린다) */
export function isExamRecord(value: unknown): value is ExamRecord {
  if (typeof value !== 'object' || value === null) return false;
  const r = value as Record<string, unknown>;
  return (
    typeof r.takenAt === 'string' &&
    typeof r.total === 'number' &&
    typeof r.correct === 'number' &&
    Array.isArray(r.wrongSetIds) &&
    r.wrongSetIds.every((id) => typeof id === 'number')
  );
}

/** 최근 시험 기록 (새 기록이 앞) */
export function loadExams(): ExamRecord[] {
  const list = load<unknown>(STORAGE_KEYS.exams, []);
  return Array.isArray(list) ? list.filter(isExamRecord) : [];
}

export function addExam(record: ExamRecord): ExamRecord[] {
  const next = [record, ...loadExams()].slice(0, 30); // 최근 30회만 보관
  save(STORAGE_KEYS.exams, next);
  return next;
}

export function clearAll(): void {
  try {
    localStorage.removeItem(STORAGE_KEYS.learned);
    localStorage.removeItem(STORAGE_KEYS.exams);
  } catch {}
}

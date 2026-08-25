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

/** 최근 시험 기록 (새 기록이 앞) */
export function loadExams(): ExamRecord[] {
  const list = load<ExamRecord[]>(STORAGE_KEYS.exams, []);
  return Array.isArray(list) ? list : [];
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

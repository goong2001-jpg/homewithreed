/**
 * localStorage 래퍼.
 * asset-tracker/src/utils/storage.ts 와 같은 관용구를 쓴다.
 *
 * ⚠️ 이 앱은 동기화가 없어서 localStorage가 시간 기록의 유일한 사본이다.
 *    브라우저 데이터를 지우면 그대로 사라지므로,
 *    설정의 [백업 파일로 내보내기]가 사실상 유일한 방어선이다. (utils/backup.ts)
 */

export const KEYS = {
  categories: 'time_tracker_categories',
  entries: 'time_tracker_entries',
  blocks: 'time_tracker_blocks',
  plans: 'time_tracker_plans',
  resists: 'time_tracker_resists',
} as const;

export function load<T>(key: string, fallback: T): T {
  try {
    const saved = localStorage.getItem(key);
    if (saved) return JSON.parse(saved) as T;
  } catch {}
  return fallback;
}

export function save(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    // 사파리 프라이빗 모드나 저장 용량 초과로 막힐 수 있다. 앱을 죽이지는 않는다.
    console.warn('저장 실패:', e);
  }
}

/** 설정의 [전체 초기화] — 이 앱이 쓰는 키만 지운다 */
export function clearAll(): void {
  try {
    for (const key of Object.values(KEYS)) localStorage.removeItem(key);
  } catch (e) {
    console.warn('삭제 실패:', e);
  }
}

import { Syncable } from '../types';

/**
 * id 기준 last-write-wins 병합.
 * couple-budget/src/utils/merge.ts 와 동일하다.
 *
 * 이 앱에는 클라우드 동기화가 없지만, 백업 파일을 불러올 때
 * '지금 기록 위에 얹기'를 하려면 같은 규칙이 필요하다.
 */
export function mergeById<T extends Syncable>(local: T[], incoming: T[]): T[] {
  const map = new Map<string, T>();
  for (const r of local) map.set(r.id, r);
  for (const r of incoming) {
    const cur = map.get(r.id);
    // 동점이면 들어온 쪽을 택한다 — 결과가 항상 같아지도록 결정적으로 만든다
    if (!cur || r.updatedAt >= cur.updatedAt) map.set(r.id, r);
  }
  return Array.from(map.values());
}

/** 살아있는 레코드만 (삭제 툼스톤 제외) */
export function alive<T extends Syncable>(recs: T[]): T[] {
  return recs.filter(r => !r.deleted);
}

/** 삭제된 레코드만 — 설정의 '되살리기' 화면에서 쓴다 */
export function deletedOnly<T extends Syncable>(recs: T[]): T[] {
  return recs.filter(r => r.deleted);
}

/** 오래된 툼스톤을 실제로 지운다 */
export function purgeTombstones<T extends Syncable>(
  recs: T[], olderThanMs = 90 * 86_400_000, now = Date.now(),
): T[] {
  return recs.filter(r => !(r.deleted && now - r.updatedAt > olderThanMs));
}

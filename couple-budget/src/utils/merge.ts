import { Syncable } from '../types';

/**
 * id 기준 last-write-wins 병합.
 *
 * updatedAt 에 serverTimestamp() 대신 Date.now() 를 쓰는 이유:
 * 오프라인 캐시를 켜면 serverTimestamp() 는 쓴 기기의 첫 스냅샷에서 null로 오고
 * 나중에야 실제 값으로 바뀐다. 그러면 그 기기에서 비교가 성립하지 않는다.
 * 두 폰의 시계가 맞다는 가정이 훨씬 안전하다.
 */
export function mergeById<T extends Syncable>(local: T[], incoming: T[]): T[] {
  const map = new Map<string, T>();
  for (const r of local) map.set(r.id, r);
  for (const r of incoming) {
    const cur = map.get(r.id);
    // 동점이면 원격을 택한다 — 두 기기가 같은 결과에 도달하도록 결정적으로 만든다
    if (!cur || r.updatedAt >= cur.updatedAt) map.set(r.id, r);
  }
  return Array.from(map.values());
}

/** 오래된 툼스톤을 실제로 지운다 (양쪽 기기가 이미 삭제를 받아본 뒤) */
export function purgeTombstones<T extends Syncable>(
  recs: T[], olderThanMs = 90 * 86_400_000, now = Date.now(),
): T[] {
  return recs.filter(r => !(r.deleted && now - r.updatedAt > olderThanMs));
}

/**
 * Firestore는 값이 undefined인 필드를 거부한다
 * ("Unsupported field value: undefined"). null로 바꾸거나 아예 뺀다.
 */
export function sanitizeForFirestore<T extends object>(rec: T): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(rec)) {
    if (v === undefined) continue;
    out[k] = v;
  }
  return out;
}

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

/**
 * 병합에서 **로컬이 이긴** 레코드만 골라낸다 — 서버로 되밀어 올릴 대상.
 *
 * push 는 setDoc 이라 서버가 updatedAt 을 비교해 주지 않는다. 그래서 오프라인에서
 * 묵힌 낡은 수정이 나중에 올라오면 상대 폰의 최신 기록을 덮어쓸 수 있다.
 * 그 스냅샷을 받은 쪽은 mergeById 로 자기 최신본을 지키지만, 서버는 여전히 낡은 채다.
 * 여기서 고른 레코드를 다시 올려야 서버도 최신본으로 수렴한다.
 *
 * 로컬에만 있는 레코드는 포함하지 않는다 (아직 안 올라간 것이지 진 것이 아니다).
 * 동점은 원격을 택하므로(mergeById) 여기서도 로컬 승자가 아니다 — 안 그러면
 * 방금 올린 기록의 메아리를 받을 때마다 다시 올리는 핑퐁이 생긴다.
 */
export function localWinners<T extends Syncable>(local: T[], incoming: T[]): T[] {
  const remote = new Map<string, T>();
  for (const r of incoming) remote.set(r.id, r);
  return local.filter(l => {
    const r = remote.get(l.id);
    return !!r && l.updatedAt > r.updatedAt;
  });
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

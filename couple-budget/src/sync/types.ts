import { CollName, Expense, MonthKey, RemoteBatch, Syncable } from '../types';

/**
 * 동기화 클라이언트 계약.
 * ⚠️ 이 파일에는 firebase import가 하나도 없어야 한다 —
 *    그래야 firebase가 메인 번들에 끌려 들어오지 않는다.
 */
export interface SyncClient {
  /** 레코드 하나를 올린다. 실패는 호출자가 무시해도 된다 (Firestore가 재시도한다) */
  push(coll: CollName, rec: Syncable): Promise<void>;

  /** 수입 + 고정지출 구독 — 개수가 적어서 전부 받는다 */
  subscribeSmall(cb: (batch: RemoteBatch) => void): () => void;

  /** 특정 달의 변동지출만 구독 */
  subscribeMonth(month: MonthKey, cb: (batch: RemoteBatch) => void): () => void;

  /** '지난 데이터 모두 불러오기' — 한 번만 전체를 긁어온다 */
  fetchAllExpenses(): Promise<Expense[]>;

  close(): Promise<void>;
}

// import type 은 컴파일하면 사라지므로 런타임 비용이 없다 (번들에 firebase가 안 들어간다)
import type { FirebaseApp } from 'firebase/app';
import {
  CollName, Expense, FirebaseWebConfig, FixedExpense, IncomeEntry, MonthKey,
  RemoteBatch, Syncable,
} from '../types';
import { sanitizeForFirestore } from '../utils/merge';
import { SyncClient } from './types';

/**
 * ★ firebase를 건드리는 유일한 파일.
 *
 * 모든 import가 동적(`await import`)이라서 webpack 5가 별도 chunk로 떼어낸다.
 * → 동기화를 안 쓰는 사람은 firebase를 1바이트도 받지 않는다.
 *
 * Firestore를 고른 이유 (Realtime Database가 아니라):
 * 웹에서 Firestore는 IndexedDB 캐시에 '대기 중인 쓰기'를 페이지 새로고침 후에도 보존하고
 * 연결되면 자동으로 재전송한다. RTDB 웹 SDK는 메모리 캐시뿐이라 탭을 닫으면 날아간다.
 * 폰에서 브라우저 탭이 수시로 정리되는 환경에서는 이 차이가 결정적이다.
 */
export async function createSyncClient(
  config: FirebaseWebConfig,
  roomCode: string,
): Promise<SyncClient> {
  const { initializeApp, getApp, deleteApp } = await import('firebase/app');
  const {
    initializeFirestore, persistentLocalCache, persistentMultipleTabManager,
    collection, doc, setDoc, onSnapshot, query, where, getDocs,
  } = await import('firebase/firestore');

  // 이름을 지정해 초기화한다 — 설정을 바꿔 다시 연결할 때 중복 초기화로 터지지 않게
  const appName = `room-${roomCode}`;
  let app: FirebaseApp;
  try {
    app = getApp(appName);
  } catch {
    app = initializeApp(config, appName);
  }

  const db = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  });

  const roomRef = doc(collection(db, 'rooms'), roomCode);
  const col = (name: CollName) => collection(roomRef, name);

  function push(name: CollName, rec: Syncable): Promise<void> {
    return setDoc(doc(col(name), rec.id), sanitizeForFirestore(rec));
  }

  function subscribeSmall(cb: (batch: RemoteBatch) => void): () => void {
    const un1 = onSnapshot(
      col('incomes'),
      snap => cb({ coll: 'incomes', records: snap.docs.map(d => d.data() as IncomeEntry) }),
      err => console.warn('수입 구독 오류:', err),
    );
    const un2 = onSnapshot(
      col('fixedExpenses'),
      snap => cb({ coll: 'fixedExpenses', records: snap.docs.map(d => d.data() as FixedExpense) }),
      err => console.warn('고정지출 구독 오류:', err),
    );
    return () => { un1(); un2(); };
  }

  function subscribeMonth(month: MonthKey, cb: (batch: RemoteBatch) => void): () => void {
    // month 필드를 비정규화해 둔 덕분에 자동 단일 필드 색인으로 처리된다 —
    // 사용자가 복합 색인을 따로 배포할 필요가 없다.
    const q = query(col('expenses'), where('month', '==', month));
    return onSnapshot(
      q,
      snap => cb({ coll: 'expenses', records: snap.docs.map(d => d.data() as Expense) }),
      err => console.warn('지출 구독 오류:', err),
    );
  }

  async function fetchAllExpenses(): Promise<Expense[]> {
    const snap = await getDocs(col('expenses'));
    return snap.docs.map(d => d.data() as Expense);
  }

  async function close(): Promise<void> {
    try {
      await deleteApp(app);
    } catch (e) {
      console.warn('연결 종료 실패:', e);
    }
  }

  return { push, subscribeSmall, subscribeMonth, fetchAllExpenses, close };
}

/** 사용자에게 보여줄 한국어 오류 메시지로 바꾼다 */
export function describeSyncError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  const code = (e as { code?: string })?.code ?? '';

  if (code.includes('permission-denied') || msg.includes('permission')) {
    return '접근이 거부되었어요. Firebase의 보안 규칙을 게시했는지, 우리집 코드가 12자 이상인지 확인해 주세요.';
  }
  if (code.includes('unavailable') || msg.includes('offline')) {
    return '인터넷에 연결되지 않았어요. 입력한 내역은 연결되면 자동으로 전송됩니다.';
  }
  if (code.includes('invalid-api-key') || msg.includes('api-key')) {
    return 'Firebase 설정의 apiKey가 올바르지 않아요. 설정을 다시 복사해 붙여넣어 주세요.';
  }
  if (code.includes('not-found') || msg.includes('project')) {
    return 'Firebase 프로젝트를 찾지 못했어요. Firestore 데이터베이스를 만들었는지 확인해 주세요.';
  }
  return `동기화 오류: ${msg}`;
}

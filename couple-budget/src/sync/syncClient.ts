// import type 은 컴파일하면 사라지므로 런타임 비용이 없다 (번들에 firebase가 안 들어간다)
import type { FirebaseApp } from 'firebase/app';
import {
  CollName, Expense, FirebaseWebConfig, FixedExpense, IncomeEntry, MonthKey,
  Person, RemoteBatch, Syncable,
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
    // 사람 목록도 여기서 받는다 — 한쪽에서 자녀를 추가하면 상대 폰에도 넘어가야
    // 그 아이 이름으로 쓴 지출의 주인이 표시된다
    const un0 = onSnapshot(
      col('persons'),
      snap => cb({ coll: 'persons', records: snap.docs.map(d => d.data() as Person) }),
      err => console.warn('사람 구독 오류:', err),
    );
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
    return () => { un0(); un1(); un2(); };
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

/**
 * 실패를 '설정 마법사 몇 번 단계 탓인지'로 번역한다.
 * step 이 있으면 화면에서 그 단계로 되돌려 보낼 수 있다.
 */
export interface SyncFailure {
  message: string;
  /** 설정 마법사 단계 번호 (1~5). 특정할 수 없으면 undefined */
  step?: number;
}

/** 시간 안에 안 끝나면 포기한다 */
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('__TIMEOUT__')), ms);
    p.then(v => { clearTimeout(t); resolve(v); },
           e => { clearTimeout(t); reject(e); });
  });
}

export function explainSyncError(e: unknown): SyncFailure {
  const msg = e instanceof Error ? e.message : String(e);
  const code = String((e as { code?: string })?.code ?? '');
  const all = `${code} ${msg}`.toLowerCase();

  if (msg === '__TIMEOUT__') {
    // Firestore가 조용히 재시도만 하고 있는 상태. 대개 프로젝트 ID가 틀렸다.
    return {
      step: 4,
      message: '응답이 없어요. 프로젝트 ID가 정확한지(오타·다른 프로젝트) 다시 확인해 주세요. 인터넷이 느린 경우에도 이럴 수 있어요.',
    };
  }
  if (msg === '__READ_BACK_FAILED__') {
    return { step: 3, message: '쓰기는 됐는데 읽기가 안 돼요. 보안 규칙의 read 권한을 확인해 주세요.' };
  }

  if (all.includes('permission-denied') || all.includes('insufficient permissions') || all.includes('permission')) {
    return {
      step: 3,
      message: '보안 규칙이 아직 적용되지 않았어요. Firestore의 [규칙] 탭에 규칙을 붙여넣고 꼭 [게시] 버튼까지 눌러 주세요.',
    };
  }
  if (all.includes('api key not valid') || all.includes('invalid-api-key') || all.includes('api-key')) {
    return {
      step: 4,
      message: '웹 API 키가 올바르지 않아요. 앞뒤 공백 없이 AIza... 로 시작하는 값을 그대로 붙여넣었는지 확인해 주세요.',
    };
  }
  if (all.includes('not-found') || all.includes('does not exist') || all.includes('404')) {
    return {
      step: 2,
      message: 'Firestore 데이터베이스를 찾지 못했어요. [빌드 → Firestore Database → 데이터베이스 만들기] 를 했는지, 프로젝트 ID가 맞는지 확인해 주세요.',
    };
  }
  if (all.includes('invalid-argument') || all.includes('project')) {
    return {
      step: 4,
      message: '프로젝트 ID가 올바르지 않아요. 주소(링크)가 아니라 wooricip-a1b2c 같은 짧은 이름이어야 합니다.',
    };
  }
  if (all.includes('unavailable') || all.includes('offline') || all.includes('network')) {
    return {
      message: '인터넷에 연결되지 않았어요. 입력한 내역은 연결되면 자동으로 전송됩니다.',
    };
  }
  return { message: `연결에 실패했어요: ${msg}` };
}

/** 기존 호출부 호환용 — 문구만 뽑아 쓴다 */
export function describeSyncError(e: unknown): string {
  return explainSyncError(e).message;
}

/**
 * 진짜로 읽고 쓸 수 있는지 확인한다.
 * 방 안에 임시 문서를 하나 썼다가 읽고 지운다 — 보안 규칙
 * `match /rooms/{roomCode}/{document=**}` 범위 안이라 그대로 통과한다.
 */
export async function testConnection(
  config: FirebaseWebConfig,
  roomCode: string,
): Promise<{ ok: true } | ({ ok: false } & SyncFailure)> {
  try {
    const { initializeApp, getApp, deleteApp } = await import('firebase/app');
    const { initializeFirestore, collection, doc, setDoc, getDoc, deleteDoc } =
      await import('firebase/firestore');

    // 본 연결과 섞이지 않게 일회용 앱 이름을 쓴다
    const appName = `test-${roomCode}-${Date.now()}`;
    let app;
    try {
      app = getApp(appName);
    } catch {
      app = initializeApp(config, appName);
    }

    try {
      // 테스트에는 오프라인 캐시를 쓰지 않는다 —
      // 캐시가 있으면 서버에 못 닿아도 쓰기가 '성공'해 버려서 검사가 무의미해진다
      const db = initializeFirestore(app, {});
      const ref = doc(collection(doc(collection(db, 'rooms'), roomCode), '_test'), 'ping');

      // ⚠️ Firestore는 프로젝트가 없거나 주소가 틀리면 오류를 내지 않고 '무한 재시도'한다.
      //    그대로 두면 화면이 '확인 중…'에서 영영 멈추므로 반드시 시간 제한을 건다.
      await withTimeout(
        (async () => {
          await setDoc(ref, { t: Date.now() });
          const snap = await getDoc(ref);
          if (!snap.exists()) throw new Error('__READ_BACK_FAILED__');
          await deleteDoc(ref);
        })(),
        15000,
      );
      return { ok: true };
    } finally {
      await deleteApp(app).catch(() => {});
    }
  } catch (e) {
    return { ok: false, ...explainSyncError(e) };
  }
}

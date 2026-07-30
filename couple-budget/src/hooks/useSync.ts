import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CollName, Expense, MonthKey, RemoteBatch, Syncable, SyncSettings, SyncStatus,
} from '../types';
import { SyncClient } from '../sync/types';
import { isValidRoomCode, parseFirebaseConfig } from '../utils/roomCode';

interface UseSyncArgs {
  sync: SyncSettings;
  month: MonthKey;
  onBatch: (batch: RemoteBatch) => void;
}

/**
 * 동기화 클라이언트의 수명을 관리한다.
 * 설정이 없거나 꺼져 있으면 아무것도 하지 않는다 (그래서 firebase도 안 받아온다).
 */
export function useSync({ sync, month, onBatch }: UseSyncArgs) {
  const [status, setStatus] = useState<SyncStatus>('off');
  const [error, setError] = useState('');
  const clientRef = useRef<SyncClient | null>(null);

  // 콜백이 매 렌더마다 바뀌어도 구독을 다시 만들지 않도록 ref에 담는다
  const onBatchRef = useRef(onBatch);
  onBatchRef.current = onBatch;

  const parsed = useMemo(() => {
    if (!sync.enabled) return null;
    if (!isValidRoomCode(sync.roomCode)) return null;
    const r = parseFirebaseConfig(sync.firebaseConfigText);
    return r.ok ? { config: r.config, roomCode: sync.roomCode.trim() } : null;
  }, [sync.enabled, sync.roomCode, sync.firebaseConfigText]);

  // 연결 / 재연결
  useEffect(() => {
    if (!parsed) {
      setStatus('off');
      setError('');
      return;
    }

    let cancelled = false;
    let unsubSmall: (() => void) | undefined;

    setStatus('connecting');
    setError('');

    (async () => {
      // 모듈을 먼저 한 번만 받아온다 — 성공 경로와 오류 경로가 같은 참조를 쓴다
      const mod = await import('../sync/syncClient');
      try {
        const client = await mod.createSyncClient(parsed.config, parsed.roomCode);
        if (cancelled) { await client.close(); return; }

        clientRef.current = client;
        unsubSmall = client.subscribeSmall(b => onBatchRef.current(b));
        setStatus('live');
      } catch (e) {
        if (cancelled) return;
        setStatus('error');
        setError(mod.describeSyncError(e));
      }
    })();

    return () => {
      cancelled = true;
      unsubSmall?.();
      const c = clientRef.current;
      clientRef.current = null;
      void c?.close();
    };
  }, [parsed]);

  // 보고 있는 달의 지출만 구독한다 — 달을 옮기면 다시 구독
  useEffect(() => {
    if (status !== 'live') return;
    const client = clientRef.current;
    if (!client) return;
    return client.subscribeMonth(month, b => onBatchRef.current(b));
  }, [status, month]);

  /** 로컬 변경을 클라우드로 밀어 올린다. 실패해도 앱은 계속 돈다. */
  const push = useCallback((coll: CollName, rec: Syncable) => {
    const client = clientRef.current;
    if (!client) return;
    client.push(coll, rec).catch(e => {
      // Firestore가 오프라인 큐로 재시도하므로 대부분 무해하다.
      // 다만 조용히 삼키면 undefined 필드 같은 실제 버그를 놓치므로 남긴다.
      console.warn('동기화 전송 실패:', e);
    });
  }, []);

  const fetchAllExpenses = useCallback(async (): Promise<Expense[]> => {
    const client = clientRef.current;
    if (!client) return [];
    return client.fetchAllExpenses();
  }, []);

  const isLive = status === 'live';

  return { status, error, push, fetchAllExpenses, isLive };
}

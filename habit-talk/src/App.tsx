import React, { useCallback, useEffect, useRef, useState } from 'react';
import ChatRoomView from './components/ChatRoomView';
import FriendListView from './components/FriendListView';
import InstallGuide from './components/InstallGuide';
import SettingsView from './components/SettingsView';
import { allDone, goodbye, itemDone, praise } from './chat/scripts';
import { isNewSession, reply } from './chat/replyEngine';
import {
  buildPushConfig,
  catchUp,
  configHash,
  dateKey,
  ensureLog,
  randomFriend,
  slotMessages,
} from './schedule';
import {
  disablePush,
  enablePush,
  loadPushConfig,
  pushConfigured,
  readHints,
  refreshSubscription,
  registerServiceWorker,
} from './push/register';
import { emptyState, loadState, saveState, trimState } from './storage';
import { AppState, CheckItem, Message } from './types';

type View = 'list' | 'room' | 'settings' | 'install';

/** 친구가 바로 답하면 기계 같으니 조금 뜸을 들인다 */
const TYPING_MS = 900;

let seq = 0;
function newMessageId(): string {
  seq += 1;
  return `m-${Date.now().toString(36)}-${seq.toString(36)}`;
}

export default function App() {
  const [state, setState] = useState<AppState>(() => loadState());
  const [view, setView] = useState<View>('list');
  const [openId, setOpenId] = useState<string>('');
  const [now, setNow] = useState(() => new Date());
  const [typing, setTyping] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushError, setPushError] = useState('');
  /** 푸시 서버 주소를 다 읽었는지 — 설정 화면의 안내문이 이걸 보고 달라진다 */
  const [pushReady, setPushReady] = useState(false);

  /** 이번 대화에서 아이가 몇 번 말했는지 (마무리 시점 계산용, 세션 단위) */
  const turnRef = useRef(0);
  const lastChildAtRef = useRef(0);
  const timersRef = useRef<number[]>([]);

  const update = useCallback((fn: (prev: AppState) => AppState) => {
    setState((prev) => {
      const next = trimState(fn(prev));
      saveState(next);
      return next;
    });
  }, []);

  // ── 밀린 메시지 풀어놓기 ────────────────────────────
  // 앱을 열 때, 화면으로 돌아올 때, 그리고 1분마다 확인한다.
  // 알림은 서비스워커가 띄우므로 여기서는 말풍선만 채운다.
  const runCatchUp = useCallback(async () => {
    const hints = await readHints();
    const at = new Date();
    setNow(at);
    update((prev) => {
      const { messages, delivered } = catchUp(prev, at, hints);
      if (messages.length === 0) return prev;
      return {
        ...prev,
        messages: [...prev.messages, ...messages],
        delivered: [...prev.delivered, ...delivered].slice(-120),
      };
    });
  }, [update]);

  useEffect(() => {
    void registerServiceWorker();
    void runCatchUp();
    // 푸시 서버 주소는 배포 때 채워지는 파일에서 읽는다
    void loadPushConfig().then(() => setPushReady(true));

    const tick = window.setInterval(() => void runCatchUp(), 60_000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void runCatchUp();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(tick);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [runCatchUp]);

  // 컴포넌트가 사라질 때 예약된 답장 타이머를 정리한다
  useEffect(() => {
    const timers = timersRef.current;
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, []);

  // ── 설정이 바뀌면 Worker 에 다시 올린다 ──────────────
  // 내용이 그대로면 올리지 않는다 — KV 무료 한도가 하루 1,000회 쓰기라 아껴야 한다.
  useEffect(() => {
    if (!state.push.enabled || !pushConfigured()) return;
    const config = buildPushConfig(state, state.push.deviceId);
    const hash = configHash(config);
    if (hash === state.push.syncedHash) return;

    let cancelled = false;
    void (async () => {
      const res = await refreshSubscription(config, state.push.passphrase, state.push.endpoint);
      if (cancelled) return;
      if (res.ok) {
        setPushError('');
        update((prev) => ({
          ...prev,
          push: { ...prev.push, syncedHash: hash, endpoint: res.endpoint ?? prev.push.endpoint },
        }));
      } else if (res.reason) {
        setPushError(res.reason);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [state, update]);

  const openFriend = useCallback(
    (friendId: string) => {
      setOpenId(friendId);
      setView('room');
      turnRef.current = 0;
      update((prev) => ({ ...prev, lastRead: { ...prev.lastRead, [friendId]: Date.now() } }));
    },
    [update]
  );

  const friend = state.friends.find((f) => f.id === openId) ?? state.friends[0];

  /** 친구 말풍선을 잠시 뒤에 띄운다 */
  const sayLater = useCallback(
    (friendId: string, text: string, delay: number) => {
      setTyping(true);
      const t = window.setTimeout(() => {
        setTyping(false);
        const at = Date.now();
        update((prev) => ({
          ...prev,
          messages: [
            ...prev.messages,
            { id: newMessageId(), friendId, from: 'friend', kind: 'text', text, at },
          ],
          lastRead: { ...prev.lastRead, [friendId]: at },
        }));
      }, delay);
      timersRef.current.push(t);
    },
    [update]
  );

  // ── 아이가 보낸 말에 답하기 ─────────────────────────
  const handleSend = useCallback(
    (text: string) => {
      if (!friend) return;
      const at = Date.now();

      // 오래 조용했으면 새 대화로 친다 — 하루 단위로 세면 아침 수다 때문에
      // 점심 대화가 시작하자마자 끝나버린다
      if (isNewSession(lastChildAtRef.current, at)) turnRef.current = 0;
      turnRef.current += 1;
      lastChildAtRef.current = at;

      update((prev) => ({
        ...prev,
        messages: [
          ...prev.messages,
          { id: newMessageId(), friendId: friend.id, from: 'me', kind: 'text', text, at },
        ],
        lastRead: { ...prev.lastRead, [friend.id]: at },
      }));

      const recent = state.messages
        .filter((m) => m.friendId === friend.id && m.from === 'friend')
        .slice(-4)
        .map((m) => m.text);

      const r = reply(text, {
        friend,
        profile: state.profile,
        turn: turnRef.current,
        recent,
      });
      if (r.closing) turnRef.current = 0;
      sayLater(friend.id, r.text, TYPING_MS);
    },
    [friend, state.messages, state.profile, sayLater, update]
  );

  // ── 체크리스트 항목을 눌렀을 때 ─────────────────────
  const handleCheck = useCallback(
    (messageId: string, item: CheckItem) => {
      if (!friend) return;
      const at = Date.now();
      const ctx = { friend, profile: state.profile };
      const today = dateKey(new Date(at));

      let finishedSlot = false;

      update((prev) => {
        const target = prev.messages.find((m) => m.id === messageId);
        if (!target || !target.pending?.includes(item.id)) return prev;

        const pending = target.pending.filter((id) => id !== item.id);
        finishedSlot = pending.length === 0;

        const log = ensureLog(prev.logs, today);
        const slotId = target.slotId ?? '';
        const nextLog = {
          ...log,
          done: { ...log.done, [slotId]: { ...(log.done[slotId] ?? {}), [item.id]: true } },
          stars: log.stars + (finishedSlot ? 1 : 0),
        };

        const mine: Message = {
          id: newMessageId(),
          friendId: friend.id,
          from: 'me',
          kind: 'text',
          text: itemDone(item, ctx),
          at,
        };

        return {
          ...prev,
          messages: prev.messages
            .map((m) => (m.id === messageId ? { ...m, pending } : m))
            .concat(mine),
          logs: [...prev.logs.filter((l) => l.date !== today), nextLog].sort((a, b) =>
            a.date < b.date ? -1 : 1
          ),
          lastRead: { ...prev.lastRead, [friend.id]: at },
        };
      });

      const seed = at % 1000;
      if (finishedSlot) {
        sayLater(friend.id, allDone(ctx, seed), TYPING_MS);
        // 다 했으면 인사하고 대화를 접는다 — 사용자가 요청한 "나중에 또 연락하자"
        sayLater(friend.id, goodbye(ctx, seed + 5), TYPING_MS + 1400);
        turnRef.current = 0;
      } else {
        sayLater(friend.id, praise(ctx, seed), TYPING_MS);
      }
    },
    [friend, state.profile, sayLater, update]
  );

  // ── 설정의 "지금 보내보기" ──────────────────────────
  const handleTestSlot = useCallback(
    (slotId: string) => {
      const slot = state.slots.find((s) => s.id === slotId);
      if (!slot) return;
      const picked = randomFriend(state.friends);
      const at = Date.now();
      const msgs = slotMessages(slot, picked, { friend: picked, profile: state.profile }, at);
      update((prev) => ({ ...prev, messages: [...prev.messages, ...msgs] }));
      openFriend(picked.id);
    },
    [state.slots, state.friends, state.profile, update, openFriend]
  );

  // ── 알림 켜기/끄기 ─────────────────────────────────
  const handleTogglePush = useCallback(
    async (on: boolean) => {
      setPushBusy(true);
      setPushError('');
      try {
        if (!on) {
          await disablePush(state.push.deviceId, state.push.passphrase);
          update((prev) => ({
            ...prev,
            push: { ...prev.push, enabled: false, syncedHash: '', endpoint: '' },
          }));
          return;
        }
        const config = buildPushConfig(state, state.push.deviceId);
        const res = await enablePush(config, state.push.passphrase);
        if (!res.ok) {
          setPushError(res.reason ?? '알림을 켜지 못했어요.');
          return;
        }
        update((prev) => ({
          ...prev,
          push: {
            ...prev.push,
            enabled: true,
            syncedHash: configHash(config),
            endpoint: res.endpoint ?? '',
          },
        }));
      } finally {
        setPushBusy(false);
      }
    },
    [state, update]
  );

  const handleReset = useCallback(() => {
    const fresh = emptyState();
    saveState(fresh);
    setState(fresh);
    setView('list');
  }, []);

  // ── 화면 ───────────────────────────────────────────
  const title =
    view === 'room' && friend
      ? friend.name
      : view === 'settings'
      ? '설정'
      : view === 'install'
      ? '설치 안내'
      : '톡톡 습관친구';

  return (
    <div className="app">
      <header className="header">
        {view !== 'list' ? (
          <button aria-label="뒤로" onClick={() => setView('list')}>
            ‹
          </button>
        ) : (
          <button aria-label="설치 안내" onClick={() => setView('install')}>
            📱
          </button>
        )}
        <h1>
          {title}
          {view === 'list' && (
            <>
              {' '}
              <span className="sub">{state.profile.childName}</span>
            </>
          )}
        </h1>
        {view === 'list' && (
          <button aria-label="설정" onClick={() => setView('settings')}>
            ⚙️
          </button>
        )}
      </header>

      {view === 'list' && <FriendListView state={state} now={now} onOpen={openFriend} />}

      {view === 'room' && friend && (
        <ChatRoomView
          state={state}
          friend={friend}
          typing={typing}
          onSend={handleSend}
          onCheck={handleCheck}
        />
      )}

      {view === 'settings' && (
        <SettingsView
          state={state}
          pushReady={pushReady}
          pushBusy={pushBusy}
          pushError={pushError}
          onChange={(next) => update(() => next)}
          onTogglePush={(on) => void handleTogglePush(on)}
          onTestSlot={handleTestSlot}
          onReset={handleReset}
        />
      )}

      {view === 'install' && <InstallGuide />}
    </div>
  );
}

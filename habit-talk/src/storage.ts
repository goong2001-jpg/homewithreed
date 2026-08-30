import { DEFAULT_FRIENDS, DEFAULT_PROFILE, DEFAULT_SLOTS } from './data/defaults';
import { AppState, STATE_VERSION, STORAGE_KEY } from './types';

/**
 * 이 앱은 서버에 아무것도 저장하지 않는다. localStorage 가 유일한 사본이라
 * 브라우저 데이터를 지우면 대화도 기록도 사라진다.
 * 설정 화면의 백업 내보내기(utils/backup.ts)가 사실상 유일한 방어선이다.
 */

function newDeviceId(): string {
  // crypto.randomUUID 는 안전한 컨텍스트에서만 있다 — 없으면 대충 만든다
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  } catch {
    // 무시하고 아래로
  }
  return `d-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function emptyState(): AppState {
  return {
    version: STATE_VERSION,
    profile: { ...DEFAULT_PROFILE },
    friends: DEFAULT_FRIENDS.map((f) => ({ ...f })),
    slots: DEFAULT_SLOTS.map((s) => ({ ...s, items: s.items.map((i) => ({ ...i })) })),
    messages: [],
    logs: [],
    lastRead: {},
    delivered: [],
    push: { enabled: false, deviceId: newDeviceId(), passphrase: '', syncedHash: '', endpoint: '' },
  };
}

/** 저장된 값이 반쯤 깨져 있어도 앱이 죽지 않게, 필드마다 기본값으로 메운다 */
function reconcile(raw: unknown): AppState {
  const base = emptyState();
  if (!raw || typeof raw !== 'object') return base;
  const s = raw as Partial<AppState>;

  return {
    version: STATE_VERSION,
    profile: { ...base.profile, ...(s.profile ?? {}) },
    friends: Array.isArray(s.friends) && s.friends.length > 0 ? s.friends : base.friends,
    slots: Array.isArray(s.slots) && s.slots.length > 0 ? s.slots : base.slots,
    messages: Array.isArray(s.messages) ? s.messages : [],
    logs: Array.isArray(s.logs) ? s.logs : [],
    lastRead: s.lastRead && typeof s.lastRead === 'object' ? s.lastRead : {},
    delivered: Array.isArray(s.delivered) ? s.delivered : [],
    // deviceId 는 한 번 정해지면 유지해야 Worker 쪽 구독이 갈라지지 않는다
    push: { ...base.push, ...(s.push ?? {}), deviceId: s.push?.deviceId || base.push.deviceId },
  };
}

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyState();
    return reconcile(JSON.parse(raw));
  } catch {
    return emptyState();
  }
}

export function saveState(state: AppState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // 저장 실패(프라이빗 모드·용량 초과)는 무시한다. 화면은 계속 돌아간다
  }
}

/** 대화가 무한정 쌓이지 않게 잘라낸다. 카톡처럼 최근 것만 있으면 된다 */
export const MAX_MESSAGES = 400;
/** 기록은 두 달치만 남긴다 */
export const MAX_LOGS = 62;

export function trimState(state: AppState): AppState {
  if (state.messages.length <= MAX_MESSAGES && state.logs.length <= MAX_LOGS) return state;
  return {
    ...state,
    messages: state.messages.slice(-MAX_MESSAGES),
    logs: state.logs.slice(-MAX_LOGS),
  };
}

export function clearAll(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // 무시
  }
}

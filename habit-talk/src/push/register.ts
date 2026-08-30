import { PushConfig } from '../types';

/**
 * 푸시 알림 연결.
 *
 * 환경변수(REACT_APP_VAPID_PUBLIC_KEY · REACT_APP_PUSH_ENDPOINT)가 비어 있으면
 * 이 모듈은 통째로 잠긴다 — Cloudflare Worker 를 안 띄워도 앱은 정상 동작한다.
 *
 * ⚠️ 아이폰 주의사항 (habit-push/README.md 에도 적어뒀다)
 *   - iOS 16.4+ 에서, 홈 화면에 추가한 앱 안에서만 푸시가 된다. 사파리 탭에서는 안 된다.
 *   - 홈 화면 앱과 사파리는 저장소가 완전히 분리돼 있다. 사파리에서 설정해도
 *     홈 화면 앱에는 안 넘어간다 → 설치부터 하고 설정하라고 안내해야 한다.
 *   - Safari 는 pushsubscriptionchange 를 안 쏜다. 그래서 앱을 열 때마다
 *     getSubscription() 으로 직접 확인하고, 없으면 다시 구독한다.
 */

/**
 * 푸시 서버 주소는 빌드에 박지 않고 public/push-config.json 에서 읽는다.
 * 공개키는 거기 적지 않고 서버의 /health 에서 받아온다 — 그래야 서버에서 키를
 * 바꿔도 앱을 다시 배포할 필요가 없고, 키가 어긋날 일도 없다.
 *
 * 환경변수(.env.local)를 넣어두면 그게 우선한다 — 로컬에서 시험할 때 쓴다.
 */
export let VAPID_PUBLIC_KEY = (process.env.REACT_APP_VAPID_PUBLIC_KEY || '').trim();
export let PUSH_ENDPOINT = (process.env.REACT_APP_PUSH_ENDPOINT || '').trim().replace(/\/$/, '');

let configLoaded = VAPID_PUBLIC_KEY.length > 0 && PUSH_ENDPOINT.length > 0;

async function readEndpoint(): Promise<string> {
  if (PUSH_ENDPOINT) return PUSH_ENDPOINT;
  try {
    const res = await fetch(`${process.env.PUBLIC_URL || ''}/push-config.json`, { cache: 'no-cache' });
    if (!res.ok) return '';
    const data = await res.json();
    return String(data?.endpoint ?? '').trim().replace(/\/$/, '');
  } catch {
    return '';
  }
}

/**
 * 앱이 뜰 때 한 번 부른다.
 * 주소를 읽고, 그 서버에서 공개키를 받아온다. 어느 쪽이든 실패하면 푸시만 잠긴다.
 */
export async function loadPushConfig(): Promise<boolean> {
  if (configLoaded) return true;

  const endpoint = await readEndpoint();
  if (!endpoint) return false;

  try {
    const res = await fetch(`${endpoint}/health`, { cache: 'no-cache' });
    if (!res.ok) return false;
    const data = await res.json();
    const key = String(data?.vapidPublicKey ?? '').trim();
    if (!key) return false; // 서버는 떴는데 키가 아직 없다
    PUSH_ENDPOINT = endpoint;
    VAPID_PUBLIC_KEY = key;
    configLoaded = true;
    return true;
  } catch {
    return false;
  }
}

/** 푸시 서버가 연결돼 있는지 */
export function pushConfigured(): boolean {
  return configLoaded;
}

/** 브라우저가 푸시를 지원하는지 */
export function pushSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    'serviceWorker' in navigator &&
    typeof window !== 'undefined' &&
    'PushManager' in window &&
    'Notification' in window
  );
}

/** 홈 화면에 추가한 상태로 실행 중인지 — 아이폰은 이게 참이어야 푸시가 된다 */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const iosStandalone = (window.navigator as { standalone?: boolean }).standalone === true;
  const displayMode = window.matchMedia?.('(display-mode: standalone)').matches === true;
  return iosStandalone || displayMode;
}

export type Platform = 'ios' | 'android' | 'other';

export function platform(): Platform {
  if (typeof navigator === 'undefined') return 'other';
  const ua = navigator.userAgent;
  // 아이패드는 최근 iPadOS 에서 맥으로 위장하니 터치 지원까지 같이 본다
  if (/iPhone|iPod/.test(ua)) return 'ios';
  if (/iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'ios';
  if (/Android/.test(ua)) return 'android';
  return 'other';
}

/** 아이폰인데 아직 홈 화면 앱이 아니면 푸시를 켤 수 없다 */
export function needsInstallFirst(): boolean {
  return platform() === 'ios' && !isStandalone();
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const normal = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(normal);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

let registration: ServiceWorkerRegistration | null = null;

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!pushSupported()) return null;
  if (registration) return registration;
  try {
    registration = await navigator.serviceWorker.register(
      `${process.env.PUBLIC_URL || ''}/sw.js`,
      // 서비스워커 파일은 이름에 해시가 안 붙으니 HTTP 캐시를 아예 건너뛴다
      { updateViaCache: 'none' }
    );
    return registration;
  } catch {
    return null;
  }
}

export interface SubscribeResult {
  ok: boolean;
  /** 실패했을 때 화면에 그대로 보여줄 한국어 사유 */
  reason?: string;
  endpoint?: string;
}

/**
 * 알림 권한을 받고 구독한다.
 * ⚠️ 반드시 버튼 클릭 같은 사용자 동작 안에서 불러야 한다 (특히 iOS).
 */
export async function enablePush(config: PushConfig, passphrase: string): Promise<SubscribeResult> {
  if (!pushConfigured()) return { ok: false, reason: '이 빌드에는 푸시 서버 주소가 없어요.' };
  if (!pushSupported()) return { ok: false, reason: '이 브라우저는 푸시 알림을 지원하지 않아요.' };
  if (needsInstallFirst()) {
    return { ok: false, reason: '아이폰은 먼저 홈 화면에 추가한 뒤, 그 앱 안에서 켜야 해요.' };
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    return { ok: false, reason: '알림 권한이 허용되지 않았어요. 폰 설정에서 허용해 주세요.' };
  }

  const reg = await registerServiceWorker();
  if (!reg) return { ok: false, reason: '서비스워커를 등록하지 못했어요.' };
  await navigator.serviceWorker.ready;

  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    try {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
      });
    } catch {
      return { ok: false, reason: '구독에 실패했어요. 잠시 뒤 다시 시도해 주세요.' };
    }
  }

  const sent = await uploadConfig(sub, config, passphrase);
  if (!sent.ok) return sent;
  return { ok: true, endpoint: sub.endpoint };
}

/** 설정(시간표·친구 이름)을 Worker 에 올린다. 알림 문구도 여기 같이 올라간다 */
export async function uploadConfig(
  subscription: PushSubscription,
  config: PushConfig,
  passphrase: string
): Promise<SubscribeResult> {
  try {
    const res = await fetch(`${PUSH_ENDPOINT}/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passphrase, subscription: subscription.toJSON(), config }),
    });
    if (res.status === 401) return { ok: false, reason: '알림 암호가 맞지 않아요. 설정에서 다시 확인해 주세요.' };
    if (!res.ok) return { ok: false, reason: `알림 서버가 응답하지 않아요 (${res.status}).` };
    return { ok: true, endpoint: subscription.endpoint };
  } catch {
    return { ok: false, reason: '알림 서버에 연결하지 못했어요. 인터넷을 확인해 주세요.' };
  }
}

/**
 * 앱을 열 때마다 부른다.
 * 구독이 살아 있는지 확인하고, 설정이 바뀌었으면 다시 올린다.
 * (Safari 는 pushsubscriptionchange 를 안 쏘니 여기서 직접 챙긴다)
 */
export async function refreshSubscription(
  config: PushConfig,
  passphrase: string,
  knownEndpoint: string
): Promise<SubscribeResult> {
  if (!pushConfigured() || !pushSupported()) return { ok: false };
  if (Notification.permission !== 'granted') return { ok: false, reason: '알림 권한이 꺼져 있어요.' };

  const reg = await registerServiceWorker();
  if (!reg) return { ok: false };
  await navigator.serviceWorker.ready;

  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    // 구독이 사라졌다 — 조용히 다시 만든다
    try {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
      });
    } catch {
      return { ok: false, reason: '알림 구독이 끊어졌어요. 설정에서 다시 켜주세요.' };
    }
  }

  // endpoint 가 그대로고 설정도 안 바뀌었으면 호출한 쪽에서 이미 걸렀다
  return uploadConfig(sub, config, passphrase);
}

export async function disablePush(deviceId: string, passphrase: string): Promise<void> {
  try {
    const reg = await registerServiceWorker();
    const sub = await reg?.pushManager.getSubscription();
    if (sub) await sub.unsubscribe();
    if (pushConfigured()) {
      await fetch(`${PUSH_ENDPOINT}/unsubscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passphrase, deviceId }),
      });
    }
  } catch {
    // 꺼지기만 하면 되니 실패는 무시한다
  }
}

/**
 * 서비스워커가 남긴 "이 슬롯은 이 친구가 보냈다" 기록을 읽는다.
 * 푸시 알림에 뜬 친구와 채팅방에 들어온 친구가 달라지지 않게 하려는 것.
 */
export async function readHints(): Promise<Record<string, string>> {
  if (typeof caches === 'undefined') return {};
  try {
    const cache = await caches.open('habit-talk-hints');
    const base = (await navigator.serviceWorker?.getRegistration())?.scope || window.location.href;
    const res = await cache.match(new URL('hints.json', base).toString());
    if (!res) return {};
    const data = await res.json();
    return data && typeof data === 'object' ? data : {};
  } catch {
    return {};
  }
}

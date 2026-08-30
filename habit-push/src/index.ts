/**
 * 톡톡 습관친구 — 푸시 알림 스케줄러 (Cloudflare Worker)
 *
 * 하는 일은 딱 하나다: 1분마다 깨어나서 "지금 알림 보낼 시간인 기기가 있나" 보고, 있으면 쏜다.
 *
 * 메시지 문구·발신 친구 후보는 전부 앱이 정해서 올려준다(POST /subscribe).
 * Worker 는 그중에서 무작위로 하나씩 골라 쓰기만 한다. 그래서 부모가 앱에서
 * 시간이나 문구를 바꿔도 Worker 를 다시 배포할 필요가 없다.
 *
 * ── 무료 한도를 지키려고 신경 쓴 곳 ──────────────────────────
 * KV 무료 한도는 하루 읽기 10만 / 쓰기·목록조회 각 1,000회다.
 *  · list() 를 절대 쓰지 않는다. 1분마다 부르면 하루 1,440번이라 그것만으로 한도 초과다.
 *    대신 'devices' 키 하나에 기기 목록을 통째로 담는다.
 *  · 매 tick 마다 쓰지 않는다. 설정이 그대로면 쓰기를 건너뛴다.
 *  · 쓰기는 실제 발송 표시(하루 몇 번)와 설정 변경 때만 일어난다.
 */

import { deserializeVapidKeys, sendPushNotification } from 'web-push-browser';

export interface Env {
  HABIT_KV: KVNamespace;
  ALLOWED_ORIGIN: string;
  VAPID_PUBLIC_KEY: string;
  VAPID_SUBJECT: string;
  /** wrangler secret put VAPID_PRIVATE_KEY */
  VAPID_PRIVATE_KEY: string;
  /** wrangler secret put PASSPHRASE */
  PASSPHRASE: string;
}

interface PushSlotConfig {
  id: string;
  /** "HH:MM" 기기 현지 시각 */
  time: string;
  title: string;
  /** 알림 본문 후보 — 아이 이름까지 다 채워진 완성 문장들 */
  bodies: string[];
}

interface DeviceConfig {
  deviceId: string;
  /** IANA 타임존. 예: "Asia/Seoul" */
  timezone: string;
  friends: { id: string; name: string; emoji: string }[];
  slots: PushSlotConfig[];
}

interface StoredSubscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

interface Device {
  deviceId: string;
  subscription: StoredSubscription;
  config: DeviceConfig;
  updatedAt: number;
}

const DEVICES_KEY = 'devices';
/** 한 가족용이다. 이 이상은 장난이나 사고로 본다 */
const MAX_DEVICES = 4;
/** cron 이 늦게 돌 수도 있어서, 예정 시각부터 이만큼 안이면 발송한다 (분) */
const FIRE_WINDOW_MINUTES = 5;
/** 발송 표시는 이틀이면 충분하다 (초) */
const SENT_TTL_SECONDS = 60 * 60 * 48;

/**
 * KV 는 쓴 값이 바로 안 보일 수 있다(최대 1분쯤). 그 사이 tick 에서 중복 발송이
 * 나지 않게 메모리에도 같이 남긴다. 아이솔레이트가 살아 있는 동안만 유효한
 * 보조 수단이라, 이것만 믿지는 않는다.
 */
const sentInMemory = new Set<string>();

// ── 유틸 ─────────────────────────────────────────────

function corsHeaders(env: Env): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

function json(body: unknown, status: number, env: Env): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(env) },
  });
}

/** 길이가 달라도 시간이 새지 않게 비교한다 */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function readDevices(env: Env): Promise<Device[]> {
  const raw = await env.HABIT_KV.get(DEVICES_KEY, 'json');
  return Array.isArray(raw) ? (raw as Device[]) : [];
}

async function writeDevices(env: Env, devices: Device[]): Promise<void> {
  await env.HABIT_KV.put(DEVICES_KEY, JSON.stringify(devices));
}

/** 기기 현지 시각을 "HH:MM" 과 "YYYY-MM-DD" 로 뽑는다 */
export function localParts(now: Date, timezone: string): { hhmm: string; date: string; minutes: number } {
  let tz = timezone;
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).formatToParts(now);
  } catch {
    // 타임존 문자열이 이상하면 한국 시간으로 떨어뜨린다
    tz = 'Asia/Seoul';
    parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).formatToParts(now);
  }

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00';
  // Intl 은 자정을 "24" 로 주기도 한다
  const hour = get('hour') === '24' ? '00' : get('hour');
  const minute = get('minute');
  return {
    hhmm: `${hour}:${minute}`,
    date: `${get('year')}-${get('month')}-${get('day')}`,
    minutes: Number(hour) * 60 + Number(minute),
  };
}

export function parseHHMM(time: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(time);
  if (!m) return -1;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return -1;
  return h * 60 + min;
}

function choose<T>(list: T[]): T {
  return list[Math.floor(Math.random() * list.length)];
}

// ── 설정 등록 ────────────────────────────────────────

function validConfig(c: unknown): c is DeviceConfig {
  if (!c || typeof c !== 'object') return false;
  const d = c as DeviceConfig;
  if (typeof d.deviceId !== 'string' || d.deviceId.length === 0 || d.deviceId.length > 100) {
    return false;
  }
  if (typeof d.timezone !== 'string' || d.timezone.length > 64) return false;
  if (!Array.isArray(d.friends) || d.friends.length === 0 || d.friends.length > 20) return false;
  if (!Array.isArray(d.slots) || d.slots.length > 20) return false;
  for (const s of d.slots) {
    if (!s || typeof s.id !== 'string' || parseHHMM(s.time) < 0) return false;
    if (!Array.isArray(s.bodies) || s.bodies.length === 0 || s.bodies.length > 40) return false;
    if (s.bodies.some((b) => typeof b !== 'string' || b.length > 300)) return false;
  }
  return true;
}

function validSubscription(s: unknown): s is StoredSubscription {
  if (!s || typeof s !== 'object') return false;
  const sub = s as StoredSubscription;
  if (typeof sub.endpoint !== 'string' || !sub.endpoint.startsWith('https://')) return false;
  if (sub.endpoint.length > 1000) return false;
  return (
    !!sub.keys && typeof sub.keys.p256dh === 'string' && typeof sub.keys.auth === 'string'
  );
}

async function handleSubscribe(request: Request, env: Env): Promise<Response> {
  let body: { passphrase?: string; subscription?: unknown; config?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'bad json' }, 400, env);
  }

  if (!env.PASSPHRASE || !safeEqual(body.passphrase ?? '', env.PASSPHRASE)) {
    return json({ error: 'unauthorized' }, 401, env);
  }
  if (!validSubscription(body.subscription) || !validConfig(body.config)) {
    return json({ error: 'bad payload' }, 400, env);
  }

  const subscription = body.subscription;
  const config = body.config;

  const devices = await readDevices(env);
  const existing = devices.find((d) => d.deviceId === config.deviceId);

  // 내용이 그대로면 쓰지 않는다 — KV 쓰기 한도(하루 1,000회)를 아끼는 핵심
  if (
    existing &&
    existing.subscription.endpoint === subscription.endpoint &&
    JSON.stringify(existing.config) === JSON.stringify(config)
  ) {
    return json({ ok: true, unchanged: true }, 200, env);
  }

  const next = devices.filter((d) => d.deviceId !== config.deviceId);
  next.push({ deviceId: config.deviceId, subscription, config, updatedAt: Date.now() });
  // 넘치면 오래된 것부터 버린다
  next.sort((a, b) => b.updatedAt - a.updatedAt);
  await writeDevices(env, next.slice(0, MAX_DEVICES));

  return json({ ok: true }, 200, env);
}

async function handleUnsubscribe(request: Request, env: Env): Promise<Response> {
  let body: { passphrase?: string; deviceId?: string };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'bad json' }, 400, env);
  }
  if (!env.PASSPHRASE || !safeEqual(body.passphrase ?? '', env.PASSPHRASE)) {
    return json({ error: 'unauthorized' }, 401, env);
  }

  const devices = await readDevices(env);
  const next = devices.filter((d) => d.deviceId !== body.deviceId);
  if (next.length !== devices.length) await writeDevices(env, next);
  return json({ ok: true }, 200, env);
}

// ── 발송 ─────────────────────────────────────────────

async function sendOne(
  env: Env,
  keys: CryptoKeyPair,
  device: Device,
  slot: PushSlotConfig,
  date: string
): Promise<'sent' | 'gone' | 'failed'> {
  const friend = choose(device.config.friends);
  const body = choose(slot.bodies);

  const payload = JSON.stringify({
    // 카톡처럼 보이게 알림 제목은 친구 이름으로 둔다
    title: `${friend.emoji} ${friend.name}`.trim(),
    body,
    slotId: slot.id,
    // 앱이 열렸을 때 알림에 뜬 친구와 채팅방 친구를 맞추는 데 쓴다
    friendId: friend.id,
    date,
  });

  try {
    // sub 클레임은 라이브러리가 mailto: 를 붙여준다
    const email = (env.VAPID_SUBJECT || '').replace(/^mailto:/, '');
    const res = await sendPushNotification(keys, device.subscription, email, payload, {
      algorithm: 'aes128gcm',
      urgency: 'high',
      ttl: 60 * 30,
    });

    if (res.status === 404 || res.status === 410) return 'gone';
    return res.ok ? 'sent' : 'failed';
  } catch {
    return 'failed';
  }
}

export interface Job {
  device: Device;
  slot: PushSlotConfig;
  date: string;
  key: string;
}

/**
 * 지금 보내야 할 알림을 고른다. 순수 함수라 따로 테스트한다(src/schedule.test.mjs).
 *
 * 예정 시각 정각뿐 아니라 그 뒤 몇 분까지 받아주는 이유:
 * Cloudflare cron 은 정시를 보장하지 않는다. 몇 분 늦게 도는 일이 있어서,
 * 정각에만 쏘면 그날 알림이 통째로 날아간다.
 */
export function dueJobs(devices: Device[], now: Date, skip: Set<string>): Job[] {
  const jobs: Job[] = [];
  for (const device of devices) {
    const { date, minutes } = localParts(now, device.config.timezone);
    for (const slot of device.config.slots) {
      const target = parseHHMM(slot.time);
      if (target < 0) continue;
      const elapsed = minutes - target;
      if (elapsed < 0 || elapsed >= FIRE_WINDOW_MINUTES) continue;
      const key = `sent:${device.deviceId}:${date}:${slot.id}`;
      if (skip.has(key)) continue;
      jobs.push({ device, slot, date, key });
    }
  }
  return jobs;
}

async function runSchedule(env: Env, now: Date): Promise<void> {
  const devices = await readDevices(env);
  if (devices.length === 0) return;

  // 보낼 게 하나도 없으면 암호키를 만들지도 않고 빠져나간다.
  // cron tick 은 CPU 10ms 제한이라 대부분의 tick 이 여기서 끝나야 한다.
  const jobs = dueJobs(devices, now, sentInMemory);
  if (jobs.length === 0) return;

  const keys = await deserializeVapidKeys({
    publicKey: env.VAPID_PUBLIC_KEY,
    privateKey: env.VAPID_PRIVATE_KEY,
  });

  const gone = new Set<string>();

  for (const job of jobs) {
    // KV 표시가 이미 있으면 다른 tick 이 보낸 것이다
    const marked = await env.HABIT_KV.get(job.key);
    if (marked) {
      sentInMemory.add(job.key);
      continue;
    }

    const result = await sendOne(env, keys, job.device, job.slot, job.date);
    if (result === 'gone') {
      gone.add(job.device.deviceId);
      continue;
    }
    if (result === 'sent') {
      sentInMemory.add(job.key);
      await env.HABIT_KV.put(job.key, '1', { expirationTtl: SENT_TTL_SECONDS });
    }
    // 'failed' 면 표시를 안 남기니 다음 tick(윈도 안)에서 한 번 더 시도된다
  }

  // 죽은 구독은 지운다. 안 그러면 하루 네 번씩 영원히 재시도한다
  if (gone.size > 0) {
    const next = devices.filter((d) => !gone.has(d.deviceId));
    await writeDevices(env, next);
  }

  // 메모리 표시가 무한정 쌓이지 않게 정리한다
  if (sentInMemory.size > 200) sentInMemory.clear();
}

// ── 진입점 ───────────────────────────────────────────

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(env) });
    }

    if (url.pathname === '/subscribe' && request.method === 'POST') {
      return handleSubscribe(request, env);
    }
    if (url.pathname === '/unsubscribe' && request.method === 'POST') {
      return handleUnsubscribe(request, env);
    }
    if (url.pathname === '/health') {
      return json({ ok: true, configured: Boolean(env.VAPID_PUBLIC_KEY && env.PASSPHRASE) }, 200, env);
    }

    return json({ error: 'not found' }, 404, env);
  },

  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(runSchedule(env, new Date()));
  },
};

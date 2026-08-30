import { checkIntro, greeting, pick, pushBody, ScriptContext } from './chat/scripts';
import { AppState, DayLog, Friend, Message, PushConfig, Slot } from './types';

/**
 * 시간표 계산.
 *
 * 두 가지 일을 한다.
 *  1) catchUp(): 앱을 열었을 때, 오늘 지나간 시간대 중 아직 안 푼 것을 채팅방에 풀어놓는다.
 *     이때 말풍선 시각은 "지금"이 아니라 원래 예정 시각(07:30)으로 넣는다 —
 *     그래야 카톡처럼 "아침에 와 있었네" 로 보인다.
 *  2) buildPushConfig(): Worker 에 올릴 규칙을 만든다. 미리 계산한 알림 목록이 아니라
 *     규칙이라서, 앱을 2주 안 열어도 알림은 계속 온다.
 */

/** 로컬 기준 "YYYY-MM-DD" */
export function dateKey(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** "HH:MM" 을 분 단위로. 형식이 이상하면 -1 */
export function parseTime(time: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!m) return -1;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return -1;
  return h * 60 + min;
}

/** 그날 그 슬롯이 울릴 시각(ms). 로컬 시간 기준 */
export function slotTime(day: Date, slot: Slot): number {
  const minutes = parseTime(slot.time);
  const d = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, 0, 0, 0);
  return d.getTime() + minutes * 60_000;
}

export function deliveredKey(date: string, slotId: string): string {
  return `${date}|${slotId}`;
}

/**
 * 발신 친구는 매번 무작위로 뽑는다(사용자 요구).
 * 한 번 뽑히면 메시지에 friendId 로 박히니 다시 열어도 안 바뀐다.
 */
export function randomFriend(friends: Friend[]): Friend {
  return friends[Math.floor(Math.random() * friends.length)];
}

let seq = 0;
function messageId(at: number): string {
  seq += 1;
  return `m-${at.toString(36)}-${seq.toString(36)}`;
}

/** 한 슬롯이 열릴 때 친구가 보내는 말풍선들 (인사 + 체크리스트) */
export function slotMessages(
  slot: Slot,
  friend: Friend,
  ctx: ScriptContext,
  at: number
): Message[] {
  const seed = at + slot.id.length;
  const hello: Message = {
    id: messageId(at),
    friendId: friend.id,
    from: 'friend',
    kind: 'text',
    text: greeting(slot, ctx, seed),
    at,
  };
  const list: Message = {
    id: messageId(at + 1),
    friendId: friend.id,
    from: 'friend',
    kind: 'checklist',
    text: checkIntro(ctx, seed + 7),
    at: at + 1000,
    slotId: slot.id,
    pending: slot.items.map((i) => i.id),
  };
  return [hello, list];
}

export interface CatchUpResult {
  messages: Message[];
  delivered: string[];
}

/**
 * 오늘 이미 지난 시간대 중 아직 채팅방에 안 풀린 것을 만들어 낸다.
 * 어제 것까지 되살리면 아침에 열었을 때 어제 잔소리가 쏟아지므로 오늘만 본다.
 *
 * hints: 푸시로 이미 "누가 보냈는지" 정해진 경우(서비스워커가 남긴 기록).
 *        있으면 그 친구를 쓰고, 없으면 무작위로 뽑는다.
 */
export function catchUp(
  state: AppState,
  now: Date,
  hints: Record<string, string> = {}
): CatchUpResult {
  const today = dateKey(now);
  const already = new Set(state.delivered);
  const out: Message[] = [];
  const marked: string[] = [];

  const slots = state.slots
    .filter((s) => s.enabled && parseTime(s.time) >= 0)
    .slice()
    .sort((a, b) => parseTime(a.time) - parseTime(b.time));

  for (const slot of slots) {
    const key = deliveredKey(today, slot.id);
    if (already.has(key)) continue;
    const at = slotTime(now, slot);
    if (at > now.getTime()) continue; // 아직 그 시간이 안 됐다

    const hinted = hints[key] && state.friends.find((f) => f.id === hints[key]);
    const friend = hinted || randomFriend(state.friends);
    out.push(...slotMessages(slot, friend, { friend, profile: state.profile }, at));
    marked.push(key);
  }

  return { messages: out, delivered: marked };
}

/** 오늘 기록을 찾거나 새로 만든다 */
export function ensureLog(logs: DayLog[], date: string): DayLog {
  const found = logs.find((l) => l.date === date);
  if (found) return found;
  return { date, done: {}, stars: 0 };
}

/**
 * Worker 에 올릴 설정.
 * bodies 는 아이 이름·학교까지 다 채운 완성 문장이라 Worker 는 고르기만 하면 된다.
 */
export function buildPushConfig(state: AppState, deviceId: string): PushConfig {
  const timezone =
    (typeof Intl !== 'undefined' && Intl.DateTimeFormat().resolvedOptions().timeZone) ||
    'Asia/Seoul';

  return {
    deviceId,
    timezone,
    friends: state.friends.map((f) => ({ id: f.id, name: f.name, emoji: f.emoji })),
    slots: state.slots
      .filter((s) => s.enabled && parseTime(s.time) >= 0)
      .map((slot) => ({
        id: slot.id,
        time: slot.time,
        title: slot.title,
        // 말투별 인사를 전부 펼쳐 담는다 — Worker 가 무작위로 하나 고른다
        bodies: state.friends.map((friend, i) =>
          pushBody(slot, { friend, profile: state.profile }, i * 31 + slot.id.length)
        ),
      })),
  };
}

/** 설정이 그대로면 다시 올리지 않으려고 쓰는 아주 단순한 지문 */
export function configHash(config: PushConfig): string {
  const text = JSON.stringify(config);
  let h = 5381;
  for (let i = 0; i < text.length; i += 1) {
    h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  }
  return h.toString(36);
}

/** 다음에 올 시간대 — 홈 화면에 "다음 알림 12:00 점심" 으로 보여준다 */
export function nextSlot(state: AppState, now: Date): { slot: Slot; at: number } | null {
  const candidates = state.slots
    .filter((s) => s.enabled && parseTime(s.time) >= 0)
    .map((slot) => ({ slot, at: slotTime(now, slot) }))
    .filter((c) => c.at > now.getTime())
    .sort((a, b) => a.at - b.at);
  if (candidates.length > 0) return candidates[0];

  // 오늘은 다 지났다 — 내일 첫 슬롯
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const first = state.slots
    .filter((s) => s.enabled && parseTime(s.time) >= 0)
    .sort((a, b) => parseTime(a.time) - parseTime(b.time))[0];
  if (!first) return null;
  return { slot: first, at: slotTime(tomorrow, first) };
}

export { pick };

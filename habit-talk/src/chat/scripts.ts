import { CheckItem, Friend, Profile, Slot, Tone } from '../types';

/**
 * 친구들이 쓰는 문장 모음.
 *
 * 시간대별 "내용"은 어느 친구가 보내든 같다(사용자 요구). 대신 말투(tone)에 따라
 * 어미와 이모지가 달라져서 다른 친구처럼 느껴진다.
 *
 * 문장 안의 {{이름}} 자리표시자:
 *   {{child}}  → 아이 이름
 *   {{school}} → "학교" 또는 "어린이집"
 *   {{friend}} → 보내는 친구 이름
 */

export interface ScriptContext {
  friend: Friend;
  profile: Profile;
}

export function fill(text: string, ctx: ScriptContext): string {
  return text
    .replace(/\{\{child\}\}/g, ctx.profile.childName)
    .replace(/\{\{school\}\}/g, ctx.profile.schoolType === 'daycare' ? '어린이집' : '학교')
    .replace(/\{\{friend\}\}/g, ctx.friend.name);
}

/** 같은 배열에서 매번 같은 걸 뽑지 않도록, 씨앗값으로 골고루 돌려쓴다 */
export function pick<T>(list: T[], seed: number): T {
  if (list.length === 0) throw new Error('빈 목록에서 고를 수 없다');
  return list[Math.abs(seed) % list.length];
}

/** 시간대별 첫인사. slotId 가 기본 4개 중 하나면 전용 인사를, 아니면 공용 인사를 쓴다 */
const GREETINGS: Record<string, Record<Tone, string[]>> = {
  's-morning': {
    cheer: ['{{child}}아 좋은 아침!! 일어났어? ☀️', '{{child}}아 굿모닝!! 눈 떴어? 🌞'],
    calm: ['{{child}}아, 좋은 아침이야 🌤️ 일어났어?', '{{child}}아 아침이야~ 잘 잤어?'],
    funny: ['{{child}}아 일어낫!!! 🐔 꼬끼오~', '{{child}}아 아직 자?? 😴 나 벌써 일어났는데!'],
  },
  's-ready': {
    cheer: ['{{child}}아! 나갈 준비 잘 하고 있어? 🎒', '{{child}}아 준비 시작!! 나도 지금 하는 중 ✨'],
    calm: ['{{child}}아, 이제 나갈 준비 할 시간이야 🎒', '{{child}}아 천천히 준비하자~'],
    funny: ['{{child}}아 나 벌써 신발 신었다?? 👟 너는?', '{{child}}아 준비 안 하면 지각각이야 😆'],
  },
  's-lunch': {
    cheer: ['{{child}}아 점심시간!! 🍚 맛있는 거 먹었어?', '{{child}}아 밥 먹었어?? 나 배부르다 😋'],
    calm: ['{{child}}아, 점심 잘 먹었어? 🍚', '{{child}}아 밥 시간이야~ 잘 챙겨 먹었어?'],
    funny: ['{{child}}아 나 오늘 급식 두 번 먹음 🍚🍚 너는?', '{{child}}아 배고픈 사람 손! 🙋 나는 다 먹었지롱'],
  },
  's-evening': {
    cheer: ['{{child}}아 집에 왔어?? 🏠 오늘도 고생했어!', '{{child}}아 다녀왔어! 오늘 어땠어? 😊'],
    calm: ['{{child}}아, 집에 잘 왔어? 🏠', '{{child}}아 오늘 하루 어땠어?'],
    funny: ['{{child}}아 나 집 도착!! 🏠 너 먼저 왔어 늦게 왔어?', '{{child}}아 가방 던져놨지 😆 나는 던졌어'],
  },
};

const GREETINGS_FALLBACK: Record<Tone, string[]> = {
  cheer: ['{{child}}아!! 잠깐만~ ✨', '{{child}}아 나야!! 😄'],
  calm: ['{{child}}아, 잠깐 얘기하자 🙂', '{{child}}아 나야~'],
  funny: ['{{child}}아 나 왔다!! 🎉', '{{child}}아 심심해서 톡했어 😆'],
};

export function greeting(slot: Slot, ctx: ScriptContext, seed: number): string {
  const byTone = GREETINGS[slot.id] ?? GREETINGS_FALLBACK;
  const list = (byTone as Record<Tone, string[]>)[ctx.friend.tone] ?? GREETINGS_FALLBACK[ctx.friend.tone];
  return fill(pick(list, seed), ctx);
}

/** 체크리스트 말풍선 머리말 */
const CHECK_INTRO: Record<Tone, string[]> = {
  cheer: ['이거 다 했는지 알려줘! 👇', '체크체크! 한 거 눌러줘 👇'],
  calm: ['한 거 눌러서 알려줄래? 👇', '아래에서 한 것만 눌러줘 🙂'],
  funny: ['자 검사 시간!! 👇', '다 했으면 눌러봐 눌러봐 👇'],
};

export function checkIntro(ctx: ScriptContext, seed: number): string {
  return fill(pick(CHECK_INTRO[ctx.friend.tone], seed), ctx);
}

/** 체크 항목 한 줄의 물음 */
export function itemAsk(item: CheckItem, ctx: ScriptContext): string {
  return fill(item.ask, ctx);
}

/** 아이가 항목을 눌렀을 때 아이 말풍선에 뜨는 말 */
export function itemDone(item: CheckItem, ctx: ScriptContext): string {
  return fill(item.done, ctx);
}

/** 항목 하나 눌렀을 때 친구의 짧은 칭찬 */
const PRAISE: Record<Tone, string[]> = {
  cheer: ['오~ 잘했어!! 👏', '역시 {{child}}! ✨', '최고최고 👍', '와 벌써 했어?? 대박 🎉'],
  calm: ['잘했어 😊', '좋아좋아 👍', '역시 {{child}}야 ✨', '고생했어 🙂'],
  funny: ['오~ 좀 하는데? 😎', '인정!! 👏', '나보다 빠르네 😲', '칭찬 도장 쾅 🥇'],
};

export function praise(ctx: ScriptContext, seed: number): string {
  return fill(pick(PRAISE[ctx.friend.tone], seed), ctx);
}

/** 아직 안 했다고 할 때 — 다그치지 않고 부드럽게 민다 */
const NUDGE: Record<Tone, string[]> = {
  cheer: ['괜찮아! 지금 하면 되지 💪 하고 나서 알려줘!', '그럼 지금 후딱 하고 오자! 기다릴게 ✨'],
  calm: ['괜찮아, 천천히 해도 돼 🙂 하고 나서 눌러줘', '지금 하면 되지~ 다 하면 알려줘'],
  funny: ['헉 안 했어?? 😆 지금 가자 지금!', '지금 하면 아무도 모름 🤫 얼른얼른!'],
};

export function nudge(ctx: ScriptContext, seed: number): string {
  return fill(pick(NUDGE[ctx.friend.tone], seed), ctx);
}

/** 그 시간대 항목을 전부 완료했을 때 */
const ALL_DONE: Record<Tone, string[]> = {
  cheer: ['우와 다 했다!! ⭐ {{child}} 진짜 대단해!', '전부 완료!! 🎉 별 하나 받아가 ⭐'],
  calm: ['다 했네 😊 잘했어, 별 하나 줄게 ⭐', '전부 끝! ⭐ 오늘도 잘하고 있어'],
  funny: ['다 했다고?? 😲 별 가져가 ⭐ 나는 아직인데', '올클리어!! 🏆 별 하나 지급 ⭐'],
};

export function allDone(ctx: ScriptContext, seed: number): string {
  return fill(pick(ALL_DONE[ctx.friend.tone], seed), ctx);
}

/** 대화 마무리 — 사용자가 요청한 "나중에 또 연락하자" 형태 */
const GOODBYE: Record<Tone, string[]> = {
  cheer: [
    '나 이제 가봐야 해! 나중에 또 연락하자 👋',
    '오늘도 파이팅!! 이따 또 톡할게 ✨',
  ],
  calm: [
    '나 이제 가볼게~ 나중에 또 연락하자 🙂',
    '이따 또 얘기하자! 잘 지내고 있어 👋',
  ],
  funny: [
    '앗 엄마가 부른다 🏃 나중에 또 연락하자!',
    '나 밥 먹으러 간다!! 이따 또 톡함 👋',
  ],
};

export function goodbye(ctx: ScriptContext, seed: number): string {
  return fill(pick(GOODBYE[ctx.friend.tone], seed), ctx);
}

/** 푸시 알림 본문 — 알림창에서는 짧아야 하니 인사말만 쓴다 */
export function pushBody(slot: Slot, ctx: ScriptContext, seed: number): string {
  return greeting(slot, ctx, seed);
}

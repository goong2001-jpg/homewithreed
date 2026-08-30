import { Friend, Profile, Tone } from '../types';
import { fill, goodbye, pick, ScriptContext } from './scripts';

/**
 * 규칙 기반 답장 엔진.
 *
 * LLM 을 쓰지 않는다 — 요금이 안 들고, 인터넷이 없어도 되고, 일곱 살에게
 * 이상한 말이 나갈 위험이 없다. 대신 아이가 실제로 치는 말을 넓게 받아준다:
 * "ㅇㅇ", "ㄴㄴ", "졸려", "심심해", "ㅋㅋㅋㅋ" 같은 것들.
 *
 * 마무리("나중에 또 연락하자")는 **대화 세션 단위**로 센다. 하루 단위로 세면
 * 아침에 수다를 떤 날은 점심 대화가 시작하자마자 끝나버린다.
 */

/** 이 턴 수를 넘기면 친구가 자연스럽게 대화를 접는다 */
export const WIND_DOWN_TURNS = 6;
/** 이만큼 조용하면 다음 말은 새 대화로 친다 (분) */
export const SESSION_GAP_MINUTES = 20;

export interface ReplyContext extends ScriptContext {
  /** 이번 대화 세션에서 아이가 보낸 말의 순번 (1부터) */
  turn: number;
  /** 최근에 친구가 쓴 문장들 — 같은 말 반복을 피한다 */
  recent?: string[];
  /** 무작위 대신 쓸 씨앗값 (테스트에서 결과를 고정하려고 둔다) */
  seed?: number;
}

export interface Reply {
  text: string;
  /** 이 답으로 대화를 접었는지 */
  closing: boolean;
  /** 어떤 규칙이 걸렸는지 — 테스트와 디버깅용 */
  intent: string;
}

/**
 * 아이 입력을 성기게 다듬는다.
 * 자모(ㅇㅇ, ㄴㄴ, ㅋㅋ)는 살려야 한다 — 아이들이 제일 많이 치는 말이다.
 */
export function normalize(input: string): string {
  return input
    .toLowerCase()
    .replace(/[.,!?~…"'`^\-_/\\()[\]{}<>*+=|;:@#$%&]/g, '')
    .replace(/\s+/g, '')
    // 늘여 쓴 글자를 줄인다: ㅇㅇㅇㅇ→ㅇㅇ, 응응응→응응, ㅋㅋㅋㅋ→ㅋㅋ
    .replace(/(.)\1{2,}/g, '$1$1')
    .trim();
}

interface Rule {
  intent: string;
  test: RegExp;
  replies: string[];
}

/**
 * 위에서부터 먼저 걸리는 규칙이 이긴다.
 * 그래서 구체적인 것(졸려·배고파)을 긍정/부정보다 위에 둔다.
 */
const RULES: Rule[] = [
  {
    intent: 'sleepy',
    test: /졸려|졸리|피곤|잠와|자고싶|더자|더잘|일어나기싫/,
    replies: [
      '헉 아직 졸려? 😴 물 한 잔 마시면 잠 깬대! 나도 아침엔 진짜 힘들어',
      '나도 오늘 엄청 졸렸어 🥱 그래도 일어나면 좀 나아지더라!',
      '이불 밖은 위험하지 🛏️ 그래도 딱 3초만 참고 나와보자! 3, 2, 1!',
    ],
  },
  {
    intent: 'hungry',
    test: /배고파|배고픔|배곱|밥줘|먹고싶|맛있는거/,
    replies: [
      '헉 배고프구나 🍚 얼른 밥 먹으러 가자!',
      '나도 배고파!! 🍜 오늘 뭐 먹어?',
      '배고프면 힘 안 나지 😮 밥 먹고 얘기하자!',
    ],
  },
  {
    intent: 'sick',
    test: /아파|아프|아픔|열나|기침|콧물|배아|머리아/,
    replies: [
      '헉 어디 아파?? 😢 꼭 어른한테 말해야 해! 알겠지?',
      '아프면 참지 말고 엄마 아빠한테 얘기하자 🥺 빨리 나아라!',
      '많이 아파? 😟 어른한테 꼭 말하고 푹 쉬어야 해',
    ],
  },
  {
    intent: 'sad',
    test: /슬퍼|슬프|우울|울었|울고|속상|눈물|서운/,
    replies: [
      '무슨 일 있었어? 😢 얘기해도 돼, 내가 들어줄게',
      '괜찮아 괜찮아 🫂 슬플 땐 슬퍼해도 돼',
      '아이고 우리 {{child}} 🥺 내가 옆에 있었으면 안아줬을 텐데',
    ],
  },
  {
    intent: 'angry',
    test: /화나|짜증|열받|미워|싫다|억울/,
    replies: [
      '헉 무슨 일이야?? 😠 나한테 말해봐',
      '화날 만했나 보다 😤 크게 숨 한 번 쉬어보자, 후~',
      '그럴 땐 진짜 속상하지 🥲 얘기해줘서 고마워',
    ],
  },
  {
    intent: 'scared',
    test: /무서워|무섭|겁나|깜짝/,
    replies: [
      '무서웠구나 😨 괜찮아, 옆에 어른한테 가 있어!',
      '헉 나도 그런 거 무서워해 🫣 같이 무서워하자!',
      '괜찮아 괜찮아 🤗 이제 안 무서워',
    ],
  },
  {
    intent: 'bored',
    test: /심심|재미없|노잼|할거없|놀자|놀아|게임/,
    replies: [
      '심심해?? 그럼 수수께끼! 🤔 다리는 네 개인데 못 걷는 건? (정답은 책상!)',
      '나도 심심해 😆 우리 오늘 있었던 일 하나씩 말해볼래?',
      '심심할 땐 물 한 잔 마시고 스트레칭! 🙆 나 따라 해봐',
    ],
  },
  {
    intent: 'praise',
    test: /잘했지|칭찬|나잘|대단하지|봐봐|짱이지/,
    replies: [
      '우와 완전 잘했어!! 👏 진짜 대단해',
      '역시 {{child}}!! ⭐ 내가 다 뿌듯하다',
      '최고최고 🏆 칭찬 도장 쾅쾅!',
    ],
  },
  {
    intent: 'love',
    test: /사랑해|좋아해|보고싶|친구하자|고마운/,
    replies: [
      '나도 {{child}} 좋아해!! 💛',
      '헤헤 나도 보고 싶었어 🥰',
      '우리 계속 친구하자! 🤝',
    ],
  },
  {
    intent: 'thanks',
    test: /고마워|고맙|감사|땡큐/,
    replies: ['헤헤 별말씀을 😊', '아니야~ 내가 더 고맙지 💛', '언제든지! 👍'],
  },
  {
    intent: 'sorry',
    test: /미안|죄송|잘못했/,
    replies: [
      '괜찮아 괜찮아! 😊 미안하다고 말한 것도 멋진 거야',
      '아냐 하나도 안 미안해도 돼 💛',
    ],
  },
  {
    intent: 'who',
    test: /누구야|누구세|넌누구|이름이뭐|너이름/,
    replies: [
      '나 {{friend}}야! 😄 {{child}} 친구잖아~',
      '{{friend}}지!! 벌써 까먹었어?? 😆',
    ],
  },
  {
    intent: 'doing',
    test: /뭐해|모해|뭐하고|뭐하니|머해/,
    replies: [
      '나? 그냥 뒹굴뒹굴 🛋️ {{child}}는 뭐해?',
      '{{child}} 생각하고 있었지 😎 너는?',
      '간식 먹는 중 🍪 너도 뭐 먹어?',
    ],
  },
  {
    intent: 'where',
    test: /어디야|어딨|어디에|어디임/,
    replies: ['나 집이야! 🏠 너는 어디야?', '방에서 뒹굴거리는 중 😆'],
  },
  {
    intent: 'time',
    test: /몇시|시간이|지금몇/,
    replies: [
      '폰 위에 시계 있잖아~ 😆 봐봐!',
      '음… 나도 잘 몰라 🤔 시계 한번 볼래?',
    ],
  },
  // 대답(응/아니)은 주제(학교·숙제)보다 먼저 본다 —
  // "숙제 못했어"는 숙제 얘기가 아니라 '아직 안 했다'는 대답이다.
  // 그리고 부정이 긍정보다 먼저다 — "아직 안했어" 안에는 "했어"가 들어 있어서
  // 순서를 바꾸면 안 한 걸 했다고 칭찬해버린다.
  {
    intent: 'no',
    test: /^(ㄴ|ㄴㄴ|아니|아뇨|노|no|싫어|시러|아직)$|안했|못했|안먹|안씻|안함|아직안|나중에|하기싫|귀찮/,
    replies: [
      '괜찮아! 지금 하면 되지 💪 하고 나서 알려줘~',
      '그럼 지금 후딱 하고 오자! 기다릴게 ✨',
      '아직이구나~ 천천히 해도 돼 🙂 다 하면 눌러줘!',
    ],
  },
  {
    intent: 'yes',
    // ㅇ / ㅇㅇ / 응 / 어 / 네 / 넹 / 했어 / 다했어 / 완료
    test: /^(ㅇ|ㅇㅇ|ㅇㅋ|응|응응|어|엉|네|넹|녜|예|yes|ok|오케이|당연|굿)$|했어|했음|했다|다함|다했|완료|끝났|끝냈|먹었|씻었/,
    replies: [
      '오~ 잘했어!! 👏',
      '역시 {{child}} ⭐ 최고야',
      '좋아좋아 👍 멋지다!',
      '우와 벌써?? 😲 대단해!',
    ],
  },
  {
    intent: 'school',
    test: /학교|어린이집|유치원|선생님|급식|친구들|수업|숙제/,
    replies: [
      '오~ 오늘은 어땠어? 😊 재밌는 일 있었어?',
      '헉 나도 궁금해! 더 얘기해줘 👀',
      '좋았겠다~ ✨ 오늘 제일 재밌었던 거 뭐야?',
    ],
  },
  {
    intent: 'laugh',
    test: /^(ㅋ+|ㅎ+|ㅋㅋ|ㅎㅎ|ㅠ+|ㅜ+|ㅗ|ㅡ)$/,
    replies: ['ㅋㅋㅋ 😄', '왜왜 무슨 일이야? 😆', 'ㅎㅎ 재밌어? 🙂'],
  },
  {
    intent: 'greeting',
    test: /안녕|하이|ㅎㅇ|헬로|반가|왔어|여보세/,
    replies: [
      '안녕!! {{child}}야 😄 오늘 어때?',
      '오~ 왔다!! 반가워 ✨',
      '안녕안녕! 👋 뭐 하고 있었어?',
    ],
  },
  {
    intent: 'bye',
    test: /잘가|안녕히|바이|ㅂㅂ|빠이|잘자|자러|이따봐|나갈게|끊어/,
    replies: [
      '응 잘 가!! 나중에 또 연락하자 👋',
      '잘 자~ 좋은 꿈 꿔 🌙 내일 또 톡할게!',
      '알겠어! 이따 또 연락하자 ✨',
    ],
  },
];

/** 아이가 험한 말을 쳤을 때 — 혼내지 않고 부드럽게 화제를 돌린다 */
const ROUGH = /바보|멍청|죽어|시발|씨발|ㅅㅂ|개새|병신|ㅂㅅ|꺼져|미친/;
const ROUGH_REPLIES = [
  '앗 그런 말은 속상해 🥲 무슨 일 있었어?',
  '음… 다른 말로 해줄래? 😢 무슨 일인지 궁금해',
  '기분이 안 좋구나 🥺 왜 그런지 얘기해줄래?',
];

/** 뭘 말하는지 모르겠을 때 — 되묻고 화제를 이어준다 */
const FALLBACK = [
  '오~ 그렇구나! 😊 더 얘기해줘',
  '헉 진짜?? 👀 그래서 어떻게 됐어?',
  '음~ 무슨 말인지 잘 모르겠어 😅 다시 말해줄래?',
  '오호 🤔 그래서 {{child}}는 어땠어?',
  '재밌겠다! ✨ 또 뭐 있었어?',
];

/** 말투마다 끝에 붙는 이모지 — 같은 문장도 다른 친구처럼 들리게 한다 */
const TONE_TAIL: Record<Tone, string[]> = {
  cheer: ['', ' ✨', ' 💛'],
  calm: ['', ' 🙂', ''],
  funny: ['', ' 😆', ' ㅋㅋ'],
};

function seedOf(ctx: ReplyContext): number {
  if (typeof ctx.seed === 'number') return ctx.seed;
  return Math.floor(Math.random() * 100000);
}

/** 최근에 쓴 문장은 피해서 고른다 */
function chooseFresh(list: string[], seed: number, recent: string[]): string {
  const fresh = list.filter((t) => !recent.includes(t));
  return pick(fresh.length > 0 ? fresh : list, seed);
}

export function detectIntent(input: string): string {
  const text = normalize(input);
  if (!text) return 'empty';
  if (ROUGH.test(text)) return 'rough';
  const rule = RULES.find((r) => r.test.test(text));
  return rule ? rule.intent : 'unknown';
}

export function reply(input: string, ctx: ReplyContext): Reply {
  const text = normalize(input);
  const seed = seedOf(ctx);
  const recent = ctx.recent ?? [];

  if (!text) {
    return { text: fill(chooseFresh(FALLBACK, seed, recent), ctx), closing: false, intent: 'empty' };
  }

  // 대화가 길어지면 친구가 자연스럽게 접는다. 험한 말은 그래도 먼저 받아준다.
  const shouldClose = ctx.turn >= WIND_DOWN_TURNS;

  if (ROUGH.test(text)) {
    return {
      text: fill(chooseFresh(ROUGH_REPLIES, seed, recent), ctx),
      closing: false,
      intent: 'rough',
    };
  }

  const rule = RULES.find((r) => r.test.test(text));

  if (rule?.intent === 'bye') {
    return {
      text: fill(chooseFresh(rule.replies, seed, recent), ctx),
      closing: true,
      intent: 'bye',
    };
  }

  if (shouldClose) {
    return { text: goodbye(ctx, seed), closing: true, intent: rule?.intent ?? 'unknown' };
  }

  const list = rule ? rule.replies : FALLBACK;
  const tail = pick(TONE_TAIL[ctx.friend.tone], seed + 3);
  return {
    text: fill(chooseFresh(list, seed, recent), ctx) + tail,
    closing: false,
    intent: rule?.intent ?? 'unknown',
  };
}

/** 마지막 말이 오래 전이면 새 대화로 친다 */
export function isNewSession(lastChildMessageAt: number, now: number): boolean {
  if (!lastChildMessageAt) return true;
  return now - lastChildMessageAt > SESSION_GAP_MINUTES * 60_000;
}

export type { Friend, Profile };

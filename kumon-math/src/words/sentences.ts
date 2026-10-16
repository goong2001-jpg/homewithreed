import { Word } from './wordBank';

/**
 * 요정이 단어를 넣어 말하는 짧은 문장.
 * 단어만 외우는 데서 문장으로 넘어가는 첫걸음이다.
 * 7살이 듣고 따라 할 수 있게 3~5단어짜리 쉬운 문장만 쓴다.
 */

const COLORS = new Set(['red', 'blue', 'yellow', 'green', 'purple', 'black', 'white', 'brown']);
const NUMBERS = new Set(['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten']);
const VERBS = new Set([
  'run', 'walk', 'jump', 'swim', 'sleep', 'eat', 'drink', 'read', 'write', 'sing', 'dance',
  'draw', 'cook', 'wash', 'laugh', 'cry', 'smile', 'think', 'yawn',
]);
/** 여러 개가 한 벌인 것 (a 를 붙이지 않는다) */
const PAIRS = new Set(['pants', 'shoes', 'socks', 'glasses', 'scissors', 'underwear']);
/** 우리 가족·주변 사람 */
const MY = new Set(['mom', 'dad', 'uncle', 'family', 'friend', 'teacher']);
/** 먹고 마시는 것 */
const FOOD = new Set([
  'apple', 'banana', 'grape', 'orange', 'strawberry', 'watermelon', 'peach', 'pear', 'lemon',
  'cherry', 'pineapple', 'mango', 'kiwi', 'tomato', 'carrot', 'potato', 'corn', 'cucumber',
  'onion', 'garlic', 'bread', 'cheese', 'egg', 'noodle', 'pizza', 'hamburger', 'sandwich',
  'cake', 'cookie', 'candy', 'chocolate', 'ice cream', 'donut', 'popcorn', 'olive', 'nut',
]);
const DRINK = new Set(['milk', 'juice', 'water', 'soup', 'honey', 'rice']);

/** 따로 정해 둔 문장 */
const SPECIAL: Record<string, string> = {
  up: 'Look up!', quiet: 'Be quiet, please.', question: 'I have a question.',
  magic: 'It is magic!', music: 'I like music.', dream: 'I have a dream.',
  birthday: 'Happy birthday!', money: 'I have money.', game: 'Let\'s play a game!',
  thunder: 'I hear thunder!', lightning: 'I see lightning!', rain: 'I see the rain.',
  snow: 'I like the snow.', sun: 'I see the sun.', moon: 'I see the moon.',
  sea: 'I see the sea.', earth: 'We live on the earth.', fire: 'The fire is hot!',
  baby: 'The baby is cute.', heart: 'I love you with my heart.',
  school: 'I go to school.', house: 'This is my house.', bed: 'I go to bed.',
  hand: 'Raise your hand!', face: 'Wash your face.', tooth: 'I lost a tooth!',
  nose: 'Touch your nose.', mouth: 'Open your mouth.', ear: 'Touch your ear.',
  eye: 'Close your eye.', thumb: 'Thumbs up!', zombie: 'Oh no, a zombie!',
};

function article(w: string): string {
  return /^[aeiou]/.test(w) ? 'an' : 'a';
}

export function sentenceFor(word: Word): string {
  const w = word.en;
  if (SPECIAL[w]) return SPECIAL[w];
  if (VERBS.has(w)) return `I can ${w}!`;
  if (COLORS.has(w)) return `I like ${w}.`;
  if (NUMBERS.has(w)) return w === 'zero' ? 'I have zero candy.' : `I can count to ${w}!`;
  if (PAIRS.has(w)) return `These are my ${w}.`;
  if (MY.has(w)) return `This is my ${w}.`;
  if (DRINK.has(w)) return `I like ${w}.`;
  if (FOOD.has(w)) return `Yummy! I like this ${w}.`;
  return `I see ${article(w)} ${w}.`;
}

/** 문장을 단어 앞·단어·단어 뒤로 나눈다 — 배운 단어만 색을 달리해서 보여주려고 */
export function splitSentence(sentence: string, en: string): [string, string, string] {
  const i = sentence.toLowerCase().indexOf(en.toLowerCase());
  if (i < 0) return [sentence, '', ''];
  return [sentence.slice(0, i), sentence.slice(i, i + en.length), sentence.slice(i + en.length)];
}

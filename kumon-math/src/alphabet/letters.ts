export interface LetterInfo {
  /** 대문자 */
  upper: string;
  /** 소문자 */
  lower: string;
  /** 대표 단어 (영어) */
  word: string;
  /** 단어 뜻 (한글) */
  meaning: string;
  /** 단어 그림 */
  emoji: string;
  /** 글자 이름 한글 표기 (읽어주기 실패 시 표시용) */
  sound: string;
}

export const LETTERS: LetterInfo[] = [
  { upper: 'A', lower: 'a', word: 'Apple',    meaning: '사과',   emoji: '🍎', sound: '에이' },
  { upper: 'B', lower: 'b', word: 'Bear',     meaning: '곰',     emoji: '🐻', sound: '비' },
  { upper: 'C', lower: 'c', word: 'Cat',      meaning: '고양이', emoji: '🐱', sound: '씨' },
  { upper: 'D', lower: 'd', word: 'Dog',      meaning: '강아지', emoji: '🐶', sound: '디' },
  { upper: 'E', lower: 'e', word: 'Egg',      meaning: '달걀',   emoji: '🥚', sound: '이' },
  { upper: 'F', lower: 'f', word: 'Fish',     meaning: '물고기', emoji: '🐟', sound: '에프' },
  { upper: 'G', lower: 'g', word: 'Grape',    meaning: '포도',   emoji: '🍇', sound: '지' },
  { upper: 'H', lower: 'h', word: 'House',    meaning: '집',     emoji: '🏠', sound: '에이치' },
  { upper: 'I', lower: 'i', word: 'Ice',      meaning: '얼음',   emoji: '🧊', sound: '아이' },
  { upper: 'J', lower: 'j', word: 'Juice',    meaning: '주스',   emoji: '🧃', sound: '제이' },
  { upper: 'K', lower: 'k', word: 'Key',      meaning: '열쇠',   emoji: '🔑', sound: '케이' },
  { upper: 'L', lower: 'l', word: 'Lion',     meaning: '사자',   emoji: '🦁', sound: '엘' },
  { upper: 'M', lower: 'm', word: 'Moon',     meaning: '달',     emoji: '🌙', sound: '엠' },
  { upper: 'N', lower: 'n', word: 'Nose',     meaning: '코',     emoji: '👃', sound: '엔' },
  { upper: 'O', lower: 'o', word: 'Orange',   meaning: '오렌지', emoji: '🍊', sound: '오' },
  { upper: 'P', lower: 'p', word: 'Pig',      meaning: '돼지',   emoji: '🐷', sound: '피' },
  { upper: 'Q', lower: 'q', word: 'Queen',    meaning: '여왕',   emoji: '👑', sound: '큐' },
  { upper: 'R', lower: 'r', word: 'Rabbit',   meaning: '토끼',   emoji: '🐰', sound: '알' },
  { upper: 'S', lower: 's', word: 'Sun',      meaning: '해',     emoji: '☀️', sound: '에스' },
  { upper: 'T', lower: 't', word: 'Tiger',    meaning: '호랑이', emoji: '🐯', sound: '티' },
  { upper: 'U', lower: 'u', word: 'Umbrella', meaning: '우산',   emoji: '☂️', sound: '유' },
  { upper: 'V', lower: 'v', word: 'Violin',   meaning: '바이올린', emoji: '🎻', sound: '브이' },
  { upper: 'W', lower: 'w', word: 'Water',    meaning: '물',     emoji: '💧', sound: '더블유' },
  { upper: 'X', lower: 'x', word: 'Box',      meaning: '상자',   emoji: '📦', sound: '엑스' },
  { upper: 'Y', lower: 'y', word: 'Yellow',   meaning: '노랑',   emoji: '💛', sound: '와이' },
  { upper: 'Z', lower: 'z', word: 'Zebra',    meaning: '얼룩말', emoji: '🦓', sound: '지' },
];

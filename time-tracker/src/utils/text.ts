/**
 * 한국어 조사 붙이기.
 *
 * 블록 이름이 사용자가 고치는 값이라 문장을 미리 못 박아둘 수 없다.
 * '오전은 놓쳤지만' 은 맞고 '오후은 놓쳤지만' 은 틀리다 —
 * 앱이 하루에도 몇 번씩 보여주는 문장이라 이런 게 어긋나면 금세 조잡해 보인다.
 */

/** 마지막 글자에 받침이 있나 */
export function hasFinalConsonant(word: string): boolean {
  const ch = word.trim().slice(-1);
  if (!ch) return false;
  const code = ch.charCodeAt(0);
  // 한글 음절 영역이 아니면(숫자·영문 등) 받침이 없는 것으로 본다
  if (code < 0xac00 || code > 0xd7a3) return false;
  return (code - 0xac00) % 28 !== 0;
}

/** 은/는 */
export function topic(word: string): string {
  return hasFinalConsonant(word) ? '은' : '는';
}

/** 이/가 */
export function subject(word: string): string {
  return hasFinalConsonant(word) ? '이' : '가';
}

/** 을/를 */
export function object(word: string): string {
  return hasFinalConsonant(word) ? '을' : '를';
}

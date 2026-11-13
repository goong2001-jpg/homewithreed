/**
 * 따라 말하기 채점 — 음성 인식이 알아들은 글자가 그 단어인지 본다.
 * 아이 발음은 인식이 조금씩 빗나가므로 한두 글자 차이는 맞은 것으로 쳐 준다.
 */

/** 소문자 글자만 남긴다 ("Yo-Yo!" → "yoyo") */
export function normalize(text: string): string {
  return (text ?? '').toLowerCase().replace(/[^a-z]/g, '');
}

/** 두 글자열이 몇 글자 다른지 (편집 거리) */
export function distance(a: string, b: string): number {
  const prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let last = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const keep = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, last + (a[i - 1] === b[j - 1] ? 0 : 1));
      last = keep;
    }
  }
  return prev[b.length];
}

/** 이 단어에서 봐줄 수 있는 글자 차이 — 짧은 단어는 정확히, 긴 단어는 조금 너그럽게 */
function allowance(word: string): number {
  if (word.length >= 7) return 2;
  if (word.length >= 4) return 1;
  return 0;
}

/** 인식 결과들(여러 후보) 가운데 하나라도 그 단어로 들렸는지 */
export function heardWord(word: string, transcripts: string[]): boolean {
  const target = normalize(word);
  if (!target) return false;
  const allow = allowance(target);
  return transcripts.some(t => {
    // 문장으로 알아들었어도 그 안에 단어가 있으면 맞다
    if (normalize(t).includes(target)) return true;
    return (t ?? '').toLowerCase().split(/\s+/).some(piece => {
      const p = normalize(piece);
      return !!p && distance(p, target) <= allow;
    });
  });
}

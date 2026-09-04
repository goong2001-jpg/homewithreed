/**
 * 씨앗 하나로 같은 식단이 다시 나오게 하는 난수기(mulberry32).
 * "다시 추천"은 씨앗만 바꾸고, 새로고침해도 식단이 흔들리지 않는다.
 */
export function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function newSeed(): number {
  return Math.floor(Math.random() * 2 ** 31);
}

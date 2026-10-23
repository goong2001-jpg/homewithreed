import { addDays, dayNum } from './dates';

/**
 * 간격 반복(라이트너 상자).
 *
 * 단어마다 상자 번호(0~4)가 있다. 맞히면 한 칸 위 상자로 올라가고
 * 다음에 볼 날짜가 멀어진다(0·1·3·7·14일 뒤). 틀리면 0번 상자로 떨어져 오늘 다시 본다.
 * 4번 상자까지 올라간 단어는 "완전히 익힌" 단어다.
 */
export interface SrsEntry {
  /** 0(아직 못 외움) ~ 4(완전히 익힘) */
  box: number;
  /** 다음에 복습할 날 'YYYY-MM-DD' — 이 날이 되거나 지나면 복습 차례 */
  nextDue: string;
  /** 맞힌 횟수 */
  correct: number;
  /** 틀린 횟수 */
  wrong: number;
}

export type SrsMap = Record<string, SrsEntry>;

/** 상자별로 며칠 뒤에 다시 보는지 */
export const INTERVALS = [0, 1, 3, 7, 14];
export const MAX_BOX = INTERVALS.length - 1;

/** 처음 보는 단어 — 0번 상자, 오늘 복습 */
export function newEntry(today: string): SrsEntry {
  return { box: 0, nextDue: addDays(today, 0), correct: 0, wrong: 0 };
}

/** 카드를 한 번 본 단어 — 1번 상자, 내일 복습 (아직 문제는 안 풀었다) */
export function seenEntry(today: string): SrsEntry {
  return { box: 1, nextDue: addDays(today, INTERVALS[1]), correct: 0, wrong: 0 };
}

/** 문제를 풀고 난 뒤의 상자 */
export function applyResult(entry: SrsEntry | undefined, correct: boolean, today: string): SrsEntry {
  const cur = entry ?? newEntry(today);
  if (correct) {
    const box = Math.min(cur.box + 1, MAX_BOX);
    return { box, nextDue: addDays(today, INTERVALS[box]), correct: cur.correct + 1, wrong: cur.wrong };
  }
  return { box: 0, nextDue: addDays(today, 0), correct: cur.correct, wrong: cur.wrong + 1 };
}

/** 오늘 복습할 차례인지 */
export function isDue(entry: SrsEntry | undefined, today: string): boolean {
  return !!entry && dayNum(entry.nextDue) <= dayNum(today);
}

/**
 * 오늘 볼 단어 n 개를 고른다.
 *   1. 복습 차례인 단어 — 낮은 상자부터, 같은 상자면 복습일이 오래된 것부터
 *   2. 아직 한 번도 안 본 단어 — allWordIds 순서대로
 *   3. 아직 복습일이 안 된 단어 — 복습일이 가까운 것부터 (채우기용)
 */
export function pickDue(entries: SrsMap, allWordIds: string[], today: string, n: number): string[] {
  const order = new Map(allWordIds.map((id, i) => [id, i]));
  const byOrder = (a: string, b: string) => (order.get(a) ?? 0) - (order.get(b) ?? 0);
  const ids = allWordIds.filter((id, i) => allWordIds.indexOf(id) === i);

  const due = ids.filter(id => isDue(entries[id], today)).sort((a, b) =>
    entries[a].box - entries[b].box
    || dayNum(entries[a].nextDue) - dayNum(entries[b].nextDue)
    || byOrder(a, b));
  const fresh = ids.filter(id => !entries[id]);
  const later = ids.filter(id => entries[id] && !isDue(entries[id], today)).sort((a, b) =>
    dayNum(entries[a].nextDue) - dayNum(entries[b].nextDue) || byOrder(a, b));

  return [...due, ...fresh, ...later].slice(0, Math.max(0, n));
}

/** 복습 차례인 단어 수 */
export function dueCount(entries: SrsMap, today: string): number {
  return Object.values(entries).filter(e => isDue(e, today)).length;
}

/**
 * 예전 저장 데이터(seen/known/missed)에서 상자를 만든다.
 *   틀린 적 있는 단어 → 0번(오늘), 한 번에 맞힌 적 있는 단어 → 2번, 보기만 한 단어 → 1번
 */
export function migrateSrs(
  seen: Record<string, number>, known: Record<string, number>, missed: Record<string, string>, today: string,
): SrsMap {
  const out: SrsMap = {};
  const put = (id: string, box: number, correct: number, wrong: number) => {
    out[id] = { box, nextDue: addDays(today, INTERVALS[box]), correct, wrong };
  };
  Object.keys(seen).forEach(id => put(id, 1, 0, 0));
  Object.entries(known).forEach(([id, n]) => put(id, 2, n, 0));
  Object.keys(missed).forEach(id => put(id, 0, out[id]?.correct ?? 0, 1));
  return out;
}

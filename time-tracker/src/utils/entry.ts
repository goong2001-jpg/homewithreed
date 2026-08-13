import { DateKey, Entry, Gap, Segment } from '../types';
import { MINUTE, addDays, dayKeyOf, endOfDay, startOfDay } from './time';

/**
 * 기록 하나를 다루는 규칙들.
 *
 * 이 파일이 존재하는 이유는 딱 두 가지다.
 *
 * 1. **자정을 넘기는 기록** — 23:40에 자서 07:00에 깨면 한 기록이 이틀에 걸친다.
 *    하루치를 세려면 자정에서 잘라야 하는데, 이걸 화면마다 하면 반드시 어긋난다.
 *    그래서 `splitByDay` 하나만 통과시킨다.
 * 2. **진행 중인 기록** — `endedAt === null` 은 '아직 안 끝났다'는 뜻이라
 *    길이를 물을 때마다 '지금'이 필요하다. 그 '지금'은 항상 인자로 받는다.
 */

/** 진행 중이면 지금까지로 친다 */
export function entryEnd(e: Entry, now: number): number {
  return e.endedAt ?? now;
}

export function isRunning(e: Entry): boolean {
  return e.endedAt == null;
}

export function entryMinutes(e: Entry, now: number): number {
  return Math.max(0, entryEnd(e, now) - e.startedAt) / MINUTE;
}

/** 지금 돌아가는 기록. 여러 개면 가장 늦게 시작한 것 (원래 하나만 있어야 한다) */
export function runningOf(entries: Entry[]): Entry | null {
  const live = entries.filter(e => !e.deleted && isRunning(e));
  if (live.length === 0) return null;
  return live.reduce((a, b) => (b.startedAt > a.startedAt ? b : a));
}

export function sortByStart(entries: Entry[]): Entry[] {
  return entries.slice().sort((a, b) => a.startedAt - b.startedAt);
}

/**
 * 기록을 날짜별 조각으로 자른다.
 *
 * 자정을 넘기면 두 조각이 되고, 이틀을 넘기면 세 조각이 된다
 * (타이머를 끄는 걸 잊은 채 잤을 때 실제로 일어난다).
 */
export function splitByDay(e: Entry, now: number): Segment[] {
  const start = e.startedAt;
  const end = entryEnd(e, now);
  if (!(end > start)) return [];

  const out: Segment[] = [];
  let day = dayKeyOf(start);
  let cursor = start;

  // 타이머를 몇 달째 안 껐더라도 무한 루프에는 빠지지 않게 상한을 둔다
  for (let i = 0; i < 400 && cursor < end; i++) {
    const dayEnd = endOfDay(day);
    const segEnd = Math.min(end, dayEnd);
    out.push({
      entryId: e.id,
      categoryId: e.categoryId,
      day,
      start: cursor,
      end: segEnd,
      minutes: (segEnd - cursor) / MINUTE,
      clippedStart: cursor > start,
      clippedEnd: segEnd < end,
      running: isRunning(e),
    });
    cursor = segEnd;
    day = addDays(day, 1);
  }

  return out;
}

/** 그 날에 걸친 조각만, 시작 순으로 */
export function segmentsOfDay(entries: Entry[], day: DateKey, now: number): Segment[] {
  const from = startOfDay(day);
  const to = endOfDay(day);
  const out: Segment[] = [];

  for (const e of entries) {
    if (e.deleted) continue;
    // 하루 범위 밖이면 자를 것도 없다 (기록이 쌓여도 빠르게)
    if (e.startedAt >= to || entryEnd(e, now) <= from) continue;
    for (const s of splitByDay(e, now)) {
      if (s.day === day) out.push(s);
    }
  }

  return out.sort((a, b) => a.start - b.start || a.end - b.end);
}

/** 겹치는 구간을 하나로 합친 목록 — 같은 시간을 두 번 세지 않으려고 */
export function mergeRanges(ranges: { start: number; end: number }[]): { start: number; end: number }[] {
  const sorted = ranges
    .filter(r => r.end > r.start)
    .sort((a, b) => a.start - b.start);

  const out: { start: number; end: number }[] = [];
  for (const r of sorted) {
    const last = out[out.length - 1];
    if (last && r.start <= last.end) last.end = Math.max(last.end, r.end);
    else out.push({ start: r.start, end: r.end });
  }
  return out;
}

/** 겹침을 뺀 실제 기록 시간(분) */
export function coveredMinutes(ranges: { start: number; end: number }[]): number {
  return mergeRanges(ranges).reduce((sum, r) => sum + (r.end - r.start), 0) / MINUTE;
}

/**
 * 그 날 아무것도 안 적힌 구간.
 *
 * '내 시간 어디로 샜나'에 대한 답은 대부분 여기 들어 있다.
 * 아직 안 온 시간(미래)은 빈 게 아니라 안 산 시간이므로 `now`에서 끊는다.
 *
 * 화장실 다녀온 3분까지 세면 화면이 부스러기로 뒤덮이므로 `minMinutes`로 거른다.
 */
export function gapsOf(
  segments: Segment[], day: DateKey, now: number, minMinutes = 10,
): Gap[] {
  const from = startOfDay(day);
  const limit = Math.min(endOfDay(day), now);
  if (limit <= from) return [];

  const spans: { start: number; end: number }[] = [];
  let cursor = from;

  for (const r of mergeRanges(segments)) {
    if (r.start > cursor) spans.push({ start: cursor, end: Math.min(r.start, limit) });
    cursor = Math.max(cursor, r.end);
    if (cursor >= limit) break;
  }
  if (cursor < limit) spans.push({ start: cursor, end: limit });

  return spans
    .map(g => ({ day, start: g.start, end: g.end, minutes: (g.end - g.start) / MINUTE }))
    .filter(g => g.minutes >= minMinutes);
}

/** 이 시간대에 이미 다른 기록이 있나 — 저장 전에 알려주기만 하고 막지는 않는다 */
export function overlapsOf(
  entries: Entry[], start: number, end: number, exceptId: string | null, now: number,
): Entry[] {
  return entries.filter(e =>
    !e.deleted &&
    e.id !== exceptId &&
    e.startedAt < end &&
    entryEnd(e, now) > start,
  );
}

/**
 * 손으로 적은 '시작–끝'을 실제 시각으로.
 *
 * 끝이 시작보다 이르거나 같으면 **다음날**로 본다 — 23:30~01:00 은 밤을 넘긴 것이지
 * 거꾸로 흐른 시간이 아니다. 이걸 오류로 막으면 야근과 수면을 적을 수가 없다.
 */
export function normalizeRange(
  day: DateKey, startMinutes: number, endMinutes: number,
): { start: number; end: number; crossesMidnight: boolean } {
  const base = startOfDay(day);
  const start = base + startMinutes * MINUTE;
  const crossesMidnight = endMinutes <= startMinutes;
  const end = base + (endMinutes + (crossesMidnight ? 24 * 60 : 0)) * MINUTE;
  return { start, end, crossesMidnight };
}

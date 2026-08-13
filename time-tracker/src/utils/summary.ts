import {
  Category, CategorySlice, DateKey, DaySlice, Entry, GoalCheck, PeriodSummary, Segment,
  UNKNOWN_CATEGORY,
} from '../types';
import { coveredMinutes, splitByDay } from './entry';
import { MINUTE, daysBetween, endOfDay, listDays, startOfDay } from './time';

/**
 * 기간 집계 — 이 앱의 계산은 전부 여기 한 군데에 있다.
 *
 * 화면은 계산하지 않는다. App.tsx의 useMemo가 `summarize()`를 한 번 돌리고
 * 결과를 내려준다 (asset-tracker의 summary.ts와 같은 구조).
 *
 * ⚠️ '기록된 시간'과 '흘러간 시간'은 다른 값이고, 둘을 섞으면 안 된다.
 *    - 기록된 시간: 적어둔 토막의 합. 겹치게 적으면 24시간을 넘길 수도 있다
 *    - 안 적힌 시간: 흘러간 시간 − 실제로 덮인 시간(겹침을 합친 값)
 *    겹침을 합치지 않고 빼면 '안 적힌 시간'이 실제보다 작게 나와,
 *    정작 이 앱이 답해야 할 질문(어디로 샜나)에서 거짓말을 하게 된다.
 */

export interface SummaryInput {
  entries: Entry[];
  categories: Category[];
}

/** 지운 분류의 기록도 이름 없이 사라지지 않게 자리표시자를 준다 */
function metaOf(categories: Category[]) {
  const map = new Map(categories.map(c => [c.id, c]));
  return (id: string) => {
    const c = map.get(id);
    return {
      name: c?.name ?? UNKNOWN_CATEGORY.name,
      color: c?.color ?? UNKNOWN_CATEGORY.color,
      emoji: c?.emoji ?? UNKNOWN_CATEGORY.emoji,
      category: c ?? null,
    };
  };
}

/** 주간 목표를 이 기간 길이에 맞춰 환산한 뒤 지켰는지 본다 */
export function goalCheck(c: Category, minutes: number, days: number): GoalCheck | null {
  if (c.weeklyGoalMinutes == null || c.weeklyGoalMinutes <= 0 || days <= 0) return null;
  const targetMinutes = (c.weeklyGoalMinutes * days) / 7;
  return {
    kind: c.goalKind,
    targetMinutes,
    rate: minutes / targetMinutes,
    ok: c.goalKind === '이상' ? minutes >= targetMinutes : minutes <= targetMinutes,
  };
}

/** from..to (양끝 포함) 안에 들어오는 조각들 */
export function segmentsInRange(
  entries: Entry[], from: DateKey, to: DateKey, now: number,
): Segment[] {
  const rangeStart = startOfDay(from);
  const rangeEnd = endOfDay(to);
  const out: Segment[] = [];

  for (const e of entries) {
    if (e.deleted) continue;
    const end = e.endedAt ?? now;
    if (e.startedAt >= rangeEnd || end <= rangeStart) continue;
    for (const s of splitByDay(e, now)) {
      if (s.end > rangeStart && s.start < rangeEnd) out.push(s);
    }
  }

  return out.sort((a, b) => a.start - b.start);
}

export function summarize(
  input: SummaryInput, from: DateKey, to: DateKey, now: number,
): PeriodSummary {
  const meta = metaOf(input.categories);
  const days = Math.max(0, daysBetween(from, to)) + 1;
  const rangeStart = startOfDay(from);
  const rangeEnd = endOfDay(to);

  // 아직 안 온 시간은 '비어 있는' 게 아니라 '아직 안 산' 시간이다
  const elapsedEnd = Math.min(rangeEnd, now);
  const elapsedMinutes = Math.max(0, elapsedEnd - rangeStart) / MINUTE;

  const segments = segmentsInRange(input.entries, from, to, now);

  const minutesByCat: Record<string, number> = {};
  const entryIdsByCat: Record<string, Set<string>> = {};
  const dayMap = new Map<DateKey, DaySlice>();
  for (const day of listDays(from, to)) {
    dayMap.set(day, { day, minutes: 0, byCategory: {} });
  }

  let totalMinutes = 0;

  for (const s of segments) {
    minutesByCat[s.categoryId] = (minutesByCat[s.categoryId] ?? 0) + s.minutes;
    (entryIdsByCat[s.categoryId] ??= new Set()).add(s.entryId);
    totalMinutes += s.minutes;

    const slice = dayMap.get(s.day);
    if (slice) {
      slice.minutes += s.minutes;
      slice.byCategory[s.categoryId] = (slice.byCategory[s.categoryId] ?? 0) + s.minutes;
    }
  }

  // 겹쳐 적은 시간을 두 번 세지 않은 '실제로 덮인' 시간.
  // 아직 안 온 시간에 미리 적어둔 기록(오늘 밤 잘 시간 같은)은 여기서 잘라낸다 —
  // 안 그러면 '아직 안 적힌 시간'이 지금 비어 있는 자리보다 작게 나온다.
  const covered = coveredMinutes(
    segments
      .map(s => ({ start: s.start, end: Math.min(s.end, elapsedEnd) }))
      .filter(r => r.end > r.start),
  );
  const untrackedMinutes = Math.max(0, elapsedMinutes - covered);

  // 목표만 잡아두고 한 번도 안 한 분류는 0시간인 채로 보여야 의미가 있다
  const ids = new Set<string>(Object.keys(minutesByCat));
  for (const c of input.categories) {
    if (!c.deleted && c.weeklyGoalMinutes != null && c.weeklyGoalMinutes > 0) ids.add(c.id);
  }

  const byCategory: CategorySlice[] = Array.from(ids).map(id => {
    const m = meta(id);
    const minutes = minutesByCat[id] ?? 0;
    return {
      categoryId: id,
      name: m.name,
      color: m.color,
      emoji: m.emoji,
      minutes,
      ratio: totalMinutes > 0 ? minutes / totalMinutes : 0,
      count: entryIdsByCat[id]?.size ?? 0,
      goal: m.category ? goalCheck(m.category, minutes, days) : null,
    };
  }).sort((a, b) => b.minutes - a.minutes || a.name.localeCompare(b.name));

  const byDay = Array.from(dayMap.values());

  // 아직 안 온 날로 평균을 깎으면 주 초반엔 늘 '평균이 낮다'고 나온다
  const startedDays = byDay.filter(d => startOfDay(d.day) < now).length || 1;

  const busiestDay = byDay.reduce<DaySlice | null>(
    (best, d) => (d.minutes > 0 && (!best || d.minutes > best.minutes) ? d : best),
    null,
  );

  return {
    from,
    to,
    days,
    totalMinutes,
    elapsedMinutes,
    untrackedMinutes,
    dailyAverageMinutes: totalMinutes / startedDays,
    byCategory,
    byDay,
    busiestDay,
  };
}

/** 지난 기간 대비 분류별 증감(분). 이번 기간에만 있는 분류는 그대로 +로 잡힌다 */
export function compareByCategory(
  current: PeriodSummary, previous: PeriodSummary,
): Record<string, number> {
  const before: Record<string, number> = {};
  for (const s of previous.byCategory) before[s.categoryId] = s.minutes;

  const out: Record<string, number> = {};
  for (const s of current.byCategory) out[s.categoryId] = s.minutes - (before[s.categoryId] ?? 0);
  return out;
}

import {
  BlockPlan, BlockReport, BlockRollup, BlockState, Category, DateKey, Entry, KEEP_RATIO,
  Segment, TimeBlock, UNKNOWN_CATEGORY,
} from '../types';
import { segmentsOfDay } from './entry';
import { DAY_MINUTES, MINUTE, listDays, startOfDay } from './time';

/**
 * 타임블록 — 하루를 여섯 조각으로 끊어서 보기.
 *
 * 이 파일이 하는 계산은 딱 세 가지다.
 *
 * 1. 블록 경계 (`blockRanges`) — 시작 시각만 저장하고 끝은 다음 블록에서 얻는다
 * 2. 블록별 성적표 (`blockReports`) — 계획한 걸 그 블록에 실제로 얼마나 했나
 * 3. 기간 전체를 블록별로 접기 (`blockRollups`) — 어느 시간대에 늘 무너지나
 *
 * 판정 규칙은 일부러 느슨하다. 계획한 분류로 **그 블록의 절반**을 쓰면 지킨 것이다.
 * 100%를 요구하면 어차피 아무도 못 지키고, 못 지킨 판정이 쌓이면
 * 이 앱이 막으려던 바로 그 '자포자기'가 앱 안에서 재현된다.
 */

export interface BlockRange {
  block: TimeBlock;
  startMinutes: number;
  endMinutes: number;
}

/**
 * 블록을 하루를 빈틈없이 덮는 구간으로 편다.
 *
 * 끝은 저장하지 않고 다음 블록의 시작에서 얻는다 — 두 값을 따로 저장하면
 * 반드시 어긋나서 '아무 블록에도 안 속한 30분' 같은 게 생긴다.
 */
export function blockRanges(blocks: TimeBlock[]): BlockRange[] {
  const live = blocks
    .filter(b => !b.deleted)
    .slice()
    .sort((a, b) => a.startMinutes - b.startMinutes || a.order - b.order);

  if (live.length === 0) return [];

  const out: BlockRange[] = [];
  for (let i = 0; i < live.length; i++) {
    // 첫 블록은 언제나 자정에서 시작한다 (자정을 넘나드는 블록을 만들지 않으려고)
    const startMinutes = i === 0 ? 0 : live[i].startMinutes;
    const endMinutes = i === live.length - 1 ? DAY_MINUTES : live[i + 1].startMinutes;
    if (endMinutes <= startMinutes) continue;   // 같은 시각에 겹쳐 놓은 블록은 건너뛴다
    out.push({ block: live[i], startMinutes, endMinutes });
  }
  return out;
}

/** 지금 어느 블록 안에 있나 */
export function blockAtMinutes(ranges: BlockRange[], minutes: number): BlockRange | null {
  return ranges.find(r => minutes >= r.startMinutes && minutes < r.endMinutes) ?? null;
}

/** 이 블록에 걸친 만큼만 잘라서 분류별로 더한다 */
function minutesInRange(
  segments: Segment[], from: number, to: number,
): { total: number; byCategory: Map<string, number> } {
  const byCategory = new Map<string, number>();
  let total = 0;

  for (const s of segments) {
    const start = Math.max(s.start, from);
    const end = Math.min(s.end, to);
    if (end <= start) continue;
    const minutes = (end - start) / MINUTE;
    total += minutes;
    byCategory.set(s.categoryId, (byCategory.get(s.categoryId) ?? 0) + minutes);
  }

  return { total, byCategory };
}

export interface BlockReportInput {
  blocks: TimeBlock[];
  /** 그 날의 계획만 걸러서 넘겨도 되고 전부 넘겨도 된다 */
  plans: BlockPlan[];
  /** 그 날의 조각 (segmentsOfDay 결과) */
  segments: Segment[];
  day: DateKey;
  now: number;
}

export function blockReports(input: BlockReportInput): BlockReport[] {
  const { blocks, plans, segments, day, now } = input;
  const dayStart = startOfDay(day);

  const planOf = new Map<string, BlockPlan>();
  for (const p of plans) {
    if (p.deleted || p.day !== day) continue;
    const cur = planOf.get(p.blockId);
    // 같은 블록에 계획이 둘이면 마지막에 고친 쪽을 쓴다
    if (!cur || p.updatedAt >= cur.updatedAt) planOf.set(p.blockId, p);
  }

  return blockRanges(blocks).map(r => {
    const from = dayStart + r.startMinutes * MINUTE;
    const to = dayStart + r.endMinutes * MINUTE;
    const minutes = r.endMinutes - r.startMinutes;
    const elapsedMinutes = Math.max(0, Math.min(now, to) - from) / MINUTE;

    const { total, byCategory } = minutesInRange(segments, from, to);
    const sorted = Array.from(byCategory.entries())
      .map(([categoryId, m]) => ({ categoryId, minutes: m }))
      .sort((a, b) => b.minutes - a.minutes);

    const plan = planOf.get(r.block.id) ?? null;
    const plannedMinutes = plan ? (byCategory.get(plan.categoryId) ?? 0) : 0;
    // 지나간 만큼으로 나눈다 — 진행 중인 블록도 '지금까지 잘 하고 있나'가 보이게
    const keepRatio = elapsedMinutes > 0 ? plannedMinutes / elapsedMinutes : 0;

    let state: BlockState;
    if (now < from) state = 'upcoming';
    else if (now < to) state = 'now';
    else if (!plan) state = 'unplanned';
    else state = keepRatio >= KEEP_RATIO ? 'kept' : 'missed';

    return {
      blockId: r.block.id,
      name: r.block.name,
      emoji: r.block.emoji,
      startMinutes: r.startMinutes,
      endMinutes: r.endMinutes,
      minutes,
      elapsedMinutes,
      totalMinutes: total,
      byCategory: sorted,
      topCategoryId: sorted[0]?.categoryId ?? null,
      plannedCategoryId: plan?.categoryId ?? null,
      planMemo: plan?.memo ?? '',
      plannedMinutes,
      keepRatio,
      state,
    };
  });
}

/**
 * 아직 남은 블록 — '오늘 하루를 망쳤다'에 대한 반박 근거.
 * 지금 있는 블록도 남은 것으로 친다. 지금 이 순간부터 다시 시작할 수 있으니까.
 */
export function blocksLeft(reports: BlockReport[]): BlockReport[] {
  return reports.filter(r => r.state === 'now' || r.state === 'upcoming');
}

export function missedBlocks(reports: BlockReport[]): BlockReport[] {
  return reports.filter(r => r.state === 'missed');
}

export function keptBlocks(reports: BlockReport[]): BlockReport[] {
  return reports.filter(r => r.state === 'kept');
}

export interface BlockRollupInput {
  blocks: TimeBlock[];
  plans: BlockPlan[];
  entries: Entry[];
  /** 줄이려는 분류 (guard가 켜졌거나 '이하' 목표를 잡은 것) */
  guardIds: string[];
  from: DateKey;
  to: DateKey;
  now: number;
}

/**
 * 기간을 블록별로 접는다.
 *
 * "어느 시간대에 통제력이 약해지는가"에 답하려면 날짜가 아니라
 * **같은 시간대끼리** 모아야 한다. 매일 밤 아홉 시라는 게 보여야 손을 쓴다.
 */
export function blockRollups(input: BlockRollupInput): BlockRollup[] {
  const { blocks, plans, entries, guardIds, from, to, now } = input;
  const guard = new Set(guardIds);

  const acc = new Map<string, BlockRollup & { catMinutes: Map<string, number> }>();
  for (const r of blockRanges(blocks)) {
    acc.set(r.block.id, {
      blockId: r.block.id,
      name: r.block.name,
      emoji: r.block.emoji,
      plannedDays: 0,
      keptDays: 0,
      keepRate: null,
      totalMinutes: 0,
      guardMinutes: 0,
      topCategoryId: null,
      catMinutes: new Map(),
    });
  }

  for (const day of listDays(from, to)) {
    if (startOfDay(day) > now) break;   // 아직 안 온 날은 셀 게 없다
    const segments = segmentsOfDay(entries, day, now);
    for (const report of blockReports({ blocks, plans, segments, day, now })) {
      const a = acc.get(report.blockId);
      if (!a) continue;

      if (report.state === 'kept') { a.plannedDays++; a.keptDays++; }
      else if (report.state === 'missed') { a.plannedDays++; }

      a.totalMinutes += report.totalMinutes;
      for (const c of report.byCategory) {
        a.catMinutes.set(c.categoryId, (a.catMinutes.get(c.categoryId) ?? 0) + c.minutes);
        if (guard.has(c.categoryId)) a.guardMinutes += c.minutes;
      }
    }
  }

  return Array.from(acc.values()).map(a => {
    const top = Array.from(a.catMinutes.entries()).sort((x, y) => y[1] - x[1])[0];
    const { catMinutes, ...rest } = a;
    return {
      ...rest,
      keepRate: a.plannedDays > 0 ? a.keptDays / a.plannedDays : null,
      topCategoryId: top?.[0] ?? null,
    };
  });
}

/** 줄이려는 분류 — guard를 켰거나 '이하' 목표를 잡은 것 */
export function guardCategoryIds(categories: Category[]): string[] {
  return categories
    .filter(c => !c.deleted && (c.guard || (c.goalKind === '이하' && c.weeklyGoalMinutes != null)))
    .map(c => c.id);
}

/** 여러 줄로 적어둔 대본을 줄 단위로 — 빈 줄은 버린다 */
export function scriptLines(text: string | undefined): string[] {
  return (text ?? '').split('\n').map(s => s.trim()).filter(Boolean);
}

/** 이 분류에 적어둔 3단계 대본이 하나라도 있나 */
export function hasScript(c: Category): boolean {
  return scriptLines(c.away).length + scriptLines(c.swap).length + scriptLines(c.dislike).length > 0;
}

/** 화면에서 지운 분류 이름을 찾을 때 쓰는 작은 도우미 */
export function categoryMeta(categories: Category[], id: string | null) {
  const c = id ? categories.find(x => x.id === id) : undefined;
  return {
    name: c?.name ?? UNKNOWN_CATEGORY.name,
    color: c?.color ?? UNKNOWN_CATEGORY.color,
    emoji: c?.emoji ?? UNKNOWN_CATEGORY.emoji,
    category: c ?? null,
  };
}

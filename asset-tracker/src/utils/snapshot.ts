import { DateKey, MonthKey, Snapshot, Summary } from '../types';
import { addMonths, monthKey } from './date';

/**
 * 월별 순자산 스냅샷.
 *
 * 이 앱은 '지금' 잔액만 들고 있어서 그대로 두면 지난달에 얼마였는지 알 길이 없다.
 * 그래서 달마다 한 줄씩 남긴다 — 이번 달 줄은 숫자가 바뀔 때마다 덮어쓰고,
 * 달이 바뀌면 그대로 얼어붙는다. 지난달 줄은 절대 손대지 않는다.
 *
 * 다른 계산 모듈처럼 전부 순수 함수이고 '오늘'과 '지금'을 인자로 받는다.
 */

export function snapshotId(month: MonthKey): string {
  return `snap_${month}`;
}

/** summarize() 결과에서 스냅샷에 남길 숫자만 뽑는다 */
export function snapshotFields(s: Summary): Pick<Snapshot, 'netWorth' | 'totalAsset' | 'totalDebt' | 'liquid' | 'byKind'> {
  const byKind: Record<string, number> = {};
  for (const k of s.byKind) byKind[k.kindId] = k.amount;
  return {
    netWorth: s.netWorth,
    totalAsset: s.totalAsset,
    totalDebt: s.totalDebt,
    liquid: s.availableNow,
    byKind,
  };
}

function sameFields(a: Snapshot, b: ReturnType<typeof snapshotFields>): boolean {
  if (a.netWorth !== b.netWorth || a.totalAsset !== b.totalAsset
    || a.totalDebt !== b.totalDebt || a.liquid !== b.liquid) return false;
  const ak = Object.keys(a.byKind ?? {});
  const bk = Object.keys(b.byKind);
  if (ak.length !== bk.length) return false;
  return bk.every(k => a.byKind[k] === b.byKind[k]);
}

/**
 * 이번 달 스냅샷을 만들거나(없으면) 최신 상태로 덮어쓴다(있으면).
 *
 * 숫자가 하나도 안 바뀌었으면 **같은 배열을 그대로 돌려준다** —
 * App 의 effect 가 이 함수를 summary 가 바뀔 때마다 부르는데,
 * 매번 새 배열을 만들면 저장과 렌더가 쓸데없이 돈다.
 */
export function upsertMonthlySnapshot(
  snapshots: Snapshot[],
  summary: Summary,
  today: DateKey,
  now: number = Date.now(),
): Snapshot[] {
  const month = monthKey(today);
  const fields = snapshotFields(summary);
  const idx = snapshots.findIndex(s => s.month === month);

  if (idx === -1) {
    const created: Snapshot = {
      id: snapshotId(month), month, takenAt: now, updatedAt: now, ...fields,
    };
    return [...snapshots, created];
  }

  const cur = snapshots[idx];
  if (!cur.deleted && sameFields(cur, fields)) return snapshots;

  const next = [...snapshots];
  next[idx] = { ...cur, ...fields, deleted: false, takenAt: now, updatedAt: now };
  return next;
}

/** 살아있는 스냅샷을 달 순서로 */
export function liveSnapshots(snapshots: Snapshot[]): Snapshot[] {
  return snapshots
    .filter(s => !s.deleted)
    .slice()
    .sort((a, b) => a.month.localeCompare(b.month));
}

/** 최근 n개월 자리 (빈 달은 null) — 그래프가 달 간격을 고르게 그리게 */
export function lastMonths(
  snapshots: Snapshot[], today: DateKey, n = 12,
): { month: MonthKey; snapshot: Snapshot | null }[] {
  const byMonth = new Map(liveSnapshots(snapshots).map(s => [s.month, s]));
  const out: { month: MonthKey; snapshot: Snapshot | null }[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const month = monthKey(addMonths(today, -i));
    out.push({ month, snapshot: byMonth.get(month) ?? null });
  }
  return out;
}

/** 지난달 스냅샷. 없으면 null — 첫 달에는 '전월 대비'를 띄울 수 없다 */
export function previousMonthSnapshot(snapshots: Snapshot[], today: DateKey): Snapshot | null {
  const prev = monthKey(addMonths(today, -1));
  return snapshots.find(s => s.month === prev && !s.deleted) ?? null;
}

/**
 * 전월 대비 변화. ratio 는 지난달 순자산이 0 이면 null (0 으로 못 나눈다).
 * 지난달이 마이너스였어도 '얼마나 나아졌나'가 읽히게 절댓값으로 나눈다.
 */
export function monthOverMonth(
  current: number, prev: number,
): { change: number; ratio: number | null } {
  const change = current - prev;
  return { change, ratio: prev !== 0 ? change / Math.abs(prev) : null };
}

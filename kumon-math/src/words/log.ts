import { addDays, dayNum, isoToday, keyOfDayNum, weekIndex } from './dates';

/**
 * 하루하루의 공부 기록 — 엄마·아빠 리포트, 쿠폰 그래프, 주간 칭찬 카드가 이 기록을 읽는다.
 * 화면 상태와 상관없는 "장부"라서 훅 없이 localStorage 에 바로 적는다.
 */
export interface DayLog {
  /** 본 단어 카드 수 */
  cards: number;
  /** 처음 본 단어 수 */
  newWords: number;
  /** 퀴즈에서 한 번에 맞힌 수 / 틀린 수 */
  right: number;
  wrong: number;
  /** 완전히 익힌(4번 상자에 오른) 단어 수 */
  mastered: number;
  /** 받은 쿠폰 / 쓴 쿠폰 (저금통 큰 보상도 쓴 것으로 센다) */
  earned: number;
  used: number;
  /** 놀이터에서 별을 받은 횟수 */
  games: number;
}

export type LogField = keyof DayLog;
export type LogMap = Record<string, DayLog>;

const KEY = 'word_log';
const CONFUSION_KEY = 'word_confusions';
/** 이만큼 지난 기록은 지운다 */
const KEEP_DAYS = 120;

export const EMPTY_DAY: DayLog = { cards: 0, newWords: 0, right: 0, wrong: 0, mastered: 0, earned: 0, used: 0, games: 0 };

export function readLog(): LogMap {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as LogMap;
  } catch {}
  return {};
}

/** 오늘 기록의 한 칸에 n 을 더한다 */
export function logDay(field: LogField, n = 1, today: string = isoToday()): void {
  if (!n) return;
  try {
    const log = readLog();
    const day = { ...EMPTY_DAY, ...log[today] };
    day[field] += n;
    log[today] = day;
    const oldest = dayNum(today) - KEEP_DAYS;
    for (const k of Object.keys(log)) if (!(dayNum(k) >= oldest)) delete log[k];
    localStorage.setItem(KEY, JSON.stringify(log));
  } catch {}
}

/** 공부한 날인지 — 카드·퀴즈·놀이 중 하나라도 했으면 */
export function isStudyDay(d: DayLog | undefined): boolean {
  return !!d && d.cards + d.right + d.wrong + d.games > 0;
}

/** end 까지 n 일 치 기록 (옛날 → 오늘 순서, 없는 날은 0으로) */
export function lastDays(log: LogMap, n: number, end: string = isoToday()): { date: string; log: DayLog }[] {
  return Array.from({ length: n }, (_, i) => {
    const date = addDays(end, i - (n - 1));
    return { date, log: { ...EMPTY_DAY, ...log[date] } };
  });
}

/** 여러 날 기록의 합 */
export function sumDays(days: DayLog[]): DayLog & { studyDays: number } {
  const out = { ...EMPTY_DAY, studyDays: 0 };
  for (const d of days) {
    (Object.keys(EMPTY_DAY) as LogField[]).forEach(f => { out[f] += d[f] ?? 0; });
    if (isStudyDay(d)) out.studyDays++;
  }
  return out;
}

/** 그 날짜가 든 주(월~일)의 기록 */
export function weekOf(log: LogMap, date: string): { date: string; log: DayLog }[] {
  // 그 주의 월요일: weekIndex * 7 - 3 이 월요일의 날 번호
  const monday = weekIndex(date) * 7 - 3;
  return Array.from({ length: 7 }, (_, i) => {
    const d = keyOfDayNum(monday + i);
    return { date: d, log: { ...EMPTY_DAY, ...log[d] } };
  });
}

// ── 헷갈린 짝 ────────────────────────────────────────────────
/** "정답|고른 답" → 횟수. 퀴즈에서 틀릴 때마다 적는다 */
export type ConfusionMap = Record<string, number>;

export function readConfusions(): ConfusionMap {
  try {
    const raw = localStorage.getItem(CONFUSION_KEY);
    if (raw) return JSON.parse(raw) as ConfusionMap;
  } catch {}
  return {};
}

export function logConfusion(answer: string, picked: string): void {
  if (!answer || !picked || answer === picked) return;
  try {
    const map = readConfusions();
    const k = `${answer}|${picked}`;
    map[k] = (map[k] ?? 0) + 1;
    localStorage.setItem(CONFUSION_KEY, JSON.stringify(map));
  } catch {}
}

/** 많이 헷갈린 짝부터 (a-b 와 b-a 는 같은 짝으로 합친다) */
export function topConfusions(map: ConfusionMap, n = 5): { a: string; b: string; count: number }[] {
  const merged = new Map<string, { a: string; b: string; count: number }>();
  for (const [k, count] of Object.entries(map)) {
    const [a, b] = k.split('|');
    if (!a || !b) continue;
    const id = [a, b].sort().join('|');
    const cur = merged.get(id);
    if (cur) cur.count += count; else merged.set(id, { a, b, count });
  }
  return Array.from(merged.values()).sort((x, y) => y.count - x.count).slice(0, n);
}

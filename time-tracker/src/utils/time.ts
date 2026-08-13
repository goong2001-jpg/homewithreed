import { DateKey } from '../types';

/**
 * 시각·기간 계산.
 *
 * 전부 순수 함수이고 '지금'은 항상 인자로 받는다 —
 * asset-tracker/src/utils/date.ts 의 관행 그대로, 테스트가 시계에 의존하지 않게.
 *
 * ⚠️ 날짜 경계는 일부러 **지역시각**으로 잡는다.
 *    UTC로 자르면 한국 새벽 시간대의 기록이 어제로 밀려 하루가 통째로 어긋난다.
 */

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY_MINUTES = 24 * 60;

/** 오늘 'YYYY-MM-DD' */
export function todayKey(d = new Date()): DateKey {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** 이 시각이 속한 날 */
export function dayKeyOf(ts: number): DateKey {
  return todayKey(new Date(ts));
}

export function parseDate(key: DateKey): { y: number; m: number; d: number } {
  const [y, m, d] = key.split('-').map(Number);
  return { y, m, d };
}

/** 그 날 00:00 (epoch ms) */
export function startOfDay(key: DateKey): number {
  const { y, m, d } = parseDate(key);
  return new Date(y, m - 1, d, 0, 0, 0, 0).getTime();
}

/** 그 날 24:00 = 다음날 00:00. 구간의 '끝'은 항상 이 값을 쓴다(반열린 구간) */
export function endOfDay(key: DateKey): number {
  return startOfDay(addDays(key, 1));
}

export function addDays(key: DateKey, n: number): DateKey {
  const { y, m, d } = parseDate(key);
  return todayKey(new Date(y, m - 1, d + n));
}

/** to − from (일수) */
export function daysBetween(from: DateKey, to: DateKey): number {
  const a = parseDate(from);
  const b = parseDate(to);
  const ms = Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d);
  return Math.round(ms / 86_400_000);
}

/** 0=일 … 6=토 */
export function weekday(key: DateKey): number {
  const { y, m, d } = parseDate(key);
  return new Date(y, m - 1, d).getDay();
}

const WEEKDAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];

export function weekdayName(key: DateKey): string {
  return WEEKDAY_NAMES[weekday(key)];
}

/** 그 주의 월요일. 한 주를 월요일에 시작한다 (일요일 시작이면 주말이 두 주로 쪼개진다) */
export function weekStart(key: DateKey): DateKey {
  const w = weekday(key);
  return addDays(key, w === 0 ? -6 : 1 - w);
}

export function monthStart(key: DateKey): DateKey {
  const { y, m } = parseDate(key);
  return `${y}-${String(m).padStart(2, '0')}-01`;
}

/** 그 달의 마지막 날 */
export function monthEnd(key: DateKey): DateKey {
  const { y, m } = parseDate(key);
  return todayKey(new Date(y, m, 0));   // m월 0일 = (m−1)월의 말일
}

export function addMonths(key: DateKey, n: number): DateKey {
  const { y, m, d } = parseDate(key);
  const total = y * 12 + (m - 1) + n;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  const last = new Date(ny, nm, 0).getDate();
  return `${ny}-${String(nm).padStart(2, '0')}-${String(Math.min(d, last)).padStart(2, '0')}`;
}

/** from..to (양끝 포함)의 날짜 목록 */
export function listDays(from: DateKey, to: DateKey): DateKey[] {
  const n = daysBetween(from, to);
  if (n < 0) return [];
  const out: DateKey[] = [];
  for (let i = 0; i <= n; i++) out.push(addDays(from, i));
  return out;
}

// ============================== 시각 ==============================

/** '09:05' */
export function clock(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** 자정부터 몇 분째인가 (0..1439). 하루 막대에서 위치를 잡는 데 쓴다 */
export function minutesOfDay(ts: number): number {
  const d = new Date(ts);
  return d.getHours() * 60 + d.getMinutes();
}

/** '9:5', '0930', '09:30' 을 전부 분으로. 못 읽으면 null */
export function parseClock(text: string): number | null {
  const t = text.trim();
  if (!t) return null;

  let h: number;
  let m: number;

  const colon = t.match(/^(\d{1,2}):(\d{1,2})$/);
  if (colon) {
    h = Number(colon[1]);
    m = Number(colon[2]);
  } else if (/^\d{3,4}$/.test(t)) {
    h = Number(t.slice(0, t.length - 2));
    m = Number(t.slice(-2));
  } else if (/^\d{1,2}$/.test(t)) {
    h = Number(t);
    m = 0;
  } else {
    return null;
  }

  if (h > 23 || m > 59) return null;
  return h * 60 + m;
}

/** 분 → 'HH:MM' (입력칸에 되돌려 넣을 때) */
export function clockOfMinutes(minutes: number): string {
  const wrapped = ((minutes % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES;
  const h = Math.floor(wrapped / 60);
  const m = wrapped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** 그 날 00:00 + n분 (epoch ms) */
export function atMinutes(day: DateKey, minutes: number): number {
  return startOfDay(day) + minutes * MINUTE;
}

// ============================== 길이 ==============================

/** '2시간 30분' · '45분' · '0분' */
export function durationText(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m}분`;
  if (m === 0) return `${h}시간`;
  return `${h}시간 ${m}분`;
}

/** 막대 옆처럼 자리가 좁을 때 — '2h30' · '45m' */
export function shortDuration(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h${String(m).padStart(2, '0')}`;
}

/** 증감 표시 — '+1시간 20분' · '−35분' · '그대로' */
export function deltaText(minutes: number): string {
  const rounded = Math.round(minutes);
  if (rounded === 0) return '그대로';
  return `${rounded > 0 ? '+' : '−'}${durationText(Math.abs(rounded))}`;
}

/**
 * 돌아가는 타이머용 경과 시간 — '1:23:45' · '12:34'.
 * 초까지 보여줘야 '진짜 지금 돌아가고 있다'는 게 보인다.
 */
export function stopwatch(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

// ============================== 이름표 ==============================

/** '오늘' · '어제' · '8월 11일 (화)' */
export function dayLabel(key: DateKey, today: DateKey): string {
  const diff = daysBetween(today, key);
  if (diff === 0) return '오늘';
  if (diff === -1) return '어제';
  if (diff === 1) return '내일';
  const { m, d } = parseDate(key);
  return `${m}월 ${d}일 (${weekdayName(key)})`;
}

/** '8월 11일 ~ 17일' · '8월 28일 ~ 9월 3일' · '2026년 8월' */
export function rangeLabel(from: DateKey, to: DateKey): string {
  const a = parseDate(from);
  const b = parseDate(to);

  // 그 달 1일부터 말일까지면 달 이름 하나로 충분하다
  if (a.y === b.y && a.m === b.m && a.d === 1 && to === monthEnd(from)) {
    return `${a.y}년 ${a.m}월`;
  }
  if (a.y === b.y && a.m === b.m) return `${a.m}월 ${a.d}일 ~ ${b.d}일`;
  return `${a.m}월 ${a.d}일 ~ ${b.m}월 ${b.d}일`;
}

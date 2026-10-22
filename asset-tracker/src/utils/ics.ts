import { Upcoming } from '../types';
import { addDays } from './date';

/**
 * 다가오는 만기를 캘린더 앱이 읽는 .ics(iCalendar, RFC 5545)로 만든다.
 *
 * 항목 하나가 하루짜리(종일) VEVENT 하나. 7일 전에 알림(VALARM)이 울린다.
 * UID 는 자산·대출 id 로 고정해서, 다시 내보내 가져와도 같은 일정이 두 개 생기지 않고 갱신된다.
 *
 * 순수 함수 — '지금'은 DTSTAMP 에만 쓰이고 인자로 받는다.
 */

export const ICS_FILE_NAME = 'asset-dates.ics';

/** RFC 5545 3.3.11 TEXT 이스케이프: 백슬래시 · 세미콜론 · 쉼표 · 줄바꿈 */
export function escapeIcsText(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n');
}

const LIMIT = 75;

/**
 * 한 줄을 75옥텟(바이트)마다 접는다 (RFC 5545 3.1). 이어지는 줄은 공백 하나로 시작한다.
 * 한글은 UTF-8 로 3바이트라 글자 단위로 세야 글자 중간이 잘리지 않는다.
 */
export function foldIcsLine(line: string): string {
  const out: string[] = [];
  let cur = '';
  let bytes = 0;
  let limit = LIMIT;
  for (const ch of line) {
    const n = utf8Bytes(ch);
    if (bytes + n > limit) {
      out.push(cur);
      cur = ' ';
      bytes = 1;
      limit = LIMIT;
    }
    cur += ch;
    bytes += n;
  }
  out.push(cur);
  return out.join('\r\n');
}

function utf8Bytes(ch: string): number {
  const cp = ch.codePointAt(0) ?? 0;
  if (cp < 0x80) return 1;
  if (cp < 0x800) return 2;
  if (cp < 0x10000) return 3;
  return 4;
}

/** '2026-08-11' → '20260811' */
function dateValue(key: string): string {
  return key.replace(/-/g, '');
}

/** Date.now() → '20260811T093000Z' */
function stampValue(now: number): string {
  return new Date(now).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

/** 'a:xxx' / 'l:xxx' → 'a-xxx@asset-tracker' — 콜론은 UID 에 못 쓸 건 없지만 앱마다 다루는 게 달라 피한다 */
export function icsUid(upcomingId: string): string {
  return `${upcomingId.replace(/[^A-Za-z0-9_-]/g, '-')}@asset-tracker`;
}

export function icsSummary(u: Upcoming): string {
  return u.kind === '대출만기' ? `대출 종료: ${u.label}` : `자산 만기: ${u.label}`;
}

export function icsDescription(u: Upcoming): string {
  const amount = `${Math.round(u.amount).toLocaleString('ko-KR')}원`;
  return u.kind === '대출만기'
    ? `남은 원금 ${amount} — 내 자산관리 앱에서 내보냄`
    : `평가액 ${amount} — 내 자산관리 앱에서 내보냄`;
}

/** 일정이 하나도 없어도 빈 VCALENDAR 는 유효하다 */
export function buildIcs(events: Upcoming[], now: number = Date.now()): string {
  const stamp = stampValue(now);
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//homewithreed//asset-tracker//KO',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:내 자산 만기 일정',
  ];

  for (const u of events) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:${icsUid(u.id)}`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${dateValue(u.date)}`,
      `DTEND;VALUE=DATE:${dateValue(addDays(u.date, 1))}`,   // 종일 일정의 끝은 '다음 날' (배타)
      `SUMMARY:${escapeIcsText(icsSummary(u))}`,
      `DESCRIPTION:${escapeIcsText(icsDescription(u))}`,
      'TRANSP:TRANSPARENT',
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      'TRIGGER:-P7D',
      `DESCRIPTION:${escapeIcsText(`7일 뒤 ${icsSummary(u)}`)}`,
      'END:VALARM',
      'END:VEVENT',
    );
  }

  lines.push('END:VCALENDAR');
  return lines.map(foldIcsLine).join('\r\n') + '\r\n';
}

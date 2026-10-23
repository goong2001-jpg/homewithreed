import { Upcoming } from '../types';
import { buildIcs, escapeIcsText, foldIcsLine, icsUid } from './ics';

const NOW = Date.UTC(2026, 7, 11, 9, 30, 0);   // 2026-08-11T09:30:00Z

function up(over: Partial<Upcoming> = {}): Upcoming {
  return {
    id: 'a:abc-123', label: '우리은행 적금', date: '2026-12-01', dday: 112,
    kind: '자산만기', amount: 12_000_000, color: '#16a085', ...over,
  };
}

describe('escapeIcsText', () => {
  it('백슬래시·세미콜론·쉼표·줄바꿈을 이스케이프한다', () => {
    expect(escapeIcsText('a;b,c\\d\ne')).toBe('a\\;b\\,c\\\\d\\ne');
    expect(escapeIcsText('x\r\ny')).toBe('x\\ny');
  });
});

describe('foldIcsLine — 75옥텟 접기', () => {
  it('75바이트 이하는 그대로', () => {
    const s = 'A'.repeat(75);
    expect(foldIcsLine(s)).toBe(s);
  });

  it('넘으면 CRLF + 공백으로 이어지고, 이어지는 줄도 75바이트를 넘지 않는다', () => {
    const folded = foldIcsLine('A'.repeat(200));
    const parts = folded.split('\r\n');
    expect(parts).toHaveLength(3);
    expect(parts[0]).toBe('A'.repeat(75));
    expect(parts[1]).toBe(' ' + 'A'.repeat(74));
    expect(parts[2]).toBe(' ' + 'A'.repeat(51));
    for (const p of parts) expect(Buffer.byteLength(p, 'utf8')).toBeLessThanOrEqual(75);
  });

  it('한글(3바이트) 중간에서 자르지 않는다', () => {
    const line = 'SUMMARY:' + '가'.repeat(40);   // 8 + 120 바이트
    const parts = foldIcsLine(line).split('\r\n');
    expect(parts.length).toBeGreaterThan(1);
    for (const p of parts) expect(Buffer.byteLength(p, 'utf8')).toBeLessThanOrEqual(75);
    // 접은 걸 다시 펴면 원래 줄이다
    expect(parts.map((p, i) => (i ? p.slice(1) : p)).join('')).toBe(line);
    // 첫 줄: 8 + 22*3 = 74 바이트 → 22글자
    expect(parts[0]).toBe('SUMMARY:' + '가'.repeat(22));
  });
});

describe('buildIcs', () => {
  it('VCALENDAR 안에 항목마다 종일 VEVENT 하나와 7일 전 알림이 들어간다', () => {
    const ics = buildIcs([up()], NOW);
    const lines = ics.split('\r\n');
    expect(lines[0]).toBe('BEGIN:VCALENDAR');
    expect(lines[1]).toBe('VERSION:2.0');
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
    expect(ics).toContain('DTSTAMP:20260811T093000Z');
    expect(ics).toContain('DTSTART;VALUE=DATE:20261201');
    expect(ics).toContain('DTEND;VALUE=DATE:20261202');
    expect(ics).toContain('SUMMARY:자산 만기: 우리은행 적금');
    expect(ics).toContain('DESCRIPTION:평가액 12\\,000\\,000원');
    expect(ics).toContain('TRIGGER:-P7D');
    expect((ics.match(/BEGIN:VEVENT/g) ?? []).length).toBe(1);
    expect((ics.match(/BEGIN:VALARM/g) ?? []).length).toBe(1);
  });

  it('대출은 "대출 종료" 로, 금액은 남은 원금으로', () => {
    const ics = buildIcs([up({ id: 'l:L1', kind: '대출만기', label: '전세자금대출', amount: 66_000_000 })], NOW);
    expect(ics).toContain('SUMMARY:대출 종료: 전세자금대출');
    expect(ics).toContain('남은 원금 66\\,000\\,000원');
  });

  it('UID 는 자산 id 로 고정이라 두 번 내보내도 같다', () => {
    const a = buildIcs([up()], NOW);
    const b = buildIcs([up({ dday: 3, amount: 1 })], NOW + 86_400_000);
    const uid = (s: string) => s.match(/^UID:(.+)$/m)?.[1];
    expect(uid(a)).toBe('a-abc-123@asset-tracker');
    expect(uid(a)).toBe(uid(b));
    expect(icsUid('l:x:y')).toBe('l-x-y@asset-tracker');
  });

  it('항목이 없어도 유효한 빈 캘린더', () => {
    const ics = buildIcs([], NOW);
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).not.toContain('VEVENT');
  });

  it('모든 줄이 75옥텟 이하이고 CRLF 로 끝난다', () => {
    const ics = buildIcs([up({ label: '아주 긴 이름의 적금 상품 ' + '가나다라'.repeat(10) })], NOW);
    for (const line of ics.split('\r\n')) {
      expect(Buffer.byteLength(line, 'utf8')).toBeLessThanOrEqual(75);
    }
    expect(ics).not.toMatch(/[^\r]\n/);
  });
});

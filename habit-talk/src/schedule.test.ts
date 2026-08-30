import { DEFAULT_FRIENDS, DEFAULT_PROFILE, DEFAULT_SLOTS } from './data/defaults';
import {
  buildPushConfig,
  catchUp,
  configHash,
  dateKey,
  deliveredKey,
  nextSlot,
  parseTime,
  slotTime,
} from './schedule';
import { emptyState } from './storage';
import { AppState } from './types';

function stateAt(): AppState {
  return {
    ...emptyState(),
    profile: { ...DEFAULT_PROFILE, childName: '구름' },
    friends: DEFAULT_FRIENDS,
    slots: DEFAULT_SLOTS,
  };
}

describe('parseTime', () => {
  it('HH:MM 을 분으로 바꾼다', () => {
    expect(parseTime('07:30')).toBe(450);
    expect(parseTime('00:00')).toBe(0);
    expect(parseTime('23:59')).toBe(1439);
  });
  it('말이 안 되는 값은 -1', () => {
    expect(parseTime('25:00')).toBe(-1);
    expect(parseTime('7시30분')).toBe(-1);
    expect(parseTime('')).toBe(-1);
  });
});

describe('dateKey / slotTime', () => {
  it('로컬 기준 YYYY-MM-DD 를 만든다', () => {
    expect(dateKey(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  });

  it('그날 그 시각의 로컬 타임스탬프를 준다', () => {
    const day = new Date(2026, 4, 10, 14, 0);
    const at = slotTime(day, DEFAULT_SLOTS[0]); // 07:30
    expect(new Date(at).getHours()).toBe(7);
    expect(new Date(at).getMinutes()).toBe(30);
    expect(dateKey(new Date(at))).toBe('2026-05-10');
  });
});

describe('catchUp', () => {
  it('아직 시간이 안 된 슬롯은 풀지 않는다', () => {
    const now = new Date(2026, 4, 10, 6, 0); // 06:00 — 전부 미래
    const r = catchUp(stateAt(), now);
    expect(r.delivered).toEqual([]);
    expect(r.messages).toEqual([]);
  });

  it('지나간 슬롯만 풀어놓는다', () => {
    const now = new Date(2026, 4, 10, 12, 30); // 07:30 · 08:00 · 12:00 지남
    const r = catchUp(stateAt(), now);
    expect(r.delivered).toEqual([
      deliveredKey('2026-05-10', 's-morning'),
      deliveredKey('2026-05-10', 's-ready'),
      deliveredKey('2026-05-10', 's-lunch'),
    ]);
    // 슬롯마다 인사 + 체크리스트 두 개
    expect(r.messages).toHaveLength(6);
  });

  it('말풍선 시각은 지금이 아니라 원래 예정 시각이다', () => {
    const now = new Date(2026, 4, 10, 12, 30);
    const r = catchUp(stateAt(), now);
    const hello = r.messages[0];
    expect(new Date(hello.at).getHours()).toBe(7);
    expect(new Date(hello.at).getMinutes()).toBe(30);
  });

  it('이미 푼 슬롯은 다시 풀지 않는다', () => {
    const now = new Date(2026, 4, 10, 12, 30);
    const s = stateAt();
    s.delivered = [deliveredKey('2026-05-10', 's-morning')];
    const r = catchUp(s, now);
    expect(r.delivered).not.toContain(deliveredKey('2026-05-10', 's-morning'));
    expect(r.delivered).toHaveLength(2);
  });

  it('꺼둔 슬롯은 건너뛴다', () => {
    const now = new Date(2026, 4, 10, 23, 0);
    const s = stateAt();
    s.slots = s.slots.map((slot) => ({ ...slot, enabled: slot.id === 's-lunch' }));
    const r = catchUp(s, now);
    expect(r.delivered).toEqual([deliveredKey('2026-05-10', 's-lunch')]);
  });

  it('푸시가 정해준 친구가 있으면 그 친구가 보낸 걸로 맞춘다', () => {
    const now = new Date(2026, 4, 10, 8, 30);
    const s = stateAt();
    const key = deliveredKey('2026-05-10', 's-morning');
    const r = catchUp(s, now, { [key]: 'f-toto' });
    expect(r.messages[0].friendId).toBe('f-toto');
  });

  it('체크리스트에는 그 슬롯 항목이 전부 들어간다', () => {
    const now = new Date(2026, 4, 10, 8, 30);
    const s = stateAt();
    s.slots = s.slots.filter((x) => x.id === 's-ready');
    const r = catchUp(s, now);
    const list = r.messages.find((m) => m.kind === 'checklist');
    expect(list?.pending).toEqual(['i-teeth-m', 'i-breakfast', 'i-bag']);
  });
});

describe('nextSlot', () => {
  it('오늘 남은 다음 슬롯을 준다', () => {
    const r = nextSlot(stateAt(), new Date(2026, 4, 10, 9, 0));
    expect(r?.slot.id).toBe('s-lunch');
  });

  it('오늘 다 지났으면 내일 첫 슬롯을 준다', () => {
    const r = nextSlot(stateAt(), new Date(2026, 4, 10, 23, 0));
    expect(r?.slot.id).toBe('s-morning');
    expect(dateKey(new Date(r!.at))).toBe('2026-05-11');
  });
});

describe('buildPushConfig', () => {
  it('아이 이름까지 다 채운 완성 문장을 담는다', () => {
    const cfg = buildPushConfig(stateAt(), 'dev-1');
    expect(cfg.slots).toHaveLength(4);
    for (const slot of cfg.slots) {
      expect(slot.bodies.length).toBeGreaterThan(0);
      for (const body of slot.bodies) {
        expect(body).not.toContain('{{');
        expect(body).toContain('구름');
      }
    }
  });

  it('꺼둔 슬롯은 올리지 않는다', () => {
    const s = stateAt();
    s.slots = s.slots.map((slot) => ({ ...slot, enabled: slot.id !== 's-lunch' }));
    const cfg = buildPushConfig(s, 'dev-1');
    expect(cfg.slots.map((x) => x.id)).not.toContain('s-lunch');
  });

  it('내용이 그대로면 지문도 같다 — 쓸데없이 다시 안 올린다', () => {
    const a = buildPushConfig(stateAt(), 'dev-1');
    const b = buildPushConfig(stateAt(), 'dev-1');
    expect(configHash(a)).toBe(configHash(b));
  });

  it('시간을 바꾸면 지문이 달라진다', () => {
    const a = buildPushConfig(stateAt(), 'dev-1');
    const s = stateAt();
    s.slots = s.slots.map((x) => (x.id === 's-morning' ? { ...x, time: '07:00' } : x));
    expect(configHash(buildPushConfig(s, 'dev-1'))).not.toBe(configHash(a));
  });
});

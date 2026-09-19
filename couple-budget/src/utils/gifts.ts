import {
  CounterpartyTotal, GiftDirection, GiftEntry, GiftKind, GiftSummary,
} from '../types';
import { alive } from './budget';

/** 클라우드나 손상된 localStorage에서 뭐가 오든 숫자로 만든다 */
const num = (n: unknown): number => (typeof n === 'number' && isFinite(n) ? n : 0);

export interface GiftFilter {
  /** 'YYYY' 또는 undefined(전체) */
  year?: string;
  direction?: GiftDirection;
  kind?: GiftKind;
  personId?: string;
  /** 상대방·메모에서 찾는다 */
  q?: string;
}

/** 기록이 있는 연도, 최근 순 */
export function giftYears(gifts: GiftEntry[]): string[] {
  const set = new Set<string>();
  for (const g of gifts) {
    if (alive(g) && g.date) set.add(g.date.slice(0, 4));
  }
  return Array.from(set).sort((a, b) => b.localeCompare(a));
}

/**
 * 조건에 맞는 기록을 최근 날짜순으로.
 * 조건을 하나도 주지 않으면 살아있는 전체를 돌려준다.
 */
export function filterGifts(gifts: GiftEntry[], f: GiftFilter = {}): GiftEntry[] {
  const q = f.q?.trim().toLowerCase() ?? '';

  return gifts
    .filter(g => {
      if (!alive(g)) return false;
      if (f.year && g.date.slice(0, 4) !== f.year) return false;
      if (f.direction && g.direction !== f.direction) return false;
      if (f.kind && g.kind !== f.kind) return false;
      if (f.personId && g.personId !== f.personId) return false;
      if (q) {
        const hay = `${g.counterparty} ${g.memo}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    })
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
}

export function summarizeGifts(rows: GiftEntry[]): GiftSummary {
  let received = 0;
  let given = 0;
  for (const g of rows) {
    if (g.direction === 'in') received += num(g.amount);
    else given += num(g.amount);
  }
  return { received, given, net: received - given, count: rows.length };
}

/**
 * 상대별 집계 — 이 장부의 존재 이유.
 * 지인 결혼식에 갈 때 "저쪽에서 우리한테 얼마 했더라"를 찾아보려면
 * 날짜순 목록이 아니라 이름으로 묶인 표가 필요하다.
 *
 * 이름은 앞뒤 공백과 대소문자만 무시하고 묶는다 (표시는 처음 적은 그대로).
 */
export function counterpartyTotals(rows: GiftEntry[]): CounterpartyTotal[] {
  const bucket = new Map<string, CounterpartyTotal>();

  for (const g of rows) {
    const name = g.counterparty.trim() || '이름 없음';
    const key = name.toLowerCase();
    const cur = bucket.get(key) ?? {
      name, received: 0, given: 0, net: 0, count: 0, lastDate: g.date,
    };
    if (g.direction === 'in') cur.received += num(g.amount);
    else cur.given += num(g.amount);
    cur.net = cur.received - cur.given;
    cur.count += 1;
    if (g.date > cur.lastDate) cur.lastDate = g.date;
    bucket.set(key, cur);
  }

  // 오고 간 금액이 큰 사람부터 — 그다음은 최근에 오간 순
  return Array.from(bucket.values()).sort(
    (a, b) =>
      (b.received + b.given) - (a.received + a.given)
      || b.lastDate.localeCompare(a.lastDate)
      || a.name.localeCompare(b.name),
  );
}

/** 사람별(우리집 식구) 합계 — '하율이가 올해 용돈 얼마 받았나' */
export function giftTotalsByPerson(rows: GiftEntry[]): Map<string, GiftSummary> {
  const out = new Map<string, GiftSummary>();
  for (const g of rows) {
    const cur = out.get(g.personId) ?? { received: 0, given: 0, net: 0, count: 0 };
    if (g.direction === 'in') cur.received += num(g.amount);
    else cur.given += num(g.amount);
    cur.net = cur.received - cur.given;
    cur.count += 1;
    out.set(g.personId, cur);
  }
  return out;
}

/** 'YYYY-MM' 로 묶는다 (목록 구분선용). 최근 달 먼저. */
export function groupGiftsByMonth(rows: GiftEntry[]): [string, GiftEntry[]][] {
  const map = new Map<string, GiftEntry[]>();
  for (const g of rows) {
    const key = g.date.slice(0, 7);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(g);
  }
  return Array.from(map.entries());
}

export type CouponId = 'money500' | 'roblox' | 'tv' | 'playground';

export interface CouponKind {
  id: CouponId;
  name: string;
  emoji: string;
  /** 쿠폰 카드 색 */
  color: string;
  /** 뽑기에서 나올 가능성 (클수록 자주 나옴) */
  weight: number;
}

export const COUPONS: CouponKind[] = [
  { id: 'money500',   name: '500원 쿠폰',      emoji: '💰', color: 'linear-gradient(135deg,#f6d365,#fda085)', weight: 1 },
  { id: 'roblox',     name: '로블록스 1분',    emoji: '🎮', color: 'linear-gradient(135deg,#a1c4fd,#c2e9fb)', weight: 3 },
  { id: 'tv',         name: 'TV 1분',          emoji: '📺', color: 'linear-gradient(135deg,#d4a5ff,#c2a0f8)', weight: 3 },
  { id: 'playground', name: '놀이터 5분',      emoji: '🛝', color: 'linear-gradient(135deg,#84fab0,#8fd3f4)', weight: 3 },
];

export function couponById(id: CouponId): CouponKind {
  return COUPONS.find(c => c.id === id) ?? COUPONS[0];
}

/** 가중치에 따라 쿠폰 하나를 뽑는다 */
export function drawCoupon(): CouponKind {
  const total = COUPONS.reduce((s, c) => s + c.weight, 0);
  let r = Math.random() * total;
  for (const c of COUPONS) {
    r -= c.weight;
    if (r <= 0) return c;
  }
  return COUPONS[COUPONS.length - 1];
}

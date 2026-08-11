/**
 * crypto.randomUUID() 는 보안 컨텍스트(https 또는 localhost)에서만 존재한다.
 * 빌드된 사이트를 LAN IP의 http:// 로 열면 없어서 터지므로 대체 경로를 둔다.
 */
export function newId(): string {
  const c: Crypto | undefined = typeof crypto !== 'undefined' ? crypto : undefined;

  if (c && typeof c.randomUUID === 'function') {
    return c.randomUUID();
  }

  if (c && typeof c.getRandomValues === 'function') {
    const bytes = new Uint8Array(16);
    c.getRandomValues(bytes);
    return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  }

  // 최후의 수단 — 충돌 확률이 실질적으로 무의미한 수준이면 충분하다
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

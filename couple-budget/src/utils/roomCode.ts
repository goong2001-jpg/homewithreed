/** 우리집 코드의 최소 길이 — 보안 규칙(roomCode.size() >= 12)과 반드시 일치해야 한다 */
export const MIN_ROOM_CODE_LENGTH = 12;

/** 헷갈리는 글자(0/o/O, 1/l/I) 를 뺀 32자 알파벳 */
const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';

/**
 * 16자 랜덤 코드를 만든다 (약 80비트).
 * 이 코드가 사실상 비밀번호이므로 Math.random()이 아니라 CSPRNG를 쓴다.
 */
export function generateRoomCode(): string {
  const n = 16;
  const out: string[] = [];

  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = new Uint8Array(n);
    crypto.getRandomValues(bytes);
    for (let i = 0; i < n; i++) out.push(ALPHABET[bytes[i] % ALPHABET.length]);
  } else {
    for (let i = 0; i < n; i++) out.push(ALPHABET[Math.floor(Math.random() * ALPHABET.length)]);
  }

  // 4글자씩 끊어서 옮겨 적기 쉽게 한다 (하이픈은 Firestore 문서 ID로 문제없다)
  const s = out.join('');
  return `${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8, 12)}-${s.slice(12)}`;
}

export function isValidRoomCode(code: string): boolean {
  const c = code.trim();
  // Firestore 문서 ID 제약: '/' 금지, '.' 과 '..' 단독 금지, 1500바이트 이하
  if (c.length < MIN_ROOM_CODE_LENGTH) return false;
  if (c.includes('/')) return false;
  if (c === '.' || c === '..') return false;
  return true;
}

/**
 * 사용자가 붙여넣은 Firebase 설정을 파싱한다.
 * `const firebaseConfig = { apiKey: "...", ... };` 형태와 순수 JSON 모두 받는다.
 */
export function parseFirebaseConfig(text: string): { ok: true; config: FirebaseConfigLike } | { ok: false; error: string } {
  const trimmed = text.trim();
  if (!trimmed) return { ok: false, error: '설정을 붙여넣어 주세요.' };

  // 가장 바깥 중괄호 블록만 떼어낸다
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    return { ok: false, error: '{ } 로 둘러싸인 설정이 안 보여요. Firebase 화면의 firebaseConfig 부분을 통째로 복사해 주세요.' };
  }

  let body = trimmed.slice(start, end + 1);

  // JS 객체 표기를 JSON으로 정리
  body = body
    .replace(/\/\/[^\n\r]*/g, '')                       // 한 줄 주석
    .replace(/\/\*[\s\S]*?\*\//g, '')                   // 블록 주석
    .replace(/([{,]\s*)([A-Za-z_$][\w$]*)\s*:/g, '$1"$2":')  // 맨키 → "키"
    .replace(/'/g, '"')                                 // 홑따옴표 → 쌍따옴표
    .replace(/,(\s*[}\]])/g, '$1');                     // 마지막 쉼표 제거

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(body);
  } catch {
    return { ok: false, error: '설정을 읽지 못했어요. 복사할 때 일부가 빠졌는지 확인해 주세요.' };
  }

  const missing = (['apiKey', 'authDomain', 'projectId', 'appId'] as const)
    .filter(k => typeof parsed[k] !== 'string' || !(parsed[k] as string).trim());

  if (missing.length) {
    return { ok: false, error: `${missing.join(', ')} 값이 없어요. firebaseConfig 전체를 복사했는지 확인해 주세요.` };
  }

  return {
    ok: true,
    config: {
      apiKey: String(parsed.apiKey),
      authDomain: String(parsed.authDomain),
      projectId: String(parsed.projectId),
      appId: String(parsed.appId),
      ...(typeof parsed.storageBucket === 'string' ? { storageBucket: parsed.storageBucket } : {}),
      ...(typeof parsed.messagingSenderId === 'string' ? { messagingSenderId: parsed.messagingSenderId } : {}),
    },
  };
}

export interface FirebaseConfigLike {
  apiKey: string;
  authDomain: string;
  projectId: string;
  appId: string;
  storageBucket?: string;
  messagingSenderId?: string;
}

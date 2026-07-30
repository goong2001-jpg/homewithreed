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
 * 값 두 개만으로 설정을 만든다.
 *
 * Firestore만 쓰는 앱이라 apiKey와 projectId면 충분하다.
 * authDomain은 Firebase Auth 전용이고 appId는 Analytics/Installations용이라
 * @firebase/firestore 는 둘 다 참조하지 않는다.
 * 덕분에 '웹 앱 추가 → 닉네임 → 앱 등록' 단계를 통째로 건너뛸 수 있다 —
 * 두 값은 Firebase 콘솔의 [프로젝트 설정 → 일반] 에 그냥 적혀 있다.
 */
export function buildConfig(projectId: string, apiKey: string): { ok: true; config: FirebaseConfigLike } | { ok: false; error: string } {
  const p = projectId.trim();
  const k = apiKey.trim();

  if (!p) return { ok: false, error: '프로젝트 ID를 입력해 주세요. [프로젝트 설정 → 일반] 에 있어요.' };
  if (!k) return { ok: false, error: '웹 API 키를 입력해 주세요. [프로젝트 설정 → 일반] 에 있어요.' };

  // 흔한 실수: 주소창 URL이나 콘솔 링크를 그대로 붙여넣는 경우
  if (/^https?:\/\//i.test(p) || p.includes('/')) {
    return { ok: false, error: '링크가 들어왔어요. 프로젝트 ID는 주소가 아니라 wooricip-a1b2c 같은 짧은 이름입니다.' };
  }
  if (/\s/.test(k)) {
    return { ok: false, error: '웹 API 키에 공백이 섞였어요. 앞뒤 공백 없이 붙여넣어 주세요.' };
  }

  return { ok: true, config: { projectId: p, apiKey: k } };
}

/**
 * 사용자가 붙여넣은 Firebase 설정을 파싱한다.
 * `const firebaseConfig = { apiKey: "...", ... };` 형태와 순수 JSON 모두 받는다.
 * (배우자 폰으로 설정을 넘길 때 쓰는 짧은 JSON `{"projectId":…,"apiKey":…}` 도 그대로 통과한다)
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

  const str = (k: string): string =>
    typeof parsed[k] === 'string' ? (parsed[k] as string).trim() : '';

  // Firestore에 실제로 필요한 건 이 둘뿐이다 (buildConfig 주석 참고)
  const projectId = str('projectId');
  const apiKey = str('apiKey');

  if (!projectId && !apiKey) {
    return { ok: false, error: 'projectId 와 apiKey 를 찾지 못했어요. firebaseConfig 전체를 복사했는지 확인해 주세요.' };
  }
  if (!projectId) {
    return { ok: false, error: 'projectId 가 없어요. [프로젝트 설정 → 일반] 에서 프로젝트 ID를 확인해 주세요.' };
  }
  if (!apiKey) {
    return { ok: false, error: 'apiKey 가 없어요. [프로젝트 설정 → 일반] 에서 웹 API 키를 확인해 주세요.' };
  }

  // 나머지는 있으면 넘기고 없으면 만다 — 없다고 막지 않는다
  const optional = (['authDomain', 'appId', 'storageBucket', 'messagingSenderId'] as const)
    .reduce<Record<string, string>>((acc, k) => {
      const v = str(k);
      if (v) acc[k] = v;
      return acc;
    }, {});

  return { ok: true, config: { projectId, apiKey, ...optional } };
}

export interface FirebaseConfigLike {
  projectId: string;
  apiKey: string;
  authDomain?: string;
  appId?: string;
  storageBucket?: string;
  messagingSenderId?: string;
}

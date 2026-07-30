import {
  MIN_ROOM_CODE_LENGTH, buildConfig, generateRoomCode, isValidRoomCode, parseFirebaseConfig,
} from './roomCode';

describe('buildConfig — 값 두 개만으로 설정 만들기', () => {
  it('프로젝트 ID와 API 키만 있으면 된다', () => {
    const r = buildConfig('wooricip-a1b2c', 'AIzaSyTest123');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.config).toEqual({ projectId: 'wooricip-a1b2c', apiKey: 'AIzaSyTest123' });
    }
  });

  it('앞뒤 공백은 잘라낸다', () => {
    const r = buildConfig('  proj-1  ', '  AIzaKey  ');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.config).toEqual({ projectId: 'proj-1', apiKey: 'AIzaKey' });
  });

  it('둘 중 하나라도 비면 무엇이 없는지 알려준다', () => {
    const a = buildConfig('', 'AIzaKey');
    expect(a.ok).toBe(false);
    if (!a.ok) expect(a.error).toContain('프로젝트 ID');

    const b = buildConfig('proj-1', '');
    expect(b.ok).toBe(false);
    if (!b.ok) expect(b.error).toContain('웹 API 키');
  });

  it('프로젝트 ID 자리에 링크를 넣으면 짚어준다', () => {
    // 사용자가 실제로 헷갈렸던 지점 — 주소를 넣는 칸으로 오해하기 쉽다
    const r = buildConfig('https://console.firebase.google.com/project/abc', 'AIzaKey');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('링크');
  });

  it('API 키에 공백이 섞이면 짚어준다', () => {
    const r = buildConfig('proj-1', 'AIza Key With Spaces');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('공백');
  });
});

describe('parseFirebaseConfig — 붙여넣기 경로', () => {
  it('Firebase 콘솔이 주는 JS 코드 그대로 받는다', () => {
    const r = parseFirebaseConfig(`
      const firebaseConfig = {
        apiKey: "AIzaSyABC",
        authDomain: "demo.firebaseapp.com",
        projectId: "demo-1234",
        storageBucket: "demo.appspot.com",
        messagingSenderId: "123456",
        appId: "1:123:web:abc"
      };
    `);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.config.projectId).toBe('demo-1234');
      expect(r.config.apiKey).toBe('AIzaSyABC');
      expect(r.config.appId).toBe('1:123:web:abc');
    }
  });

  it('배우자에게 넘기는 짧은 JSON도 받는다', () => {
    const r = parseFirebaseConfig('{"projectId":"demo-1234","apiKey":"AIzaSyABC"}');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.config).toEqual({ projectId: 'demo-1234', apiKey: 'AIzaSyABC' });
  });

  it('authDomain / appId 가 없어도 통과한다 (Firestore엔 불필요)', () => {
    const r = parseFirebaseConfig('{ apiKey: "AIzaSyABC", projectId: "demo-1234" }');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.config.authDomain).toBeUndefined();
      expect(r.config.appId).toBeUndefined();
    }
  });

  it('홑따옴표·마지막 쉼표·주석이 섞여도 읽는다', () => {
    const r = parseFirebaseConfig(`{
      // 우리집 설정
      apiKey: 'AIzaSyABC',
      projectId: 'demo-1234',  /* 프로젝트 */
    }`);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.config.projectId).toBe('demo-1234');
  });

  it('빈 문자열이면 붙여넣으라고 한다', () => {
    const r = parseFirebaseConfig('   ');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('붙여넣어');
  });

  it('중괄호가 없으면 알려준다', () => {
    const r = parseFirebaseConfig('그냥 아무 글자');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('{ }');
  });

  it('projectId 만 빠지면 그것만 짚어준다', () => {
    const r = parseFirebaseConfig('{ apiKey: "AIzaSyABC" }');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('projectId');
  });

  it('apiKey 만 빠지면 그것만 짚어준다', () => {
    const r = parseFirebaseConfig('{ projectId: "demo-1234" }');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('apiKey');
  });

  it('깨진 JSON은 안전하게 실패한다', () => {
    const r = parseFirebaseConfig('{ apiKey: "AIza');
    expect(r.ok).toBe(false);
  });
});

describe('우리집 코드', () => {
  it('12자 이상만 통과한다', () => {
    expect(isValidRoomCode('짧음')).toBe(false);
    expect(isValidRoomCode('a'.repeat(MIN_ROOM_CODE_LENGTH - 1))).toBe(false);
    expect(isValidRoomCode('a'.repeat(MIN_ROOM_CODE_LENGTH))).toBe(true);
  });

  it('Firestore 문서 ID로 못 쓰는 값은 막는다', () => {
    expect(isValidRoomCode('abcd/efgh/ijkl')).toBe(false);
  });

  it('만들어진 코드는 항상 유효하고 매번 다르다', () => {
    const codes = new Set<string>();
    for (let i = 0; i < 50; i++) {
      const c = generateRoomCode();
      expect(isValidRoomCode(c)).toBe(true);
      expect(c.length).toBeGreaterThanOrEqual(MIN_ROOM_CODE_LENGTH);
      codes.add(c);
    }
    expect(codes.size).toBe(50);   // 충돌 없음
  });

  it('헷갈리는 글자(0, o, l, 1)를 쓰지 않는다', () => {
    for (let i = 0; i < 30; i++) {
      expect(generateRoomCode()).not.toMatch(/[0o1lI]/);
    }
  });
});

import React, { useState } from 'react';
import { SyncSettings, SyncStatus } from '../types';
import {
  MIN_ROOM_CODE_LENGTH, generateRoomCode, isValidRoomCode, parseFirebaseConfig,
} from '../utils/roomCode';

interface Props {
  sync: SyncSettings;
  status: SyncStatus;
  error: string;
  counts: { incomes: number; fixed: number; expenses: number };
  onChange: (patch: Partial<SyncSettings>) => void;
  onUploadAll: () => number;
  cardStyle: React.CSSProperties;
}

const RULES = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /rooms/{roomCode}/{document=**} {
      allow read, write: if roomCode.size() >= 12;
    }
  }
}`;

export default function SyncCard({
  sync, status, error, counts, onChange, onUploadAll, cardStyle,
}: Props) {
  const [codeInput, setCodeInput] = useState(sync.roomCode);
  const [configInput, setConfigInput] = useState(sync.firebaseConfigText);
  const [note, setNote] = useState('');
  const [showGuide, setShowGuide] = useState(false);
  const [copied, setCopied] = useState(false);

  const parsed = configInput.trim() ? parseFirebaseConfig(configInput) : null;
  const codeOk = isValidRoomCode(codeInput);

  const labelStyle: React.CSSProperties = {
    fontSize: 12.5, fontWeight: 600, color: '#607d8b', marginBottom: 6, display: 'block',
  };
  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px', border: '1.5px solid #e0e0e0',
    borderRadius: 8, fontSize: 14, boxSizing: 'border-box', outline: 'none',
  };

  function save() {
    if (!codeOk) {
      setNote(`우리집 코드는 ${MIN_ROOM_CODE_LENGTH}자 이상이어야 해요. '새 코드 만들기'를 눌러주세요.`);
      return;
    }
    if (!parsed || !parsed.ok) {
      setNote(parsed && !parsed.ok ? parsed.error : 'Firebase 설정을 붙여넣어 주세요.');
      return;
    }
    onChange({ enabled: true, roomCode: codeInput.trim(), firebaseConfigText: configInput });
    setNote('저장했어요. 연결을 시작합니다.');
  }

  function makeCode() {
    const c = generateRoomCode();
    setCodeInput(c);
    setNote('새 코드를 만들었어요. 저장한 뒤 배우자 폰에 똑같이 입력하세요.');
  }

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(codeInput);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setNote('복사가 안 되네요. 코드를 직접 옮겨 적어주세요.');
    }
  }

  function turnOff() {
    onChange({ enabled: false });
    setNote('동기화를 껐어요. 이 기기의 기록은 그대로 남아 있습니다.');
  }

  function upload() {
    const n = onUploadAll();
    setNote(`${n}건을 클라우드로 올렸어요.`);
  }

  return (
    <div style={cardStyle}>
      <h3 style={{ margin: '0 0 4px', fontSize: 15, color: '#333' }}>둘이서 같이 쓰기</h3>
      <p style={{ margin: '0 0 14px', fontSize: 12.5, color: '#95a5a6', lineHeight: 1.7 }}>
        설정하지 않아도 앱은 잘 돌아가요. 다만 기록이 <b>이 기기에만</b> 저장됩니다.
        구글 Firebase(무료)를 연결하면 두 사람 폰이 실시간으로 같은 가계부를 봅니다.
      </p>

      {/* 상태 */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '11px 13px',
        background: status === 'live' ? '#eafaf1' : status === 'error' ? '#fdedec' : '#f5f7f8',
        borderRadius: 10, marginBottom: 16, fontSize: 13,
        color: status === 'live' ? '#1e8449' : status === 'error' ? '#c0392b' : '#607d8b',
      }}>
        <span style={{ fontSize: 15 }}>
          {status === 'live' ? '✅' : status === 'error' ? '⚠️' : status === 'connecting' ? '⏳' : '📱'}
        </span>
        <span style={{ lineHeight: 1.5 }}>
          {status === 'live' && '연결됐어요. 두 사람의 입력이 실시간으로 합쳐집니다.'}
          {status === 'connecting' && '연결 중이에요…'}
          {status === 'error' && error}
          {status === 'off' && '이 기기에만 저장하는 중이에요.'}
        </span>
      </div>

      <button
        onClick={() => setShowGuide(v => !v)}
        style={{
          width: '100%', padding: 12, background: '#f8f9fa', border: '1px solid #e8ecee',
          borderRadius: 10, fontSize: 13.5, fontWeight: 600, color: '#455a64',
          cursor: 'pointer', marginBottom: 16, textAlign: 'left',
        }}
      >
        {showGuide ? '▾' : '▸'} Firebase 설정 방법 (처음 한 번만, 약 10분)
      </button>

      {showGuide && (
        <ol style={{
          margin: '0 0 18px', paddingLeft: 20, fontSize: 12.5, color: '#546e7a', lineHeight: 2,
        }}>
          <li><b>console.firebase.google.com</b> 접속 → 구글 로그인</li>
          <li><b>프로젝트 만들기</b> → 이름은 아무거나(우리집가계부) → 애널리틱스는 <b>사용 안 함</b></li>
          <li>프로젝트 화면에서 <b>웹 아이콘 {'</>'}</b> 클릭 → 닉네임 입력 → <b>앱 등록</b> (Hosting 체크 안 함)</li>
          <li>화면에 나오는 <b>firebaseConfig = {'{ … }'}</b> 부분을 통째로 복사 → 아래 칸에 붙여넣기</li>
          <li>왼쪽 메뉴 <b>빌드 → Firestore Database</b> → 데이터베이스 만들기 → 위치 <b>asia-northeast3 (서울)</b> → <b>프로덕션 모드</b></li>
          <li>Firestore 화면 위 <b>규칙</b> 탭 → 기존 내용 다 지우고 아래 규칙을 붙여넣고 <b>게시</b></li>
          <li>아래에서 <b>새 코드 만들기</b> → <b>저장</b> → 배우자 폰에서 같은 코드와 같은 설정 입력</li>
        </ol>
      )}

      {/* 보안 규칙 */}
      <div style={{ marginBottom: 18 }}>
        <label style={labelStyle}>Firestore 보안 규칙 (6번에서 붙여넣을 내용)</label>
        <pre style={{
          margin: 0, padding: 12, background: '#263238', color: '#b2ccd6',
          borderRadius: 8, fontSize: 10.5, lineHeight: 1.6, overflowX: 'auto',
        }}>
          {RULES}
        </pre>
      </div>

      {/* 우리집 코드 */}
      <div style={{ marginBottom: 16 }}>
        <label style={labelStyle} htmlFor="roomcode">우리집 코드</label>
        <input
          id="roomcode"
          type="text"
          value={codeInput}
          onChange={e => setCodeInput(e.target.value)}
          placeholder="새 코드 만들기를 눌러주세요"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          style={{
            ...inputStyle,
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            letterSpacing: 0.5,
            borderColor: codeInput && !codeOk ? '#e74c3c' : '#e0e0e0',
          }}
        />
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button
            onClick={makeCode}
            style={{
              flex: 1, padding: 10, background: '#f8f9fa', border: '1px solid #e0e0e0',
              borderRadius: 8, fontSize: 12.5, fontWeight: 600, color: '#607d8b', cursor: 'pointer',
            }}
          >
            새 코드 만들기
          </button>
          <button
            onClick={copyCode}
            disabled={!codeInput}
            style={{
              flex: 1, padding: 10,
              background: copied ? '#eafaf1' : '#f8f9fa',
              border: '1px solid #e0e0e0', borderRadius: 8, fontSize: 12.5, fontWeight: 600,
              color: copied ? '#27ae60' : '#607d8b',
              cursor: codeInput ? 'pointer' : 'not-allowed',
            }}
          >
            {copied ? '복사됐어요' : '복사'}
          </button>
        </div>
        {codeInput && !codeOk && (
          <div style={{ fontSize: 11.5, color: '#e74c3c', marginTop: 6 }}>
            {MIN_ROOM_CODE_LENGTH}자 이상이어야 하고 / 를 넣을 수 없어요.
          </div>
        )}
        <div style={{
          fontSize: 11.5, color: '#9a7d0a', background: '#fef9e7',
          borderRadius: 8, padding: '9px 11px', marginTop: 9, lineHeight: 1.6,
        }}>
          🔒 <b>이 코드가 비밀번호입니다.</b> 코드를 아는 사람은 우리 가계부를 볼 수 있어요.
          카톡으로 보내지 말고 배우자 폰에 직접 입력해 주세요.
        </div>
      </div>

      {/* Firebase 설정 */}
      <div style={{ marginBottom: 16 }}>
        <label style={labelStyle} htmlFor="fbconfig">Firebase 설정</label>
        <textarea
          id="fbconfig"
          rows={7}
          value={configInput}
          onChange={e => setConfigInput(e.target.value)}
          placeholder={'const firebaseConfig = {\n  apiKey: "AIza…",\n  authDomain: "…",\n  projectId: "…",\n  appId: "…"\n};'}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          style={{
            ...inputStyle,
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            fontSize: 11.5, lineHeight: 1.6, resize: 'vertical',
            borderColor: parsed && !parsed.ok ? '#e74c3c' : parsed?.ok ? '#27ae60' : '#e0e0e0',
          }}
        />
        {parsed?.ok && (
          <div style={{ fontSize: 11.5, color: '#27ae60', marginTop: 6 }}>
            ✅ 확인됐어요 — 프로젝트: <b>{parsed.config.projectId}</b>
          </div>
        )}
        {parsed && !parsed.ok && (
          <div style={{ fontSize: 11.5, color: '#e74c3c', marginTop: 6, lineHeight: 1.5 }}>
            {parsed.error}
          </div>
        )}
      </div>

      {note && (
        <div style={{
          fontSize: 12.5, color: '#455a64', background: '#eceff1',
          borderRadius: 8, padding: '10px 12px', marginBottom: 14, lineHeight: 1.6,
        }}>
          {note}
        </div>
      )}

      <button
        onClick={save}
        style={{
          width: '100%', padding: 13, background: '#27ae60', border: 'none', borderRadius: 10,
          fontSize: 14.5, fontWeight: 700, color: '#fff', cursor: 'pointer',
        }}
      >
        저장하고 연결하기
      </button>

      {status === 'live' && (
        <>
          <button
            onClick={upload}
            style={{
              width: '100%', marginTop: 9, padding: 12, background: '#fff',
              border: '1px solid #cfd8dc', borderRadius: 10,
              fontSize: 13, fontWeight: 600, color: '#607d8b', cursor: 'pointer',
            }}
          >
            지금까지 기록 클라우드로 올리기
            <span style={{ color: '#aaa', fontWeight: 400 }}>
              {' '}({counts.incomes + counts.fixed + counts.expenses}건)
            </span>
          </button>
          <p style={{ margin: '8px 0 0', fontSize: 11, color: '#b0bec5', lineHeight: 1.6 }}>
            이미 쓰던 방에 들어가는 경우에도 안전해요 — 덮어쓰지 않고 <b>합쳐집니다.</b>
          </p>
        </>
      )}

      {sync.enabled && (
        <button
          onClick={turnOff}
          style={{
            width: '100%', marginTop: 9, padding: 11, background: 'none', border: 'none',
            fontSize: 12.5, color: '#b0bec5', cursor: 'pointer',
          }}
        >
          동기화 끄기
        </button>
      )}
    </div>
  );
}

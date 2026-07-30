import React, { useEffect, useRef, useState } from 'react';
import { SyncSettings, SyncStatus } from '../types';
import {
  MIN_ROOM_CODE_LENGTH, buildConfig, generateRoomCode, isValidRoomCode, parseFirebaseConfig,
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

const STEP_TITLES = [
  '프로젝트 만들기',
  '데이터베이스 만들기',
  '보안 규칙 넣기',
  '값 두 개 옮기기',
  '연결하고 배우자 초대',
];

const TOTAL = STEP_TITLES.length;

export default function SyncCard({
  sync, status, error, counts, onChange, onUploadAll, cardStyle,
}: Props) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);

  const [projectId, setProjectId] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [pasteMode, setPasteMode] = useState(false);
  const [pasteText, setPasteText] = useState(sync.firebaseConfigText);

  const [codeInput, setCodeInput] = useState(sync.roomCode);
  const [note, setNote] = useState('');
  const [testing, setTesting] = useState(false);
  const [testOk, setTestOk] = useState(false);
  const [copied, setCopied] = useState('');

  const codeOk = isValidRoomCode(codeInput);

  // 설정 카드는 긴 페이지 아래쪽에 있다. [다음]을 눌렀는데 새 단계가 화면 밖에 있으면
  // 폰에서는 아무 일도 안 일어난 것처럼 보이므로, 단계가 바뀔 때마다 위로 끌어올린다.
  const topRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [step, open]);

  /** 지금 입력된 내용으로 설정을 만든다 (두 값 경로 / 전체 붙여넣기 경로 공용) */
  function currentConfig() {
    return pasteMode ? parseFirebaseConfig(pasteText) : buildConfig(projectId, apiKey);
  }

  async function copy(text: string, what: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      setTimeout(() => setCopied(''), 2000);
    } catch {
      setNote('복사가 안 되네요. 길게 눌러서 직접 복사해 주세요.');
    }
  }

  async function runTest() {
    const cfg = currentConfig();
    if (!cfg.ok) { setNote(cfg.error); setStep(4); return; }
    if (!codeOk) { setNote(`우리집 코드는 ${MIN_ROOM_CODE_LENGTH}자 이상이어야 해요. [새 코드 만들기]를 눌러주세요.`); return; }

    setTesting(true);
    setNote('');
    setTestOk(false);
    try {
      const { testConnection } = await import('../sync/syncClient');
      const r = await testConnection(cfg.config, codeInput.trim());
      if (r.ok) {
        setTestOk(true);
        setNote('');
        // 테스트가 통과했을 때만 실제로 켠다 — 안 되는 설정을 저장해두지 않는다
        onChange({
          enabled: true,
          roomCode: codeInput.trim(),
          firebaseConfigText: JSON.stringify(cfg.config),
        });
      } else {
        setNote(r.step ? `${r.step}번에서 막혔어요 — ${r.message}` : r.message);
        if (r.step) setStep(r.step);
      }
    } finally {
      setTesting(false);
    }
  }

  function turnOff() {
    onChange({ enabled: false });
    setTestOk(false);
    setNote('동기화를 껐어요. 이 기기의 기록은 그대로 있습니다.');
  }

  // ---------------------------------------------------------------- 스타일

  const label: React.CSSProperties = {
    fontSize: 12.5, fontWeight: 700, color: '#455a64', marginBottom: 6, display: 'block',
  };
  const input: React.CSSProperties = {
    width: '100%', padding: '11px 12px', border: '1.5px solid #e0e0e0',
    borderRadius: 8, fontSize: 14, boxSizing: 'border-box', outline: 'none',
  };
  const hint: React.CSSProperties = {
    fontSize: 11.5, color: '#90a4ae', marginTop: 6, lineHeight: 1.6,
  };
  const primary: React.CSSProperties = {
    padding: '13px 16px', background: '#27ae60', color: '#fff', border: 'none',
    borderRadius: 10, fontSize: 14.5, fontWeight: 700, cursor: 'pointer',
  };
  const ghost: React.CSSProperties = {
    padding: '13px 16px', background: '#f2f5f6', color: '#607d8b', border: 'none',
    borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer',
  };
  const linkBtn: React.CSSProperties = {
    display: 'block', width: '100%', textAlign: 'center', padding: 13,
    background: '#e8f5ee', color: '#1e8449', borderRadius: 10, fontSize: 14,
    fontWeight: 700, textDecoration: 'none', marginBottom: 12,
  };
  const callout: React.CSSProperties = {
    fontSize: 12.5, color: '#546e7a', background: '#f5f7f8',
    borderRadius: 10, padding: '12px 13px', lineHeight: 1.8,
  };

  // ---------------------------------------------------------------- 상태 배지

  const statusBox = (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8, padding: '11px 13px',
      background: status === 'live' ? '#eafaf1' : status === 'error' ? '#fdedec' : '#f5f7f8',
      borderRadius: 10, marginBottom: 14, fontSize: 13,
      color: status === 'live' ? '#1e8449' : status === 'error' ? '#c0392b' : '#607d8b',
    }}>
      <span style={{ fontSize: 15 }}>
        {status === 'live' ? '✅' : status === 'error' ? '⚠️' : status === 'connecting' ? '⏳' : '📱'}
      </span>
      <span style={{ lineHeight: 1.5 }}>
        {status === 'live' && '연결됐어요. 두 사람의 입력이 실시간으로 합쳐집니다.'}
        {status === 'connecting' && '연결 중이에요…'}
        {status === 'error' && error}
        {status === 'off' && '지금은 이 기기에만 저장하고 있어요.'}
      </span>
    </div>
  );

  // ---------------------------------------------------------------- 단계 내용

  function stepBody() {
    switch (step) {
      case 1:
        return (
          <>
            <a href="https://console.firebase.google.com" target="_blank" rel="noreferrer" style={linkBtn}>
              console.firebase.google.com 열기 ↗
            </a>
            <div style={callout}>
              구글 로그인 → <b>프로젝트 만들기</b><br />
              • 이름은 아무거나 (예: <b>우리집가계부</b>)<br />
              • <b>Google 애널리틱스는 사용 안 함</b> 으로 끄세요<br />
              • 다 만들어지면 <b>계속</b> 을 눌러 프로젝트 화면으로 들어갑니다
            </div>
          </>
        );

      case 2:
        return (
          <div style={callout}>
            왼쪽 메뉴에서 <b>빌드 → Firestore Database</b><br />
            • <b>데이터베이스 만들기</b> 클릭<br />
            • 위치는 <b>asia-northeast3 (서울)</b><br />
            • <b>프로덕션 모드에서 시작</b> 선택 → 만들기<br />
            <span style={{ color: '#90a4ae' }}>
              (지금은 아무나 못 들어오게 잠긴 상태예요. 다음 단계에서 우리만 쓸 수 있게 엽니다)
            </span>
          </div>
        );

      case 3:
        return (
          <>
            <div style={{ ...callout, marginBottom: 12 }}>
              방금 만든 Firestore 화면 위쪽 <b>규칙</b> 탭으로 갑니다.<br />
              적혀 있는 내용을 <b>전부 지우고</b> 아래를 붙여넣은 뒤,
              오른쪽 위 <b>게시</b> 버튼을 꼭 누르세요.
            </div>
            <button
              onClick={() => copy(RULES, 'rules')}
              style={{ ...primary, width: '100%', marginBottom: 10, background: copied === 'rules' ? '#1e8449' : '#27ae60' }}
            >
              {copied === 'rules' ? '복사됐어요!' : '규칙 복사하기'}
            </button>
            <pre style={{
              margin: 0, padding: 12, background: '#263238', color: '#b2ccd6',
              borderRadius: 8, fontSize: 10.5, lineHeight: 1.6, overflowX: 'auto',
            }}>
              {RULES}
            </pre>
          </>
        );

      case 4:
        return pasteMode ? (
          <>
            <div style={{ ...callout, marginBottom: 12 }}>
              프로젝트 화면에서 <b>{'</>'}</b> (웹) 아이콘 → <b>앱 닉네임</b>에 아무 이름
              (예: <b>가계부</b>) → <b>앱 등록</b>.<br />
              <b style={{ color: '#e67e22' }}>닉네임은 그냥 이름표예요. 링크를 넣는 칸이 아닙니다.</b><br />
              그다음 화면의 <b>firebaseConfig = {'{ … }'}</b> 부분을 통째로 복사해 아래에 붙여넣으세요.
            </div>
            <textarea
              rows={7}
              value={pasteText}
              onChange={e => setPasteText(e.target.value)}
              placeholder={'const firebaseConfig = {\n  apiKey: "AIza…",\n  projectId: "…"\n};'}
              autoCapitalize="none" autoCorrect="off" spellCheck={false}
              style={{ ...input, fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 11.5, resize: 'vertical' }}
            />
            <button
              onClick={() => setPasteMode(false)}
              style={{ ...ghost, width: '100%', marginTop: 10, fontSize: 12.5 }}
            >
              ← 값 두 개만 넣는 쉬운 방법으로 돌아가기
            </button>
          </>
        ) : (
          <>
            <div style={{ ...callout, marginBottom: 14 }}>
              왼쪽 위 <b>⚙️ (톱니바퀴) → 프로젝트 설정</b> → <b>일반</b> 탭.<br />
              거기 적혀 있는 값 <b>두 개</b>만 옮기면 됩니다.
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={label} htmlFor="pid">프로젝트 ID</label>
              <input
                id="pid" type="text" value={projectId}
                onChange={e => setProjectId(e.target.value)}
                placeholder="wooricip-a1b2c"
                autoCapitalize="none" autoCorrect="off" spellCheck={false}
                style={{ ...input, fontFamily: 'ui-monospace, Menlo, monospace' }}
              />
              <div style={hint}>
                만들 때 정한 이름 뒤에 짧은 글자가 붙은 형태예요.
                <b> 링크(주소)가 아닙니다.</b>
              </div>
            </div>

            <div>
              <label style={label} htmlFor="akey">웹 API 키</label>
              <input
                id="akey" type="text" value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                placeholder="AIzaSy…"
                autoCapitalize="none" autoCorrect="off" spellCheck={false}
                style={{ ...input, fontFamily: 'ui-monospace, Menlo, monospace' }}
              />
              <div style={hint}>
                <b>AIza</b> 로 시작하는 긴 글자입니다.
                비밀번호가 아니라 공개용 값이라 배우자에게 보내도 괜찮아요.
              </div>
            </div>

            <button
              onClick={() => setPasteMode(true)}
              style={{ ...ghost, width: '100%', marginTop: 14, fontSize: 12.5 }}
            >
              이 화면에서 값이 안 보이면 → 다른 방법으로 하기
            </button>
          </>
        );

      case 5:
      default:
        return (
          <>
            <div style={{ marginBottom: 14 }}>
              <label style={label} htmlFor="roomcode">우리집 코드</label>
              <input
                id="roomcode" type="text" value={codeInput}
                onChange={e => { setCodeInput(e.target.value); setTestOk(false); }}
                placeholder="[새 코드 만들기]를 눌러주세요"
                autoCapitalize="none" autoCorrect="off" spellCheck={false}
                style={{
                  ...input, fontFamily: 'ui-monospace, Menlo, monospace', letterSpacing: 0.5,
                  borderColor: codeInput && !codeOk ? '#e74c3c' : '#e0e0e0',
                }}
              />
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button
                  onClick={() => { setCodeInput(generateRoomCode()); setTestOk(false); }}
                  style={{ ...ghost, flex: 1, padding: 10, fontSize: 12.5 }}
                >
                  새 코드 만들기
                </button>
                <button
                  onClick={() => copy(codeInput, 'code')}
                  disabled={!codeInput}
                  style={{ ...ghost, flex: 1, padding: 10, fontSize: 12.5, color: copied === 'code' ? '#27ae60' : '#607d8b' }}
                >
                  {copied === 'code' ? '복사됐어요' : '복사'}
                </button>
              </div>
              <div style={{ ...hint, color: '#9a7d0a', background: '#fef9e7', borderRadius: 8, padding: '9px 11px', marginTop: 9 }}>
                🔒 <b>이 코드가 비밀번호입니다.</b> 카톡으로 보내지 말고 배우자 폰에 직접 입력해 주세요.
              </div>
            </div>

            <button
              onClick={runTest}
              disabled={testing}
              style={{ ...primary, width: '100%', opacity: testing ? 0.6 : 1 }}
            >
              {testing ? '확인 중…' : '연결 테스트'}
            </button>

            {testOk && (
              <div style={{
                marginTop: 14, padding: '14px 14px', background: '#eafaf1',
                borderRadius: 10, fontSize: 13, color: '#1e8449', lineHeight: 1.8,
              }}>
                <b>✅ 연결됐어요!</b>
                <div style={{ marginTop: 10, color: '#2c6e49' }}>
                  이제 배우자 폰에서 이 가계부를 열고, <b>설정 → 둘이서 같이 쓰기</b> 에서
                  아래 설정을 붙여넣고 <b>같은 코드</b>를 입력하면 됩니다.
                </div>
                <button
                  onClick={() => {
                    const cfg = currentConfig();
                    if (cfg.ok) copy(JSON.stringify(cfg.config), 'cfg');
                  }}
                  style={{ ...ghost, width: '100%', marginTop: 12, background: '#fff', color: copied === 'cfg' ? '#27ae60' : '#1e8449' }}
                >
                  {copied === 'cfg' ? '복사됐어요' : '설정 복사 (카톡으로 보내도 안전)'}
                </button>
                <button
                  onClick={() => { const n = onUploadAll(); setNote(`${n}건을 올렸어요.`); }}
                  style={{ ...ghost, width: '100%', marginTop: 8, background: '#fff', color: '#1e8449' }}
                >
                  지금까지 기록 올리기 ({counts.incomes + counts.fixed + counts.expenses}건)
                </button>
              </div>
            )}
          </>
        );
    }
  }

  // ---------------------------------------------------------------- 렌더

  return (
    <div style={cardStyle}>
      <div ref={topRef} style={{ scrollMarginTop: 64 }} />
      <h3 style={{ margin: '0 0 4px', fontSize: 15, color: '#333' }}>둘이서 같이 쓰기</h3>
      <p style={{ margin: '0 0 14px', fontSize: 12.5, color: '#95a5a6', lineHeight: 1.7 }}>
        설정하지 않아도 앱은 잘 돌아가요. 다만 기록이 <b>이 기기에만</b> 저장됩니다.
        구글 Firebase(무료)를 연결하면 두 사람 폰이 같은 가계부를 실시간으로 봅니다.
      </p>

      {statusBox}

      {!open ? (
        <button onClick={() => setOpen(true)} style={{ ...primary, width: '100%' }}>
          {status === 'live' ? '동기화 설정 다시 보기' : '설정 시작하기 (약 10분, 한 번만)'}
        </button>
      ) : (
        <>
          {/* 진행 표시 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            {STEP_TITLES.map((_, i) => (
              <div
                key={i}
                style={{
                  flex: 1, height: 4, borderRadius: 2,
                  background: i + 1 <= step ? '#27ae60' : '#e4e9eb',
                  transition: 'background 250ms ease',
                }}
              />
            ))}
          </div>
          <div style={{ fontSize: 12, color: '#90a4ae', marginBottom: 12 }}>
            {step} / {TOTAL} · <b style={{ color: '#455a64' }}>{STEP_TITLES[step - 1]}</b>
          </div>

          <div style={{ marginBottom: 14 }}>{stepBody()}</div>

          {note && (
            <div style={{
              fontSize: 12.5, color: '#c0392b', background: '#fdedec',
              borderRadius: 8, padding: '11px 12px', marginBottom: 12, lineHeight: 1.7,
            }}>
              {note}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => { setNote(''); step === 1 ? setOpen(false) : setStep(step - 1); }}
              style={{ ...ghost, flex: 1 }}
            >
              {step === 1 ? '접기' : '이전'}
            </button>
            {step < TOTAL && (
              <button
                onClick={() => { setNote(''); setStep(step + 1); }}
                style={{ ...primary, flex: 1.4 }}
              >
                다음
              </button>
            )}
          </div>

          {sync.enabled && (
            <button
              onClick={turnOff}
              style={{
                width: '100%', marginTop: 10, padding: 11, background: 'none',
                border: 'none', fontSize: 12.5, color: '#b0bec5', cursor: 'pointer',
              }}
            >
              동기화 끄기
            </button>
          )}
        </>
      )}
    </div>
  );
}

import React, { useEffect, useRef, useState } from 'react';
import { Asset, AssetKind, Goal, Loan, Recurring, Snapshot, Syncable, Upcoming } from '../types';
import {
  Backup, backupFileName, backupSummary, buildBackup, downloadBackup, downloadFile, parseBackup, serializeBackup,
} from '../utils/backup';
import { ICS_FILE_NAME, buildIcs } from '../utils/ics';
import { deletedOnly } from '../utils/merge';
import { CollName } from '../hooks/useAssets';
import { COLOR, card, dangerButton, empty, ghostButton, primaryButton, sectionTitle } from './ui';

interface Props {
  kinds: AssetKind[];
  assets: Asset[];
  loans: Loan[];
  recurrings: Recurring[];
  goals: Goal[];
  snapshots: Snapshot[];
  /** 다가오는 만기 — 캘린더로 내보낸다 */
  upcoming: Upcoming[];
  /** 파일 검사는 여기서 끝낸다 — 부모는 이미 읽어낸 백업을 받는다 */
  onImport: (backup: Backup) => { ok: boolean; message: string };
  onRestore: (coll: CollName, id: string) => void;
  onReset: () => void;
}

const COLL_LABEL: Record<CollName, string> = {
  kinds: '분류', assets: '자산', loans: '대출', recurrings: '고정비', goals: '목표',
};

export default function SettingsView({
  kinds, assets, loans, recurrings, goals, snapshots, upcoming, onImport, onRestore, onReset,
}: Props) {
  const offline = useOfflineReady();
  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const trash: { coll: CollName; rec: Syncable & { name: string } }[] = [
    ...deletedOnly(kinds).map(r => ({ coll: 'kinds' as CollName, rec: r })),
    ...deletedOnly(assets).map(r => ({ coll: 'assets' as CollName, rec: r })),
    ...deletedOnly(loans).map(r => ({ coll: 'loans' as CollName, rec: r })),
    ...deletedOnly(recurrings).map(r => ({ coll: 'recurrings' as CollName, rec: r })),
    ...deletedOnly(goals).map(r => ({ coll: 'goals' as CollName, rec: r })),
  ].sort((a, b) => b.rec.updatedAt - a.rec.updatedAt);

  const handleExport = () => {
    const backup = buildBackup({ kinds, assets, loans, recurrings, goals, snapshots });
    downloadBackup(serializeBackup(backup), backupFileName());
    setMessage({ ok: true, text: `백업 파일을 내려받았어요. (${backupSummary(backup)})` });
  };

  const handleFile = async (file: File) => {
    const text = await file.text();
    const parsed = parseBackup(text);
    if (!parsed.ok) {
      setMessage({ ok: false, text: parsed.error });
      return;
    }
    const result = onImport(parsed.backup);
    setMessage({ ok: result.ok, text: result.message });
  };

  const [icsMessage, setIcsMessage] = useState<string | null>(null);
  const handleIcs = () => {
    downloadFile(buildIcs(upcoming), ICS_FILE_NAME, 'text/calendar;charset=utf-8');
    setIcsMessage(`${ICS_FILE_NAME} 을 내려받았어요. 만기 ${upcoming.length}건이 들어 있어요.`);
  };

  const handleReset = () => {
    if (!window.confirm(
      '모든 자산·대출·고정비·목표 기록을 지웁니다.\n되돌릴 수 없어요.\n\n먼저 [백업 파일로 내보내기]를 해두는 걸 권합니다.\n\n정말 지울까요?',
    )) return;
    if (!window.confirm('마지막 확인이에요. 정말 전부 지울까요?')) return;
    onReset();
    setMessage({ ok: true, text: '전부 지웠어요.' });
  };

  return (
    <div>
      {/* 백업이 이 앱에서 가장 중요한 기능이라 맨 위에 둔다 */}
      <div style={sectionTitle}>💾 백업</div>

      <div style={{ ...card, margin: '0 16px' }}>
        <p style={{ margin: '0 0 14px', fontSize: 13, color: COLOR.sub, lineHeight: 1.65 }}>
          이 앱은 <strong>이 브라우저 안에만</strong> 기록을 저장해요.
          브라우저 데이터를 지우거나 폰을 바꾸면 사라지니,
          가끔 백업 파일을 내려받아 두세요.
        </p>

        <button style={primaryButton} onClick={handleExport}>
          백업 파일로 내보내기
        </button>

        <button
          style={{ ...ghostButton, marginTop: 8 }}
          onClick={() => fileRef.current?.click()}
        >
          백업 파일 불러오기
        </button>

        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          style={{ display: 'none' }}
          onChange={e => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
            e.target.value = '';   // 같은 파일을 다시 골라도 이벤트가 오게
          }}
        />

        <p style={{ margin: '10px 0 0', fontSize: 12, color: COLOR.faint, lineHeight: 1.6 }}>
          불러오기는 지금 기록 위에 <strong>합칩니다.</strong> 같은 항목은 더 최근에 고친 쪽이 남아요.
        </p>

        {message && (
          <p
            style={{
              margin: '12px 0 0', padding: '10px 12px', borderRadius: 8,
              fontSize: 13, lineHeight: 1.6,
              background: message.ok ? '#e8f6ee' : '#fdecea',
              color: message.ok ? '#1e7e45' : '#c0392b',
            }}
          >
            {message.text}
          </p>
        )}
      </div>

      {/* ── 만기 일정 캘린더 ───────────────────── */}
      <div style={sectionTitle}>📅 만기 일정</div>
      <div style={{ ...card, margin: '0 16px' }}>
        <p style={{ margin: '0 0 14px', fontSize: 13, color: COLOR.sub, lineHeight: 1.65 }}>
          적금 만기와 대출 종료일을 캘린더 파일(.ics)로 내보내요.
          내려받은 파일을 열면 <strong>캘린더 앱</strong>에 종일 일정으로 들어가고, <strong>7일 전</strong>에 알림이 울립니다.
        </p>
        <button
          style={{ ...ghostButton, opacity: upcoming.length ? 1 : 0.5 }}
          disabled={upcoming.length === 0}
          onClick={handleIcs}
        >
          만기 일정 캘린더로 내보내기 (.ics)
        </button>
        <p style={{ margin: '10px 0 0', fontSize: 12, color: COLOR.faint, lineHeight: 1.6 }}>
          {upcoming.length === 0
            ? '아직 다가오는 만기가 없어요. 자산에 만기일을, 대출에 기간을 적으면 여기 잡혀요.'
            : `다가오는 만기 ${upcoming.length}건. 다시 내보내 가져와도 같은 일정이 두 개 생기지 않아요.`}
        </p>
        {icsMessage && (
          <p style={{ margin: '12px 0 0', padding: '10px 12px', borderRadius: 8, fontSize: 13, lineHeight: 1.6, background: '#e8f6ee', color: '#1e7e45' }}>
            {icsMessage}
          </p>
        )}
      </div>

      {/* ── 오프라인 ───────────────────────────── */}
      <div style={sectionTitle}>📶 오프라인</div>
      <div style={{ ...card, margin: '0 16px' }}>
        {offline ? (
          <p style={{ margin: 0, fontSize: 13, color: '#1e7e45', fontWeight: 700 }}>
            오프라인 사용 가능 ✓
            <span style={{ display: 'block', marginTop: 4, fontWeight: 500, color: COLOR.sub, lineHeight: 1.6 }}>
              앱 화면을 이 기기에 담아뒀어요. 인터넷이 끊겨도 열리고 적을 수 있어요.
            </span>
          </p>
        ) : (
          <p style={{ margin: 0, fontSize: 13, color: COLOR.sub, lineHeight: 1.65 }}>
            아직 오프라인 준비가 안 됐어요. 인터넷이 연결된 상태로 앱을 한 번 더 열면
            화면을 담아두고, 그다음부터는 인터넷 없이도 열려요.
          </p>
        )}
      </div>

      {/* ── 홈 화면에 추가 안내 ─────────────────── */}
      <div style={sectionTitle}>📱 폰에서 앱처럼 쓰기</div>
      <div style={{ ...card, margin: '0 16px' }}>
        <p style={{ margin: 0, fontSize: 13, color: COLOR.sub, lineHeight: 1.7 }}>
          브라우저 <strong>공유</strong> 버튼 → <strong>홈 화면에 추가</strong>를 누르면
          앱 아이콘으로 바로 열려요.<br />
          주소창 없이 전체 화면으로 뜨고, 저장한 기록도 더 오래 남습니다.
        </p>
      </div>

      {/* ── 휴지통 ─────────────────────────────── */}
      <div style={sectionTitle}>🗑️ 지운 항목 되살리기</div>
      <div style={{ ...card, margin: '0 16px', padding: trash.length ? 0 : 16, overflow: 'hidden' }}>
        {trash.length === 0 ? (
          <div style={{ ...empty, padding: 0 }}>지운 항목이 없어요.</div>
        ) : (
          trash.map(({ coll, rec }, i) => (
            <div
              key={`${coll}:${rec.id}`}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px',
                borderBottom: i === trash.length - 1 ? 'none' : `1px solid ${COLOR.line}`,
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {rec.name}
                </div>
                <div style={{ fontSize: 12, color: COLOR.faint, marginTop: 2 }}>
                  {COLL_LABEL[coll]}
                </div>
              </div>
              <button
                onClick={() => onRestore(coll, rec.id)}
                style={{
                  padding: '7px 13px', borderRadius: 8, border: `1px solid ${COLOR.line}`,
                  background: '#fbfcfd', color: COLOR.accent, fontSize: 13,
                  fontWeight: 600, cursor: 'pointer',
                }}
              >
                되살리기
              </button>
            </div>
          ))
        )}
      </div>

      {/* ── 초기화 ─────────────────────────────── */}
      <div style={{ padding: '24px 16px 0' }}>
        <button style={dangerButton} onClick={handleReset}>전체 기록 지우기</button>
      </div>

      <p style={{ margin: '20px 16px 0', fontSize: 11, color: COLOR.faint, textAlign: 'center', lineHeight: 1.7 }}>
        기록은 이 기기의 브라우저 저장소에만 있어요.<br />
        서버로 보내지 않습니다.
      </p>

      <div style={{ height: 24 }} />
    </div>
  );
}

/**
 * 서비스워커가 이 페이지를 쥐고 있는가 = 오프라인에서도 뜨는가.
 * 처음 설치 직후에는 controller 가 아직 없다가 claim 되면서 바뀌므로 controllerchange 를 듣는다.
 */
function useOfflineReady(): boolean {
  const read = () => typeof navigator !== 'undefined'
    && !!navigator.serviceWorker && !!navigator.serviceWorker.controller;
  const [ready, setReady] = useState(read);
  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.serviceWorker) return;
    const sw = navigator.serviceWorker;
    const onChange = () => setReady(read());
    sw.addEventListener('controllerchange', onChange);
    return () => sw.removeEventListener('controllerchange', onChange);
  }, []);
  return ready;
}

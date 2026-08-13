import React, { useRef, useState } from 'react';
import { Asset, AssetKind, Goal, Loan, Recurring, Syncable } from '../types';
import {
  backupFileName, backupSummary, buildBackup, downloadBackup, parseBackup, serializeBackup,
} from '../utils/backup';
import { deletedOnly } from '../utils/merge';
import { CollName } from '../hooks/useAssets';
import { COLOR, card, dangerButton, empty, ghostButton, primaryButton, sectionTitle } from './ui';

interface Props {
  kinds: AssetKind[];
  assets: Asset[];
  loans: Loan[];
  recurrings: Recurring[];
  goals: Goal[];
  onImport: (text: string) => { ok: boolean; message: string };
  onRestore: (coll: CollName, id: string) => void;
  onReset: () => void;
}

const COLL_LABEL: Record<CollName, string> = {
  kinds: '분류', assets: '자산', loans: '대출', recurrings: '고정비', goals: '목표',
};

export default function SettingsView({
  kinds, assets, loans, recurrings, goals, onImport, onRestore, onReset,
}: Props) {
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
    const backup = buildBackup({ kinds, assets, loans, recurrings, goals });
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
    const result = onImport(text);
    setMessage({ ok: result.ok, text: result.message });
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

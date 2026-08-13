import React, { useRef, useState } from 'react';
import { BlockPlan, Category, Entry, Resist, TimeBlock, UNKNOWN_CATEGORY } from '../types';
import { CollName } from '../hooks/useTracker';
import {
  backupFileName, backupSummary, buildBackup, downloadBackup, parseBackup, serializeBackup,
} from '../utils/backup';
import { deletedOnly } from '../utils/merge';
import { clock, dayKeyOf, durationText } from '../utils/time';
import { COLOR, card, dangerButton, empty, ghostButton, primaryButton, sectionTitle } from './ui';

interface Props {
  categories: Category[];
  entries: Entry[];
  blocks: TimeBlock[];
  plans: BlockPlan[];
  resists: Resist[];
  onImport: (text: string) => { ok: boolean; message: string };
  onRestore: (coll: CollName, id: string) => void;
  onReset: () => void;
}

export default function SettingsView({
  categories, entries, blocks, plans, resists, onImport, onRestore, onReset,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const nameOf = (id: string) => categories.find(c => c.id === id)?.name ?? UNKNOWN_CATEGORY.name;

  const trash: { coll: CollName; id: string; label: string; sub: string; updatedAt: number }[] = [
    ...deletedOnly(categories).map(c => ({
      coll: 'categories' as CollName,
      id: c.id,
      label: `${c.emoji} ${c.name}`,
      sub: '분류',
      updatedAt: c.updatedAt,
    })),
    ...deletedOnly(plans).map(p => ({
      coll: 'plans' as CollName,
      id: p.id,
      label: `${nameOf(p.categoryId)} 계획`,
      sub: `${p.day} · 블록 계획`,
      updatedAt: p.updatedAt,
    })),
    ...deletedOnly(entries).map(e => ({
      coll: 'entries' as CollName,
      id: e.id,
      label: nameOf(e.categoryId),
      sub: e.endedAt
        ? `${dayKeyOf(e.startedAt)} ${clock(e.startedAt)}–${clock(e.endedAt)} · ${durationText((e.endedAt - e.startedAt) / 60_000)}`
        : `${dayKeyOf(e.startedAt)} ${clock(e.startedAt)}~`,
      updatedAt: e.updatedAt,
    })),
  ].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 50);

  const handleExport = () => {
    const backup = buildBackup({ categories, entries, blocks, plans, resists });
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
      '적어둔 시간 기록·분류·블록 계획을 전부 지웁니다.\n되돌릴 수 없어요.\n\n먼저 [백업 파일로 내보내기]를 해두는 걸 권합니다.\n\n정말 지울까요?',
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
          한 번에 시작 버튼까지 닿아야 기록이 이어집니다.
        </p>
      </div>

      {/* ── 휴지통 ─────────────────────────────── */}
      <div style={sectionTitle}>🗑️ 지운 항목 되살리기</div>
      <div style={{ ...card, margin: '0 16px', padding: trash.length ? 0 : 16, overflow: 'hidden' }}>
        {trash.length === 0 ? (
          <div style={{ ...empty, padding: 0 }}>지운 항목이 없어요.</div>
        ) : (
          trash.map((t, i) => (
            <div
              key={`${t.coll}:${t.id}`}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px',
                borderBottom: i === trash.length - 1 ? 'none' : `1px solid ${COLOR.line}`,
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {t.label}
                </div>
                <div style={{ fontSize: 12, color: COLOR.faint, marginTop: 2 }}>{t.sub}</div>
              </div>
              <button
                onClick={() => onRestore(t.coll, t.id)}
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

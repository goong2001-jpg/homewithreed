import React, { useRef, useState } from 'react';
import { Expense, FixedExpense, IncomeEntry, Person } from '../types';
import {
  Backup, backupFileName, backupSummary, buildBackup, parseBackup, serializeBackup,
} from '../utils/backup';

interface Props {
  persons: Person[];
  incomes: IncomeEntry[];
  fixed: FixedExpense[];
  expenses: Expense[];
  onImport: (b: Backup) => { persons: number; incomes: number; fixed: number; expenses: number };
  cardStyle: React.CSSProperties;
}

/**
 * Firebase 없이 부부가 기록을 주고받는 화면.
 * 서버를 거치지 않으므로 데이터는 두 사람 폰과 두 사람이 쓰는 메신저에만 남는다.
 */
export default function ExchangeCard({
  persons, incomes, fixed, expenses, onImport, cardStyle,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [note, setNote] = useState('');
  const [tone, setTone] = useState<'ok' | 'err' | 'info'>('info');
  const [busy, setBusy] = useState(false);

  const hasData = incomes.length + fixed.length + expenses.length > 0;

  function say(msg: string, t: 'ok' | 'err' | 'info' = 'info') {
    setNote(msg);
    setTone(t);
  }

  async function handleExport() {
    if (!hasData) { say('아직 내보낼 기록이 없어요.', 'err'); return; }
    setBusy(true);
    try {
      const backup = buildBackup({ persons, incomes, fixedExpenses: fixed, expenses });
      const text = serializeBackup(backup);
      const name = backupFileName();
      const file = new File([text], name, { type: 'application/json' });

      // 폰에서는 공유 시트로 바로 카톡에 보낼 수 있다
      const nav = navigator as Navigator & {
        canShare?: (d: { files?: File[] }) => boolean;
        share?: (d: { files?: File[]; title?: string; text?: string }) => Promise<void>;
      };
      if (nav.share && nav.canShare?.({ files: [file] })) {
        try {
          await nav.share({ files: [file], title: '우리집 가계부', text: '가계부 기록이에요' });
          say(`보냈어요. ${backupSummary(backup)}`, 'ok');
          return;
        } catch (e) {
          // 사용자가 공유창을 닫은 경우 — 조용히 내려받기로 넘어간다
          if ((e as Error)?.name === 'AbortError') { say(''); return; }
        }
      }

      const url = URL.createObjectURL(file);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      say(`${name} 파일로 저장했어요. 카톡으로 배우자에게 보내주세요.`, 'ok');
    } catch (e) {
      say(`내보내기에 실패했어요: ${(e as Error).message}`, 'err');
    } finally {
      setBusy(false);
    }
  }

  async function handleFile(f: File) {
    setBusy(true);
    try {
      const parsed = parseBackup(await f.text());
      if (!parsed.ok) { say(parsed.error, 'err'); return; }

      const n = onImport(parsed.backup);
      const total = n.persons + n.incomes + n.fixed + n.expenses;
      say(
        total === 0
          ? '이미 다 가지고 있는 기록이에요. 새로 들어온 건 없습니다.'
          : `${total}건을 합쳤어요. (지출 ${n.expenses} · 수입 ${n.incomes} · 고정지출 ${n.fixed} · 사람 ${n.persons})`,
        'ok',
      );
    } catch (e) {
      say(`파일을 읽지 못했어요: ${(e as Error).message}`, 'err');
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  const btn: React.CSSProperties = {
    width: '100%', padding: 13, border: 'none', borderRadius: 10,
    fontSize: 14.5, fontWeight: 700, cursor: busy ? 'wait' : 'pointer',
    opacity: busy ? 0.6 : 1,
  };

  return (
    <div style={cardStyle}>
      <h3 style={{ margin: '0 0 4px', fontSize: 15, color: '#333' }}>파일로 주고받기</h3>
      <p style={{ margin: '0 0 14px', fontSize: 12.5, color: '#95a5a6', lineHeight: 1.7 }}>
        Firebase 설정 없이 부부 기록을 합치는 방법이에요.
        한쪽에서 <b>내보내기</b> → 카톡으로 전송 → 상대가 <b>가져오기</b>.
        서버를 거치지 않아 <b>두 사람 폰에만</b> 남습니다.
      </p>

      <button
        onClick={handleExport}
        disabled={busy}
        style={{ ...btn, background: '#27ae60', color: '#fff' }}
      >
        내보내기 (배우자에게 보낼 파일 만들기)
      </button>

      <button
        onClick={() => fileRef.current?.click()}
        disabled={busy}
        style={{ ...btn, background: '#f2f5f6', color: '#455a64', marginTop: 9 }}
      >
        가져오기 (배우자가 보낸 파일 합치기)
      </button>

      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        style={{ display: 'none' }}
        onChange={e => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
        }}
      />

      {note && (
        <div style={{
          marginTop: 12, padding: '11px 12px', borderRadius: 8, fontSize: 12.5, lineHeight: 1.7,
          background: tone === 'ok' ? '#eafaf1' : tone === 'err' ? '#fdedec' : '#eceff1',
          color: tone === 'ok' ? '#1e8449' : tone === 'err' ? '#c0392b' : '#455a64',
        }}>
          {note}
        </div>
      )}

      <div style={{
        marginTop: 12, fontSize: 11.5, color: '#90a4ae', lineHeight: 1.8,
        background: '#fafbfc', borderRadius: 8, padding: '10px 12px',
      }}>
        <b>덮어쓰지 않고 합칩니다.</b> 각자 넣은 지출은 둘 다 남고,
        같은 항목을 고쳤으면 나중에 고친 게 남습니다.
        한쪽에서 지운 항목이 되살아나지도 않아요.<br />
        서로 한 번씩 주고받으면 두 폰이 똑같아집니다.
      </div>
    </div>
  );
}

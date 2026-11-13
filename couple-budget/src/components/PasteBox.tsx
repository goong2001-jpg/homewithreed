import React, { useState } from 'react';
import { Expense, ExpenseCategory } from '../types';
import { dateLabel, won } from '../utils/format';
import { guessCategory, parseSms } from '../utils/smsParse';

export interface PastedExpense {
  amount: number;
  content: string;
  date: string;
  /** 짐작이 안 되면 없다 — 화면에 골라져 있던 카테고리를 그대로 둔다 */
  category?: ExpenseCategory;
}

interface Props {
  /** 전에 적은 지출 — 같은 가게 이름이면 그때 고른 카테고리를 다시 쓴다 */
  history: Expense[];
  onFill: (item: PastedExpense) => void;
}

/**
 * 입력 탭 — 카드 문자·알림을 붙여넣으면 금액·가게·날짜·카테고리 칸을 채워준다 (v21).
 * 채우기만 하고 저장은 사용자가 확인한 뒤 누른다. 직접 입력은 예전 그대로 된다.
 * 붙여넣은 글은 이 폰 밖으로 나가지 않고 저장하지도 않는다 (utils/smsParse.ts).
 */
export default function PasteBox({ history, onFill }: Props) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [note, setNote] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null);

  function apply(raw: string) {
    const r = parseSms(raw);
    if (!r.ok) {
      setNote({
        tone: 'bad',
        text: r.reason === 'cancel' ? '취소 문자라서 채우지 않았어요.'
          : r.reason === 'noAmount' ? '금액을 찾지 못했어요. 아래에 직접 적어주세요.'
          : '문자를 붙여넣어 주세요.',
      });
      return;
    }
    const p = r.parsed;
    const category = guessCategory(p.content, history) ?? undefined;
    onFill({ amount: p.amount, content: p.content, date: p.date, category });
    setNote({
      tone: 'ok',
      text: [
        won(p.amount),
        p.content || '가게 이름은 못 찾았어요',
        p.hasDate ? dateLabel(p.date) : '날짜가 없어 오늘로',
        category ?? '카테고리는 직접 골라주세요',
      ].join(' · ') + ' — 아래에서 확인하고 저장하세요.',
    });
    setText('');
  }

  /** 클립보드를 바로 읽는다 — 브라우저가 막으면(권한·아이폰 등) 칸에 직접 붙여넣게 안내한다 */
  async function fromClipboard() {
    try {
      const raw = await navigator.clipboard.readText();
      if (raw && raw.trim()) { apply(raw); return; }
      setNote({ tone: 'bad', text: '복사한 글이 없어요. 문자를 먼저 복사해 주세요.' });
    } catch {
      setNote({ tone: 'bad', text: '바로 가져오지 못했어요. 아래 칸을 길게 눌러 붙여넣어 주세요.' });
    }
  }

  if (!open) {
    return (
      <div style={{ padding: '14px 16px 0' }}>
        <button
          onClick={() => setOpen(true)}
          style={{
            width: '100%', padding: '12px 14px', borderRadius: 14, cursor: 'pointer',
            border: '1px dashed #D1D6DB', background: '#fff', color: '#4E5968',
            fontSize: 13.5, fontWeight: 600, textAlign: 'left',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}
        >
          <span>카드 문자·알림 붙여넣어서 채우기</span>
          <span style={{ color: '#B0B8C1', fontSize: 12, fontWeight: 500 }}>열기</span>
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: '14px 16px 0' }}>
      <div style={{ background: '#fff', borderRadius: 14, padding: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
          <span style={{ fontSize: 13.5, fontWeight: 700, color: '#191F28' }}>카드 문자·알림 붙여넣기</span>
          <button
            onClick={() => { setOpen(false); setNote(null); }}
            style={{ background: 'none', border: 'none', color: '#8B95A1', fontSize: 12, cursor: 'pointer', padding: 0 }}
          >
            닫기
          </button>
        </div>
        <textarea
          id="paste-sms"
          value={text}
          onChange={e => setText(e.target.value)}
          onPaste={e => {
            // 붙여넣는 순간 바로 채운다 — 버튼을 한 번 덜 누른다
            const raw = e.clipboardData.getData('text');
            if (raw && raw.trim()) { e.preventDefault(); apply(raw); }
          }}
          placeholder="카드 결제 문자나 알림을 복사해서 여기에 붙여넣으세요"
          rows={3}
          style={{
            width: '100%', padding: '10px 12px', border: '1.5px solid #E5E8EB', borderRadius: 12,
            fontSize: 14, boxSizing: 'border-box', outline: 'none', resize: 'vertical',
            fontFamily: 'inherit', color: '#191F28',
          }}
        />
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button
            onClick={fromClipboard}
            style={{
              flex: 1, padding: '11px 6px', borderRadius: 12, border: 'none', cursor: 'pointer',
              background: '#E8F8F0', color: '#0E9F5B', fontSize: 13, fontWeight: 700,
            }}
          >
            복사한 글 바로 가져오기
          </button>
          <button
            onClick={() => apply(text)}
            disabled={!text.trim()}
            style={{
              flex: '0 0 84px', padding: '11px 6px', borderRadius: 12, border: 'none',
              cursor: text.trim() ? 'pointer' : 'default',
              background: text.trim() ? '#12B76A' : '#F2F4F6',
              color: text.trim() ? '#fff' : '#B0B8C1', fontSize: 13, fontWeight: 700,
            }}
          >
            채우기
          </button>
        </div>
        {note && (
          <div
            role="status"
            style={{
              marginTop: 10, padding: '9px 12px', borderRadius: 10, fontSize: 12.5, lineHeight: 1.6,
              background: note.tone === 'ok' ? '#E8F8F0' : '#FFEEF0',
              color: note.tone === 'ok' ? '#0E9F5B' : '#D22030',
            }}
          >
            {note.text}
          </div>
        )}
        <div style={{ fontSize: 11.5, color: '#B0B8C1', marginTop: 8, lineHeight: 1.6 }}>
          붙여넣은 글은 이 폰 안에서만 읽고, 어디에도 보내거나 남기지 않아요.
        </div>
      </div>
    </div>
  );
}

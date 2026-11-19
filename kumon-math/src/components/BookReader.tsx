import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Book } from '../words/books';
import { speakBook, speakSentence } from '../alphabet/speech';
import { touchActivity } from '../words/studyTime';
import { PageRecorder, playPages, recordingSupported, saveRecording } from '../words/voice';
import { CouponKind } from '../words/coupons';
import { isoToday } from '../words/dates';
import { playClick, playCorrect, playStreak } from '../utils/sounds';
import BookText from './BookText';

type Step = 'listen' | 'read' | 'replay' | 'done';

const STEPS: { id: Step; label: string }[] = [
  { id: 'listen', label: '① 듣기' },
  { id: 'read', label: '② 소리 내어 읽기' },
  { id: 'replay', label: '③ 내 목소리 듣기' },
];

/** 책을 다 읽으면 주는 별 */
export const BOOK_STARS = 3;

const btn = (on = true): React.CSSProperties => ({
  flex: 1, padding: '13px 0', borderRadius: 14, border: 'none',
  background: on ? 'linear-gradient(135deg,#667eea,#764ba2)' : '#ddd', color: 'white',
  fontSize: 16, fontWeight: 900, cursor: on ? 'pointer' : 'default', fontFamily: 'inherit',
});
const line = (color = '#7c4dff'): React.CSSProperties => ({
  flex: 1, padding: '12px 0', borderRadius: 14, border: `2px solid ${color}`, background: 'white',
  color, fontSize: 15, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit',
});

/**
 * 책 한 권 읽기 — 문서의 "3단계 낭독"
 *   ① 요정이 읽어 주는 걸 들으며 눈으로 따라가기 (읽는 낱말에 형광펜)
 *   ② 구름이가 소리 내어 읽기 — 쪽마다 녹음
 *   ③ 녹음한 내 목소리 다시 듣기
 * 다 읽으면 별과 쿠폰(하루 정해진 만큼)을 받고, 마음에 드는 문장을 하나 골라 노트에 적는다.
 */
export default function BookReader({ book, onFinish, onNote, onClose }: {
  book: Book;
  /** 끝까지 읽었을 때 한 번 — 받은 쿠폰을 돌려준다 (오늘 다 받았으면 null) */
  onFinish: () => CouponKind | null;
  /** 마음에 드는 문장을 골랐을 때 */
  onNote: (en: string, ko: string) => void;
  onClose: () => void;
}) {
  const [step, setStep] = useState<Step>('listen');
  const [page, setPage] = useState(0);
  const [mark, setMark] = useState(-1);
  const [showKo, setShowKo] = useState(false);
  // 녹음: null = 마이크 여는 중, true = 녹음함, false = 녹음 없이 읽기
  const [recOk, setRecOk] = useState<boolean | null>(null);
  const [recording, setRecording] = useState(false);
  const recorder = useRef<PageRecorder | null>(null);
  const takes = useRef<(Blob | null)[]>([]);
  const [prize, setPrize] = useState<CouponKind | null | undefined>(undefined);
  const [picked, setPicked] = useState<string | null>(null);
  const stopReplay = useRef<(() => void) | null>(null);
  const p = book.pages[page];
  const last = page === book.pages.length - 1;

  // 한 쪽을 읽어 준다 (읽는 낱말에 형광펜)
  const run = useRef(0);
  const readAloud = useCallback((i: number) => {
    const my = ++run.current;   // 끊긴 앞 읽기의 늦은 알림은 무시한다
    touchActivity();
    setMark(-1);
    speakBook(book.pages[i].en,
      idx => { if (run.current === my) { setMark(idx); touchActivity(); } },
      () => { if (run.current === my) setMark(-1); });
  }, [book]);

  // ① 듣기: 쪽이 바뀌면 읽어 준다
  useEffect(() => {
    if (step !== 'listen') return;
    const t = setTimeout(() => readAloud(page), 350);
    return () => clearTimeout(t);
  }, [step, page, readAloud]);

  // ② 읽기: 들어가면 마이크를 연다 (허락하지 않으면 녹음 없이)
  useEffect(() => {
    if (step !== 'read') return;
    let alive = true;
    takes.current = book.pages.map(() => null);
    if (!recordingSupported()) { setRecOk(false); return; }
    const r = new PageRecorder();
    recorder.current = r;
    r.open().then(ok => { if (alive) setRecOk(ok); });
    return () => { alive = false; };
  }, [step, book]);

  // 녹음하는 동안은 화면을 안 만져도 공부 시간으로 센다
  useEffect(() => {
    if (!recording) return;
    const t = setInterval(() => touchActivity(), 10_000);
    return () => clearInterval(t);
  }, [recording]);

  // ③ 다시 듣기
  useEffect(() => {
    if (step !== 'replay') return;
    stopReplay.current = playPages(takes.current, i => { setPage(i); touchActivity(); }, () => setStep('done'));
    return () => { stopReplay.current?.(); stopReplay.current = null; };
  }, [step]);

  // 다 읽음: 한 번만 보상을 받고 녹음을 저장한다
  useEffect(() => {
    if (step !== 'done' || prize !== undefined) return;
    playStreak();
    setPrize(onFinish());
    saveRecording({ bookId: book.id, date: isoToday(), at: Date.now(), pages: takes.current });
  }, [step, prize, onFinish, book.id]);

  // 화면을 떠나면 마이크를 닫는다
  useEffect(() => () => { recorder.current?.close(); stopReplay.current?.(); }, []);

  const goRead = () => { playClick(); setPage(0); setMark(-1); setStep('read'); };
  const afterReadPage = () => {
    if (!last) { setPage(i => i + 1); return; }
    recorder.current?.close();
    if (takes.current.some(Boolean)) { setPage(0); setStep('replay'); } else setStep('done');
  };
  const startRec = () => {
    playClick();
    touchActivity();
    if (recorder.current?.start()) setRecording(true);
  };
  const stopRec = async () => {
    const blob = await recorder.current?.stop();
    setRecording(false);
    takes.current[page] = blob ?? null;
    playCorrect();
    afterReadPage();
  };

  const header = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
      <button onClick={() => { playClick(); onClose(); }} aria-label="책장으로" style={{
        border: 'none', background: '#f2f0fa', borderRadius: 10, width: 36, height: 36, fontSize: 16,
        cursor: 'pointer', fontWeight: 900, color: '#7c4dff',
      }}>←</button>
      <div style={{ flex: 1, textAlign: 'left' }}>
        <div style={{ fontSize: 16, fontWeight: 900, color: '#44405e' }}>{book.cover} {book.title}</div>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#8a7a9a' }}>{book.titleKo}</div>
      </div>
    </div>
  );

  const steps = (
    <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
      {STEPS.map(s => {
        const idx = STEPS.findIndex(x => x.id === step);
        const me = STEPS.findIndex(x => x.id === s.id);
        const on = s.id === step;
        const past = step === 'done' || me < idx;
        return (
          <div key={s.id} style={{
            flex: 1, padding: '6px 0', borderRadius: 10, fontSize: 11, fontWeight: 900, textAlign: 'center',
            background: on ? 'linear-gradient(135deg,#667eea,#764ba2)' : past ? '#d4f5e2' : '#f2f0fa',
            color: on ? 'white' : past ? '#1e7d4f' : '#aaa',
          }}>{past && !on ? '✓ ' : ''}{s.label}</div>
        );
      })}
    </div>
  );

  const pageView = (
    <div style={{ background: '#fffaf0', borderRadius: 20, padding: '14px 10px', marginBottom: 12, border: '3px solid #f6e3c0' }}>
      <div style={{ fontSize: 76, lineHeight: 1.15 }}>{p.pic}</div>
      <div style={{ minHeight: 90, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '6px 0' }}>
        <BookText text={p.en} unit={book.unit} highlight={mark} />
      </div>
      {showKo
        ? <div style={{ fontSize: 14, fontWeight: 700, color: '#999' }}>{p.ko}</div>
        : <button onClick={() => { setShowKo(true); playClick(); }} style={{
            border: 'none', background: 'none', color: '#b5a6d6', fontSize: 12, fontWeight: 800,
            cursor: 'pointer', fontFamily: 'inherit',
          }}>뜻 보기</button>}
      <div style={{ fontSize: 12, fontWeight: 800, color: '#c0b0a0', marginTop: 6 }}>{page + 1} / {book.pages.length}</div>
    </div>
  );

  return (
    <div style={{
      background: 'white', borderRadius: 24, padding: '16px 14px', width: '100%', maxWidth: 380,
      textAlign: 'center', boxShadow: '0 8px 30px rgba(0,0,0,0.12)', boxSizing: 'border-box',
    }}>
      {header}
      {step !== 'done' && steps}

      {step === 'listen' && (
        <>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#a35f12', marginBottom: 8 }}>
            👂 요정이 읽어 줘요. 눈으로 글자를 따라가 봐!
          </div>
          {pageView}
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => { playClick(); readAloud(page); }} style={{ ...line(), flex: '0 0 64px', fontSize: 20 }}>🔊</button>
            {page > 0 && <button onClick={() => { playClick(); setPage(i => i - 1); }} style={{ ...line(), flex: '0 0 64px' }}>←</button>}
            {last
              ? <button onClick={goRead} style={btn()}>이제 내가 읽어 볼래! 🗣️</button>
              : <button onClick={() => { playClick(); setPage(i => i + 1); }} style={btn()}>다음 장 →</button>}
          </div>
        </>
      )}

      {step === 'read' && (
        <>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#a35f12', marginBottom: 8 }}>
            🗣️ 이번엔 소리 내어 읽어 봐! 모르는 낱말은 눌러서 들어도 돼요
          </div>
          {pageView}
          {recOk === null && <div style={{ fontSize: 14, fontWeight: 800, color: '#888', padding: 10 }}>🎙️ 마이크를 준비하고 있어요…</div>}
          {recOk === true && (
            recording ? (
              <button onClick={stopRec} style={{ ...btn(), width: '100%', background: 'linear-gradient(135deg,#ff9a9e,#f5576c)' }}>
                🔴 녹음 중… 다 읽었으면 눌러요 ✋
              </button>
            ) : (
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => { playClick(); readAloud(page); }} style={{ ...line(), flex: '0 0 64px', fontSize: 20 }} aria-label="도움 듣기">🔊</button>
                <button onClick={startRec} style={btn()}>🎙️ 녹음하며 읽기</button>
              </div>
            )
          )}
          {recOk === false && (
            <>
              <div style={{ fontSize: 12, color: '#999', marginBottom: 8 }}>이 기기에서는 녹음 없이 읽어요</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => { playClick(); readAloud(page); }} style={{ ...line(), flex: '0 0 64px', fontSize: 20 }} aria-label="도움 듣기">🔊</button>
                <button onClick={() => { playCorrect(); touchActivity(); afterReadPage(); }} style={btn()}>다 읽었어요 ✅</button>
              </div>
            </>
          )}
        </>
      )}

      {step === 'replay' && (
        <>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#a35f12', marginBottom: 8 }}>
            🎧 구름이 목소리를 들어 봐요!
          </div>
          {pageView}
          <button onClick={() => { playClick(); stopReplay.current?.(); setStep('done'); }} style={line('#999')}>그만 듣기 →</button>
        </>
      )}

      {step === 'done' && (
        <>
          <div style={{ fontSize: 56 }}>🎉</div>
          <div style={{ fontSize: 20, fontWeight: 900, color: '#27ae60', marginBottom: 4 }}>책을 다 읽었어!</div>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#f39c12', marginBottom: 10 }}>+{BOOK_STARS} ⭐</div>
          {prize ? (
            <div style={{
              background: prize.color, borderRadius: 18, padding: '12px 10px', marginBottom: 12,
              border: '3px dashed rgba(255,255,255,0.9)', animation: 'fadeIn 0.4s ease',
            }}>
              <div style={{ fontSize: 40 }}>{prize.emoji}</div>
              <div style={{ fontSize: 17, fontWeight: 900, color: '#3b2f4a' }}>{prize.name}</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#5b4a6a' }}>🎟️ 책 읽기 쿠폰을 지갑에 담았어요!</div>
            </div>
          ) : prize === null ? (
            <div style={{ fontSize: 13, color: '#888', fontWeight: 700, marginBottom: 12 }}>
              오늘 책 쿠폰은 다 받았어요. 그래도 읽을수록 실력이 쑥쑥! 💪
            </div>
          ) : null}

          <div style={{ background: '#f6f4fd', borderRadius: 16, padding: '12px 10px', marginBottom: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 900, color: '#5b4b8a', marginBottom: 8 }}>
              ✏️ 제일 마음에 드는 문장을 골라 봐!
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {book.pages.map(pg => (
                <button key={pg.en} onClick={() => {
                  playClick();
                  setPicked(pg.en);
                  onNote(pg.en, pg.ko);
                  speakSentence(pg.en);
                }} style={{
                  padding: '9px 10px', borderRadius: 12, fontFamily: 'inherit', cursor: 'pointer', textAlign: 'left',
                  border: picked === pg.en ? '3px solid #27ae60' : '2px solid #e6e1f5',
                  background: picked === pg.en ? '#eafaf1' : 'white', fontSize: 15, fontWeight: 800, color: '#44405e',
                }}>{pg.pic} {pg.en}</button>
              ))}
            </div>
            {picked && (
              <div style={{ fontSize: 13, fontWeight: 800, color: '#27ae60', marginTop: 8 }}>
                📒 내 문장 노트에 적었어요! 이 문장을 한 번 더 소리 내어 말해 봐 🗣️
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => { playClick(); onClose(); }} style={line()}>📚 책장으로</button>
            <button onClick={() => {
              playClick(); setStep('listen'); setPage(0); setPrize(undefined); setPicked(null); setRecOk(null); setShowKo(false);
            }} style={btn()}>한 번 더 읽기 🔁</button>
          </div>
        </>
      )}
    </div>
  );
}

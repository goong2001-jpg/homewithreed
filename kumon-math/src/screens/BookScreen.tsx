import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useWordProgress } from '../hooks/useWordProgress';
import { useGameState } from '../hooks/useGameState';
import { useMissions } from '../hooks/useMissions';
import { useStreak } from '../hooks/useStreak';
import { BOOKS, Book, unlockedBooks } from '../words/books';
import { loadShelf, addRead, addNote, READS_FOR_STARS, ShelfState } from '../words/bookShelf';
import { drawCoupon, CouponKind } from '../words/coupons';
import { logDay } from '../words/log';
import { touchActivity } from '../words/studyTime';
import { UNITS } from '../words/units';
import { speakBook, speakSentence } from '../alphabet/speech';
import { playClick } from '../utils/sounds';
import BookReader, { BOOK_STARS } from '../components/BookReader';
import BookText from '../components/BookText';

type View = { kind: 'shelf' } | { kind: 'read'; book: Book } | { kind: 'listen' } | { kind: 'notes' };

/**
 * 오늘은 듣기만 — 하기 싫은 날에도 영어 소리는 듣게.
 * 열린 책을 요정이 처음부터 끝까지 차례로 읽어 준다 (쪽이 저절로 넘어간다).
 * 듣는 시간도 영어 30분에 들어간다.
 */
function ListenAll({ books, onClose }: { books: Book[]; onClose: () => void }) {
  const pages = useMemo(() => books.flatMap(b => b.pages.map(p => ({ book: b, page: p }))), [books]);
  const [i, setI] = useState(0);
  const [mark, setMark] = useState(-1);
  const [playing, setPlaying] = useState(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cur = pages[i];
  const finished = i >= pages.length;

  useEffect(() => {
    if (!playing || finished) return;
    // 이 쪽을 떠나면 alive 를 끈다. 앞서 읽던 소리가 끊기면서 늦게 오는 "끝" 알림은 무시한다
    // (그러지 않으면 쪽이 한꺼번에 넘어간다)
    let alive = true;
    let next: ReturnType<typeof setTimeout> | null = null;
    touchActivity();
    speakBook(pages[i].page.en, idx => { if (alive) { setMark(idx); touchActivity(); } }, () => {
      if (!alive) return;
      setMark(-1);
      next = setTimeout(() => setI(n => n + 1), 1400);
      timer.current = next;
    });
    return () => { alive = false; if (next) clearTimeout(next); };
  }, [i, playing, finished, pages]);

  // 화면을 떠나면 읽기를 멈춘다
  useEffect(() => () => { try { window.speechSynthesis?.cancel(); } catch {} }, []);

  if (finished) {
    return (
      <div style={panel}>
        <div style={{ fontSize: 50 }}>🌙</div>
        <div style={{ fontSize: 19, fontWeight: 900, color: '#27ae60', margin: '6px 0' }}>책 {books.length}권을 다 들었어!</div>
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <button onClick={onClose} style={lineBtn()}>📚 책장으로</button>
          <button onClick={() => { playClick(); setI(0); setPlaying(true); }} style={bigBtn}>처음부터 또 듣기 🔁</button>
        </div>
      </div>
    );
  }

  return (
    <div style={panel}>
      <div style={{ fontSize: 16, fontWeight: 900, color: '#44405e' }}>🎧 오늘은 듣기만</div>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#8a7a9a', marginBottom: 10 }}>
        {cur.book.cover} {cur.book.title} · 놀면서 들어도 괜찮아요
      </div>
      <div style={{ background: '#fffaf0', borderRadius: 20, padding: '14px 10px', marginBottom: 12, border: '3px solid #f6e3c0' }}>
        <div style={{ fontSize: 76, lineHeight: 1.15 }}>{cur.page.pic}</div>
        <div style={{ minHeight: 80, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <BookText text={cur.page.en} unit={cur.book.unit} highlight={mark} size={26} />
        </div>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#999' }}>{cur.page.ko}</div>
        <div style={{ fontSize: 12, fontWeight: 800, color: '#c0b0a0', marginTop: 6 }}>{i + 1} / {pages.length}</div>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => { playClick(); onClose(); }} style={lineBtn('#999')}>그만</button>
        <button onClick={() => {
          playClick();
          if (playing) { try { window.speechSynthesis?.cancel(); } catch {} if (timer.current) clearTimeout(timer.current); }
          setPlaying(v => !v);
        }} style={bigBtn}>{playing ? '⏸️ 잠깐 멈춤' : '▶️ 계속 듣기'}</button>
      </div>
    </div>
  );
}

const panel: React.CSSProperties = {
  background: 'white', borderRadius: 24, padding: '16px 14px', width: '100%', maxWidth: 380,
  textAlign: 'center', boxShadow: '0 8px 30px rgba(0,0,0,0.12)', boxSizing: 'border-box',
};
const bigBtn: React.CSSProperties = {
  flex: 1, padding: '13px 0', borderRadius: 14, border: 'none',
  background: 'linear-gradient(135deg,#667eea,#764ba2)', color: 'white',
  fontSize: 15, fontWeight: 900, cursor: 'pointer', fontFamily: 'inherit',
};
const lineBtn = (color = '#7c4dff'): React.CSSProperties => ({
  flex: 1, padding: '12px 0', borderRadius: 14, border: `2px solid ${color}`, background: 'white',
  color, fontSize: 15, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit',
});

/** 📒 내 문장 노트 — 책에서 고른 문장. 누르면 읽어 준다 */
function Notes({ shelf, onClose }: { shelf: ShelfState; onClose: () => void }) {
  return (
    <div style={panel}>
      <div style={{ fontSize: 17, fontWeight: 900, color: '#44405e' }}>📒 내 문장 노트</div>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#8a7a9a', marginBottom: 12 }}>
        책에서 고른 마음에 드는 문장 {shelf.notebook.length}개 · 누르면 읽어 줘요. 따라 말해 봐!
      </div>
      {shelf.notebook.length === 0 && (
        <div style={{ fontSize: 14, color: '#999', padding: '20px 0' }}>책을 다 읽고 마음에 드는 문장을 골라 보세요!</div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
        {shelf.notebook.map(n => (
          <button key={n.en} onClick={() => { playClick(); speakSentence(n.en); }} style={{
            padding: '10px 12px', borderRadius: 14, border: '2px solid #e6e1f5', background: '#fffdf6',
            textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit',
          }}>
            <div style={{ fontSize: 17, fontWeight: 900, color: '#44405e' }}>🔊 {n.en}</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#999' }}>{n.ko} · {n.date}</div>
          </button>
        ))}
      </div>
      <button onClick={onClose} style={{ ...lineBtn(), width: '100%' }}>📚 책장으로</button>
    </div>
  );
}

/**
 * 📚 구름이 책장 — 소리 단계마다 한 권씩 열리는 이야기책.
 * 책을 끝까지(듣기 → 소리 내어 읽기 → 다시 듣기) 읽으면 별·쿠폰을 받고 ⭐ 가 하나 붙는다 (3번이면 다 읽은 책).
 */
export default function BookScreen() {
  const { progress, earnBookCoupon, bookCouponsLeft } = useWordProgress();
  const { gameState, addPoints } = useGameState();
  const { bump } = useMissions();
  const { markActive } = useStreak();
  const [shelf, setShelf] = useState<ShelfState>(loadShelf);
  const [view, setView] = useState<View>({ kind: 'shelf' });
  const open = useMemo(() => unlockedBooks(progress.unit), [progress.unit]);

  const back = useCallback(() => { setView({ kind: 'shelf' }); playClick(); }, []);

  const finish = useCallback((book: Book): CouponKind | null => {
    setShelf(s => addRead(s, book.id));
    logDay('books');
    bump('book');
    markActive();
    addPoints(BOOK_STARS);
    // 500원 쿠폰도 같은 확률로 나온다 (뽑기와 같다)
    const c = drawCoupon();
    return earnBookCoupon(c.id) ? c : null;
  }, [bump, markActive, addPoints, earnBookCoupon]);

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(160deg,#fff4dc 0%,#fde2e4 50%,#e3dcff 100%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '14px 16px 40px', fontFamily: "'Nunito','Noto Sans KR',sans-serif",
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', maxWidth: 380, marginBottom: 12 }}>
        <div style={{ fontSize: 21, fontWeight: 900, color: '#44405e' }}>📚 구름이 책장</div>
        <div style={{ background: 'white', borderRadius: 14, padding: '7px 12px', fontSize: 14, fontWeight: 800, color: '#f39c12', boxShadow: '0 3px 10px rgba(0,0,0,0.1)' }}>
          ⭐ {gameState.points}
        </div>
      </div>

      {view.kind === 'read' && (
        <BookReader book={view.book} onFinish={() => finish(view.book)}
          onNote={(en, ko) => setShelf(s => addNote(s, { bookId: view.book.id, en, ko }))}
          onClose={back} />
      )}
      {view.kind === 'listen' && <ListenAll books={open} onClose={back} />}
      {view.kind === 'notes' && <Notes shelf={shelf} onClose={back} />}

      {view.kind === 'shelf' && (
        <>
          <div style={{ width: '100%', maxWidth: 380, fontSize: 13, color: '#6b6b7d', fontWeight: 700, marginBottom: 10, lineHeight: 1.5 }}>
            배운 소리로 읽을 수 있는 책이에요. 듣고 → 소리 내어 읽고 → 내 목소리를 들어요!
            <br />📖 책 쿠폰: 오늘 {bookCouponsLeft}장 더 받을 수 있어요
          </div>
          <div style={{ display: 'flex', gap: 8, width: '100%', maxWidth: 380, marginBottom: 12 }}>
            <button onClick={() => { playClick(); setView({ kind: 'listen' }); }} style={{
              flex: 1, padding: '11px 6px', borderRadius: 16, border: 'none', background: 'white', color: '#2b6cb0',
              fontSize: 14, fontWeight: 900, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 3px 10px rgba(0,0,0,0.08)',
            }}>🎧 오늘은 듣기만</button>
            <button onClick={() => { playClick(); setView({ kind: 'notes' }); }} style={{
              flex: 1, padding: '11px 6px', borderRadius: 16, border: 'none', background: 'white', color: '#b5478f',
              fontSize: 14, fontWeight: 900, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 3px 10px rgba(0,0,0,0.08)',
            }}>📒 내 문장 노트 {shelf.notebook.length}</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, width: '100%', maxWidth: 380 }}>
            {BOOKS.map(b => {
              const unlocked = b.unit <= progress.unit;
              const reads = shelf.reads[b.id] ?? 0;
              const [s1, s2] = UNITS[b.unit];
              return (
                <button key={b.id} disabled={!unlocked}
                  onClick={() => { playClick(); setView({ kind: 'read', book: b }); }}
                  aria-label={unlocked ? b.title : `${b.unit + 1}단계에서 열려요`}
                  style={{
                    padding: '12px 8px', borderRadius: 18, border: 'none', fontFamily: 'inherit', textAlign: 'center',
                    background: unlocked ? (reads >= READS_FOR_STARS ? 'linear-gradient(135deg,#fff1c9,#f6d365)' : 'white') : 'rgba(255,255,255,0.5)',
                    boxShadow: unlocked ? '0 4px 14px rgba(0,0,0,0.1)' : 'none',
                    cursor: unlocked ? 'pointer' : 'default', opacity: unlocked ? 1 : 0.6,
                  }}>
                  <div style={{ fontSize: 40, lineHeight: 1.1 }}>{unlocked ? b.cover : '🔒'}</div>
                  <div style={{ fontSize: 14, fontWeight: 900, color: '#44405e', marginTop: 4 }}>{unlocked ? b.title : `${b.unit + 1}단계 책`}</div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#8a7a9a' }}>
                    {unlocked ? b.titleKo : `${s1.label} · ${s2.label} 소리를 배우면 열려요`}
                  </div>
                  {unlocked && (
                    <div style={{ fontSize: 14, marginTop: 4, letterSpacing: 2 }}>
                      {Array.from({ length: READS_FOR_STARS }, (_, k) => (k < reads ? '⭐' : '☆')).join('')}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

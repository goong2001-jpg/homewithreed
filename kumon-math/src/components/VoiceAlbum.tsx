import React, { useEffect, useRef, useState } from 'react';
import { listRecordings, playPages, Recording } from '../words/voice';
import { bookById } from '../words/books';
import { playClick } from '../utils/sounds';

/**
 * 🎙️ 구름이 목소리 앨범 — 책마다 처음 녹음과 가장 최근 녹음을 나란히 들어 본다.
 * 녹음은 이 기기에만 있다 (기록 백업에는 들어가지 않는다).
 */
export default function VoiceAlbum() {
  const [recs, setRecs] = useState<Recording[] | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  const [pageNo, setPageNo] = useState(0);
  const stop = useRef<(() => void) | null>(null);

  useEffect(() => {
    listRecordings().then(setRecs);
    return () => stop.current?.();
  }, []);

  const play = (key: string, r: Recording) => {
    playClick();
    stop.current?.();
    if (playing === key) { setPlaying(null); return; }
    setPlaying(key);
    stop.current = playPages(r.pages, i => setPageNo(i), () => setPlaying(null));
  };

  if (recs === null) return <div style={{ fontSize: 12, color: '#999' }}>불러오는 중…</div>;
  if (!recs.length) {
    return <div style={{ fontSize: 12, color: '#888', fontWeight: 700 }}>아직 녹음이 없어요. 책장에서 책을 소리 내어 읽으면 여기에 모여요.</div>;
  }

  const byBook = new Map<string, Recording[]>();
  for (const r of recs) byBook.set(r.bookId, [...(byBook.get(r.bookId) ?? []), r]);

  const chip = (key: string, r: Recording, label: string) => (
    <button key={key} onClick={() => play(key, r)} style={{
      flex: 1, padding: '8px 6px', borderRadius: 12, fontFamily: 'inherit', cursor: 'pointer',
      border: playing === key ? '2px solid #f5576c' : '2px solid #e6e1f5',
      background: playing === key ? '#fff0f3' : 'white', fontSize: 12, fontWeight: 800, color: '#44405e',
    }}>
      {playing === key ? `⏹️ ${pageNo + 1}쪽 듣는 중` : `▶️ ${label}`}
      <div style={{ fontSize: 11, color: '#999', fontWeight: 700 }}>{r.date}</div>
    </button>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {Array.from(byBook.entries()).map(([bookId, list]) => {
        const book = bookById(bookId);
        const first = list[0];
        const latest = list[list.length - 1];
        return (
          <div key={bookId} style={{ background: '#f8f6ff', borderRadius: 14, padding: '8px 10px' }}>
            <div style={{ fontSize: 13, fontWeight: 900, color: '#44405e', marginBottom: 6 }}>
              {book?.cover} {book?.title ?? bookId} <span style={{ color: '#999', fontWeight: 700 }}>· 녹음 {list.length}개</span>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {chip(`${bookId}-first`, first, '처음 녹음')}
              {latest !== first && chip(`${bookId}-latest`, latest, '최근 녹음')}
            </div>
          </div>
        );
      })}
    </div>
  );
}

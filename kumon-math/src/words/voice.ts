/**
 * 구름이 목소리 — 책을 소리 내어 읽을 때 녹음하고, 기기(IndexedDB)에 모아 둔다.
 * 녹음 파일은 크기가 커서 기록 백업 글자에는 넣지 않는다 (이 기기에만 있다).
 */
export interface Recording {
  id?: number;
  bookId: string;
  /** 'YYYY-MM-DD' */
  date: string;
  /** 녹음한 시각 (정렬용) */
  at: number;
  /** 쪽마다 녹음 하나 (안 읽은 쪽은 null) */
  pages: (Blob | null)[];
}

const DB = 'homewithreed-voice';
const STORE = 'recordings';
/** 책마다 처음 녹음 + 최근 녹음 몇 개만 남긴다 (용량 아끼기) */
export const KEEP_LATEST = 3;

export function recordingSupported(): boolean {
  return typeof window !== 'undefined'
    && typeof (window as any).MediaRecorder !== 'undefined'
    && !!navigator.mediaDevices?.getUserMedia;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('no indexedDB')); return; }
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const st = db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
        st.createIndex('bookId', 'bookId');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function done<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** 모든 녹음 (오래된 것부터) */
export async function listRecordings(): Promise<Recording[]> {
  try {
    const db = await openDb();
    const all = await done(db.transaction(STORE).objectStore(STORE).getAll()) as Recording[];
    db.close();
    return all.sort((a, b) => a.at - b.at);
  } catch { return []; }
}

/**
 * 지울 녹음 고르기 — 책마다 처음 것 하나와 최근 KEEP_LATEST 개만 남긴다.
 * (시간이 지나 "처음 vs 지금"을 비교해 들을 수 있게 처음 것은 꼭 남긴다)
 */
export function toPrune(all: Recording[], keepLatest = KEEP_LATEST): number[] {
  const byBook = new Map<string, Recording[]>();
  for (const r of all) byBook.set(r.bookId, [...(byBook.get(r.bookId) ?? []), r]);
  const out: number[] = [];
  byBook.forEach(list => {
    const sorted = list.slice().sort((a, b) => a.at - b.at);
    const keep = new Set([sorted[0], ...sorted.slice(-keepLatest)]);
    for (const r of sorted) if (!keep.has(r) && r.id !== undefined) out.push(r.id);
  });
  return out;
}

/** 녹음을 저장하고, 오래된 것은 정리한다 */
export async function saveRecording(rec: Recording): Promise<void> {
  if (!rec.pages.some(Boolean)) return;
  try {
    const db = await openDb();
    await done(db.transaction(STORE, 'readwrite').objectStore(STORE).add(rec));
    const all = await done(db.transaction(STORE).objectStore(STORE).getAll()) as Recording[];
    const prune = toPrune(all);
    if (prune.length) {
      const st = db.transaction(STORE, 'readwrite').objectStore(STORE);
      await Promise.all(prune.map(id => done(st.delete(id))));
    }
    db.close();
  } catch {}
}

/** 녹음 하나를 쪽 순서대로 틀어 준다. 멈추는 함수를 돌려준다 */
export function playPages(
  pages: (Blob | null)[],
  onPage: (i: number) => void,
  onEnd: () => void,
): () => void {
  let stopped = false;
  let audio: HTMLAudioElement | null = null;
  let url = '';
  const cleanup = () => { if (url) URL.revokeObjectURL(url); url = ''; };
  const play = (i: number) => {
    cleanup();
    if (stopped) return;
    if (i >= pages.length) { onEnd(); return; }
    const blob = pages[i];
    if (!blob) { play(i + 1); return; }
    onPage(i);
    url = URL.createObjectURL(blob);
    audio = new Audio(url);
    audio.onended = () => setTimeout(() => play(i + 1), 400);
    audio.onerror = () => play(i + 1);
    audio.play().catch(() => play(i + 1));
  };
  play(0);
  return () => { stopped = true; try { audio?.pause(); } catch {} cleanup(); };
}

/**
 * 마이크 녹음기 — 책 한 권을 읽는 동안 마이크를 한 번만 열어 두고 쪽마다 녹음한다.
 */
export class PageRecorder {
  private stream: MediaStream | null = null;
  private rec: MediaRecorder | null = null;
  private chunks: Blob[] = [];

  /** 마이크를 연다 (허락을 묻는다). 안 되면 false */
  async open(): Promise<boolean> {
    if (!recordingSupported()) return false;
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      return true;
    } catch { return false; }
  }

  start(): boolean {
    if (!this.stream) return false;
    try {
      this.chunks = [];
      this.rec = new MediaRecorder(this.stream);
      this.rec.ondataavailable = e => { if (e.data && e.data.size) this.chunks.push(e.data); };
      this.rec.start();
      return true;
    } catch { return false; }
  }

  /** 녹음을 멈추고 그 쪽의 소리를 돌려준다 */
  stop(): Promise<Blob | null> {
    const rec = this.rec;
    this.rec = null;
    if (!rec || rec.state === 'inactive') return Promise.resolve(null);
    return new Promise(resolve => {
      rec.onstop = () => {
        const type = this.chunks[0]?.type || rec.mimeType || 'audio/webm';
        resolve(this.chunks.length ? new Blob(this.chunks, { type }) : null);
      };
      try { rec.stop(); } catch { resolve(null); }
    });
  }

  close(): void {
    try { if (this.rec && this.rec.state !== 'inactive') this.rec.stop(); } catch {}
    this.stream?.getTracks().forEach(t => t.stop());
    this.stream = null;
    this.rec = null;
  }
}

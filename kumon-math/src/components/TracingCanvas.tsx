import React, { useCallback, useEffect, useRef, useState } from 'react';

const SIZE = 300;          // 캔버스 내부 해상도 (정사각형)
const FONT_SIZE = 236;     // 글자 크기
const BRUSH = 32;          // 손가락 붓 굵기 (글자 획 두께에 맞춤)
const SLACK = 12;          // 획 밖으로 이만큼 삐져나가도 인정
const NEED_COVERAGE = 0.55;// 글자 전체의 55% 이상
const NEED_ACCURACY = 0.4;  // 칠한 것의 40% 이상이 글자 근처여야 (마구 칠하기 방지)

// 글자를 격자로 나눠 "빠뜨린 획이 없는지" 본다.
// (이게 없으면 A의 가운데 선을 빼먹어도 넓이만으로 통과해 버린다)
// 단, 판정은 글자의 '속살'(가장자리를 깎아낸 안쪽)만 본다.
// 뾰족한 끝이나 얇은 가장자리는 손가락으로 채우기 어려우므로 요구하지 않는다.
const GRID = 12;             // 12 x 12 칸
const ERODE = 4;             // 맨 가장자리만 살짝 제외(얇은 획은 살려둔다)
const CELL_MIN_PIXELS = 110; // 글자가 이만큼 든 칸만 필수 (얇은 모서리는 제외)
// 판정 기준은 '꽉 채웠나'가 아니라 '지나가긴 했나'.
// 획을 따라 그리면 붓이 칸을 스치므로 조금만 칠해도 통과하고,
// 획을 통째로 빼먹은 칸은 0%에 가까워 걸러진다.
const CELL_NEED = 0.15;      // 그 칸을 15%만 지나가도 통과
// 칸이 많은 글자는 한 칸 정도 실수를 봐준다(획을 통째로 빼먹으면 두 칸 이상 비므로 여전히 걸린다)
const cellsAllowedToMiss = (required: number) => Math.floor(required / 20);

const FONT = `900 ${FONT_SIZE}px Nunito, 'Trebuchet MS', sans-serif`;

interface Props {
  /** 따라 그릴 글자 */
  letter: string;
  /** 완성했을 때 */
  onComplete: () => void;
  /** 지우기 버튼 등에서 초기화하고 싶을 때 값을 바꾸면 리셋됨 */
  resetKey?: number;
}

type Pt = { x: number; y: number };

export default function TracingCanvas({ letter, onComplete, resetKey = 0 }: Props) {
  const guideRef = useRef<HTMLCanvasElement>(null);
  const inkRef = useRef<HTMLCanvasElement>(null);
  // core = 실제 글자 픽셀(얼마나 채웠는지), tolerant = 글자 + 여유(삐져나감 허용)
  const coreMaskRef = useRef<Uint8Array | null>(null);
  const innerMaskRef = useRef<Uint8Array | null>(null);
  const tolerantMaskRef = useRef<Uint8Array | null>(null);
  const coreCountRef = useRef(0);
  // 칸마다 글자 픽셀이 몇 개인지 / 반드시 지나야 하는 칸 목록
  const cellTotalRef = useRef<Int32Array>(new Int32Array(GRID * GRID));
  const requiredCellsRef = useRef<number[]>([]);
  const drawingRef = useRef(false);
  const lastRef = useRef<Pt | null>(null);
  const doneRef = useRef(false);

  const [coverage, setCoverage] = useState(0);
  const [done, setDone] = useState(false);
  const [hasInk, setHasInk] = useState(false);
  const [missingParts, setMissingParts] = useState(0);

  /** 글자 모양 마스크를 만들고 안내선을 그린다 */
  const buildLetter = useCallback(async () => {
    // 폰트가 로드된 뒤에 그려야 모양이 정확함
    try { await (document as any).fonts?.ready; } catch {}

    const guide = guideRef.current;
    if (!guide) return;
    const gctx = guide.getContext('2d');
    if (!gctx) return;

    // 1) 화면에 보이는 안내 글자 (연한 색 + 점선 테두리)
    gctx.clearRect(0, 0, SIZE, SIZE);
    gctx.font = FONT;
    gctx.textAlign = 'center';
    gctx.textBaseline = 'middle';

    gctx.fillStyle = '#e8ddff';
    gctx.fillText(letter, SIZE / 2, SIZE / 2);

    gctx.setLineDash([9, 8]);
    gctx.lineWidth = 3;
    gctx.strokeStyle = '#9b7fd4';
    gctx.strokeText(letter, SIZE / 2, SIZE / 2);
    gctx.setLineDash([]);

    // 2) 채점용 마스크 2종
    const render = (slack: number): Uint8ClampedArray | null => {
      const off = document.createElement('canvas');
      off.width = SIZE;
      off.height = SIZE;
      const octx = off.getContext('2d', { willReadFrequently: true });
      if (!octx) return null;
      octx.font = FONT;
      octx.textAlign = 'center';
      octx.textBaseline = 'middle';
      octx.fillStyle = '#000';
      octx.fillText(letter, SIZE / 2, SIZE / 2);
      if (slack > 0) {
        // 바깥으로 여유를 준다
        octx.lineWidth = slack;
        octx.lineJoin = 'round';
        octx.strokeStyle = '#000';
        octx.strokeText(letter, SIZE / 2, SIZE / 2);
      } else if (slack < 0) {
        // 테두리를 지워서 안쪽만 남긴다(침식)
        octx.globalCompositeOperation = 'destination-out';
        octx.lineWidth = -slack * 2;
        octx.lineJoin = 'round';
        octx.strokeStyle = '#000';
        octx.strokeText(letter, SIZE / 2, SIZE / 2);
        octx.globalCompositeOperation = 'source-over';
      }
      return octx.getImageData(0, 0, SIZE, SIZE).data;
    };

    const coreData = render(0);
    const tolData = render(SLACK);
    const innerData = render(-ERODE);   // 가장자리를 깎아낸 '속살'
    if (!coreData || !tolData || !innerData) return;

    const core = new Uint8Array(SIZE * SIZE);
    const inner = new Uint8Array(SIZE * SIZE);
    const tolerant = new Uint8Array(SIZE * SIZE);
    const cellTotal = new Int32Array(GRID * GRID);
    const cellSize = SIZE / GRID;
    let count = 0;
    for (let i = 0; i < core.length; i++) {
      if (coreData[i * 4 + 3] > 40) { core[i] = 1; count++; }
      if (innerData[i * 4 + 3] > 40) {
        inner[i] = 1;
        const cx = Math.min(GRID - 1, Math.floor((i % SIZE) / cellSize));
        const cy = Math.min(GRID - 1, Math.floor(Math.floor(i / SIZE) / cellSize));
        cellTotal[cy * GRID + cx]++;
      }
      if (tolData[i * 4 + 3] > 40) tolerant[i] = 1;
    }
    const required: number[] = [];
    for (let c = 0; c < cellTotal.length; c++) {
      if (cellTotal[c] >= CELL_MIN_PIXELS) required.push(c);
    }
    coreMaskRef.current = core;
    innerMaskRef.current = inner;
    tolerantMaskRef.current = tolerant;
    coreCountRef.current = count;
    cellTotalRef.current = cellTotal;
    requiredCellsRef.current = required;
  }, [letter]);

  /** 캔버스 비우기 */
  const clearInk = useCallback(() => {
    const ink = inkRef.current;
    const ctx = ink?.getContext('2d');
    if (ink && ctx) ctx.clearRect(0, 0, SIZE, SIZE);
    doneRef.current = false;
    lastRef.current = null;
    setCoverage(0);
    setDone(false);
    setHasInk(false);
    setMissingParts(0);
  }, []);

  useEffect(() => {
    clearInk();
    buildLetter();
  }, [letter, resetKey, buildLetter, clearInk]);

  /** 얼마나 따라 그렸는지 채점 */
  const score = useCallback(() => {
    const core = coreMaskRef.current;
    const inner = innerMaskRef.current;
    const tolerant = tolerantMaskRef.current;
    const ink = inkRef.current;
    const ctx = ink?.getContext('2d', { willReadFrequently: true });
    if (!core || !inner || !tolerant || !ink || !ctx || !coreCountRef.current) return;

    const data = ctx.getImageData(0, 0, SIZE, SIZE).data;
    const cellFilled = new Int32Array(GRID * GRID);
    const cellSize = SIZE / GRID;
    let filled = 0, onTarget = 0, painted = 0;
    for (let i = 0; i < core.length; i++) {
      if (data[i * 4 + 3] > 30) {
        painted++;
        if (core[i]) filled++;        // 글자를 얼마나 채웠나
        if (inner[i]) {               // 칸 판정은 속살만
          const cx = Math.min(GRID - 1, Math.floor((i % SIZE) / cellSize));
          const cy = Math.min(GRID - 1, Math.floor(Math.floor(i / SIZE) / cellSize));
          cellFilled[cy * GRID + cx]++;
        }
        if (tolerant[i]) onTarget++;  // 글자 근처에 칠했나(살짝 삐져나감 허용)
      }
    }
    const cov = filled / coreCountRef.current;
    const acc = painted ? onTarget / painted : 0;

    // 반드시 지나야 하는 칸을 몇 개나 지났는지 — 빠뜨린 획이 있으면 여기서 걸린다
    const required = requiredCellsRef.current;
    const cellTotal = cellTotalRef.current;
    let cellsDone = 0;
    for (const c of required) {
      if (cellFilled[c] / cellTotal[c] >= CELL_NEED) cellsDone++;
    }
    const cellsNeeded = Math.max(1, required.length - cellsAllowedToMiss(required.length));
    const cellRatio = required.length ? cellsDone / required.length : 0;
    setMissingParts(required.length - cellsDone);

    // 진행바는 "빠짐없이 그렸는지"를 보여준다
    setCoverage(Math.min(cov, cellRatio));

    if (!doneRef.current && cov >= NEED_COVERAGE && acc >= NEED_ACCURACY && cellsDone >= cellsNeeded) {
      doneRef.current = true;
      setDone(true);
      onComplete();
    }
  }, [onComplete]);

  /** 화면 좌표 → 캔버스 내부 좌표 */
  const toLocal = (e: React.PointerEvent<HTMLCanvasElement>): Pt => {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * SIZE,
      y: ((e.clientY - rect.top) / rect.height) * SIZE,
    };
  };

  const strokeTo = (p: Pt) => {
    const ctx = inkRef.current?.getContext('2d');
    if (!ctx) return;
    ctx.strokeStyle = '#ff7aa8';
    ctx.lineWidth = BRUSH;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    const from = lastRef.current ?? p;
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    lastRef.current = p;
  };

  const onDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (done) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drawingRef.current = true;
    lastRef.current = null;
    setHasInk(true);
    strokeTo(toLocal(e));
  };

  const onMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current || done) return;
    strokeTo(toLocal(e));
  };

  const onUp = () => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    lastRef.current = null;
    score();
  };

  const pct = Math.round(coverage * 100);

  return (
    <div style={{ width: '100%', maxWidth: 340 }}>
      <div style={{
        position: 'relative',
        width: '100%',
        aspectRatio: '1 / 1',
        background: 'white',
        borderRadius: 24,
        boxShadow: done
          ? '0 0 0 4px #27ae60, 0 12px 40px rgba(39,174,96,0.3)'
          : '0 8px 30px rgba(0,0,0,0.12)',
        overflow: 'hidden',
        transition: 'box-shadow 0.3s',
        touchAction: 'none',
      }}>
        {/* 안내 글자 */}
        <canvas
          ref={guideRef}
          width={SIZE}
          height={SIZE}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
        />
        {/* 아이가 그리는 층 */}
        <canvas
          ref={inkRef}
          width={SIZE}
          height={SIZE}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          onPointerLeave={onUp}
          style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%',
            cursor: done ? 'default' : 'crosshair', touchAction: 'none',
          }}
        />
        {!hasInk && (
          <div style={{
            position: 'absolute', bottom: 12, left: 0, right: 0,
            textAlign: 'center', fontSize: 14, fontWeight: 700,
            color: '#b0a0d0', pointerEvents: 'none',
          }}>
            👆 점선을 따라 그려봐!
          </div>
        )}
        {/* 빠뜨린 획이 있으면 알려준다 (예: A의 가운데 선) */}
        {hasInk && !done && missingParts > 0 && (
          <div style={{
            position: 'absolute', bottom: 12, left: 0, right: 0,
            textAlign: 'center', fontSize: 14, fontWeight: 800,
            color: '#e67e22', pointerEvents: 'none',
          }}>
            아직 안 그린 곳이 있어! 점선을 다 채워봐 ✏️
          </div>
        )}
        {done && (
          <div style={{
            position: 'absolute', top: 10, right: 14,
            fontSize: 34, animation: 'fadeIn 0.4s ease', pointerEvents: 'none',
          }}>
            ⭐
          </div>
        )}
      </div>

      {/* 얼마나 칠했는지 진행바 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12 }}>
        <div style={{ flex: 1, background: '#eee', borderRadius: 99, height: 12, overflow: 'hidden' }}>
          <div style={{
            width: `${pct}%`, height: '100%',
            background: done
              ? 'linear-gradient(90deg, #27ae60, #2ecc71)'
              : 'linear-gradient(90deg, #f6d365, #fda085)',
            borderRadius: 99, transition: 'width 0.25s ease',
          }} />
        </div>
        <span style={{ fontSize: 13, fontWeight: 800, color: done ? '#27ae60' : '#888', minWidth: 42 }}>
          {pct}%
        </span>
        <button
          onClick={clearInk}
          style={{
            background: '#fff', border: '2px solid #ddd', borderRadius: 12,
            padding: '7px 14px', fontSize: 13, fontWeight: 800,
            color: '#777', cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          지우기 🧽
        </button>
      </div>
    </div>
  );
}

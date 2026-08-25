import React, { useCallback, useEffect, useRef, useState } from 'react';
import { strokesFor } from '../alphabet/strokes';
import { playClick } from '../utils/sounds';

const BOX = 100;        // path 좌표계 (100 x 100)
const START_TOL = 15;   // 시작점을 이 거리 안에서 짚어야 시작됨
const TOL = 14;         // 획을 따라갈 때 허용 오차
const LOOKAHEAD = 6;    // 한 번에 이만큼 앞까지만 인정(순서·방향 강제)

interface Props {
  letter: string;
  onComplete: () => void;
  resetKey?: number;
}

type Pt = { x: number; y: number };
const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);

export default function StrokeOrderCanvas({ letter, onComplete, resetKey = 0 }: Props) {
  const paths = strokesFor(letter);
  const svgRef = useRef<SVGSVGElement>(null);
  const pathRefs = useRef<(SVGPathElement | null)[]>([]);
  const samplesRef = useRef<Pt[][]>([]);
  const lengthsRef = useRef<number[]>([]);
  const drawingRef = useRef(false);
  const idxRef = useRef(0);            // 현재 획에서 어디까지 따라왔는지
  const doneRef = useRef(false);

  const [current, setCurrent] = useState(0);   // 지금 쓰는 획 번호
  const [progress, setProgress] = useState(0); // 현재 획 진행도 0~1
  const [badStart, setBadStart] = useState(false);
  const [demoAt, setDemoAt] = useState<Pt | null>(null);

  /** 각 획을 점으로 잘게 쪼개 둔다 (따라오는지 판정 + 시범 보여주기용) */
  const buildSamples = useCallback(() => {
    const samples: Pt[][] = [];
    const lengths: number[] = [];
    paths.forEach((_, i) => {
      const el = pathRefs.current[i];
      if (!el) { samples.push([]); lengths.push(0); return; }
      const len = el.getTotalLength();
      const n = Math.max(14, Math.round(len / 2.2));
      const pts: Pt[] = [];
      for (let k = 0; k < n; k++) {
        const p = el.getPointAtLength((len * k) / (n - 1));
        pts.push({ x: p.x, y: p.y });
      }
      samples.push(pts);
      lengths.push(len);
    });
    samplesRef.current = samples;
    lengthsRef.current = lengths;
  }, [paths]);

  const reset = useCallback(() => {
    drawingRef.current = false;
    idxRef.current = 0;
    doneRef.current = false;
    setCurrent(0);
    setProgress(0);
    setBadStart(false);
    setDemoAt(null);
  }, []);

  useEffect(() => {
    reset();
    // path 엘리먼트가 붙은 다음에 측정
    const id = requestAnimationFrame(buildSamples);
    return () => cancelAnimationFrame(id);
  }, [letter, resetKey, buildSamples, reset]);

  /** 이 획을 어떻게 쓰는지 점이 움직이며 보여준다 */
  const showDemo = useCallback(() => {
    const pts = samplesRef.current[current];
    if (!pts || !pts.length) return;
    playClick();
    let k = 0;
    const step = () => {
      if (k >= pts.length) { setDemoAt(null); return; }
      setDemoAt(pts[k]);
      k += Math.max(1, Math.round(pts.length / 45));
      setTimeout(step, 24);
    };
    step();
  }, [current]);

  /** 화면 좌표 → path 좌표 */
  const toBox = (e: React.PointerEvent): Pt => {
    const r = svgRef.current!.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) / r.width) * BOX,
      y: ((e.clientY - r.top) / r.height) * BOX,
    };
  };

  const finishStroke = useCallback(() => {
    drawingRef.current = false;
    idxRef.current = 0;
    setProgress(0);
    if (current + 1 < paths.length) {
      setCurrent(current + 1);
      playClick();
    } else if (!doneRef.current) {
      doneRef.current = true;
      setCurrent(paths.length);   // 전부 완성
      onComplete();
    }
  }, [current, paths.length, onComplete]);

  const onDown = (e: React.PointerEvent) => {
    if (doneRef.current || current >= paths.length) return;
    const pts = samplesRef.current[current];
    if (!pts || !pts.length) return;
    const p = toBox(e);
    if (dist(p, pts[0]) > START_TOL) {
      setBadStart(true);
      setTimeout(() => setBadStart(false), 1200);
      return;
    }
    (e.target as Element).setPointerCapture?.(e.pointerId);
    drawingRef.current = true;
    idxRef.current = 0;
    setBadStart(false);
  };

  const onMove = (e: React.PointerEvent) => {
    if (!drawingRef.current) return;
    const pts = samplesRef.current[current];
    if (!pts) return;
    const p = toBox(e);

    // 앞쪽 몇 점만 인정 → 건너뛰기·거꾸로 긋기가 안 된다
    let best = idxRef.current;
    const limit = Math.min(pts.length - 1, idxRef.current + LOOKAHEAD);
    for (let i = idxRef.current + 1; i <= limit; i++) {
      if (dist(p, pts[i]) <= TOL) best = i;
    }
    if (best !== idxRef.current) {
      idxRef.current = best;
      setProgress(best / (pts.length - 1));
      if (best >= pts.length - 1) finishStroke();
    }
  };

  const onUp = () => {
    if (!drawingRef.current) return;
    const pts = samplesRef.current[current] || [];
    // 끝까지 거의 다 왔으면 인정, 아니면 이 획만 다시
    if (pts.length && idxRef.current >= pts.length - 2) finishStroke();
    else { drawingRef.current = false; idxRef.current = 0; setProgress(0); }
  };

  const allDone = current >= paths.length && paths.length > 0;
  const startPt = samplesRef.current[current]?.[0];

  return (
    <div style={{ width: '100%', maxWidth: 340 }}>
      <div style={{
        position: 'relative', width: '100%', aspectRatio: '1 / 1',
        background: 'white', borderRadius: 24, overflow: 'hidden',
        boxShadow: allDone
          ? '0 0 0 4px #27ae60, 0 12px 40px rgba(39,174,96,0.3)'
          : '0 8px 30px rgba(0,0,0,0.12)',
        transition: 'box-shadow 0.3s', touchAction: 'none',
      }}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${BOX} ${BOX}`}
          style={{ width: '100%', height: '100%', touchAction: 'none' }}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
        >
          {/* 노트 줄 */}
          <line x1="0" y1="15" x2="100" y2="15" stroke="#eee" strokeWidth="0.6" />
          <line x1="0" y1="40" x2="100" y2="40" stroke="#f0eefb" strokeWidth="0.6" />
          <line x1="0" y1="80" x2="100" y2="80" stroke="#f3c9d8" strokeWidth="0.9" />

          {paths.map((d, i) => {
            const state = i < current ? 'done' : i === current ? 'now' : 'later';
            return (
              <g key={i}>
                <path
                  ref={el => { pathRefs.current[i] = el; }}
                  d={d}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={9}
                  stroke={
                    state === 'done' ? '#ff7aa8'
                      : state === 'now' ? '#e8ddff'
                      : '#f4f1fb'
                  }
                  strokeDasharray={state === 'now' ? '3 3' : undefined}
                />
                {/* 지금 쓰는 획: 따라온 만큼 색이 채워진다 */}
                {state === 'now' && (
                  <path
                    d={d}
                    fill="none"
                    stroke="#ff7aa8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={9}
                    pathLength={1}
                    strokeDasharray={1}
                    strokeDashoffset={1 - progress}
                  />
                )}
              </g>
            );
          })}

          {/* 시작점 번호 */}
          {!allDone && startPt && (
            <g>
              <circle cx={startPt.x} cy={startPt.y} r={7} fill="#7c4dff" opacity={0.92}>
                <animate attributeName="r" values="7;8.6;7" dur="1.1s" repeatCount="indefinite" />
              </circle>
              <text
                x={startPt.x} y={startPt.y + 2.6}
                textAnchor="middle" fontSize="8" fontWeight="800" fill="white"
              >
                {current + 1}
              </text>
            </g>
          )}

          {/* 시범 보여주기 점 */}
          {demoAt && <circle cx={demoAt.x} cy={demoAt.y} r={5} fill="#27ae60" opacity={0.9} />}
        </svg>

        {badStart && (
          <div style={{
            position: 'absolute', bottom: 12, left: 0, right: 0, textAlign: 'center',
            fontSize: 14, fontWeight: 800, color: '#e67e22', pointerEvents: 'none',
          }}>
            보라색 <b>{current + 1}</b>번에서 시작해야 해! 👆
          </div>
        )}
        {allDone && (
          <div style={{ position: 'absolute', top: 10, right: 14, fontSize: 34, pointerEvents: 'none' }}>⭐</div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: allDone ? '#27ae60' : '#7c4dff', minWidth: 74 }}>
          {allDone ? '다 썼어! 🎉' : `${current + 1}번 / ${paths.length}획`}
        </div>
        <div style={{ flex: 1, background: '#eee', borderRadius: 99, height: 12, overflow: 'hidden' }}>
          <div style={{
            width: `${((current + progress) / Math.max(1, paths.length)) * 100}%`,
            height: '100%', borderRadius: 99,
            background: allDone
              ? 'linear-gradient(90deg,#27ae60,#2ecc71)'
              : 'linear-gradient(90deg,#a18cd1,#fbc2eb)',
            transition: 'width 0.2s ease',
          }} />
        </div>
        {!allDone && (
          <button
            onClick={showDemo}
            style={{
              background: 'white', border: '2px solid #7c4dff', borderRadius: 12,
              padding: '7px 12px', fontSize: 13, fontWeight: 800,
              color: '#7c4dff', cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            보여줘 👀
          </button>
        )}
      </div>
    </div>
  );
}

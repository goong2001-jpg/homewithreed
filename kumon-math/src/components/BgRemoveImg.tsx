import React, { useEffect, useRef, useState } from 'react';

interface Props {
  src: string;
  bgRemoval: 'green' | 'black' | 'white' | 'none';
  style?: React.CSSProperties;
  onError?: () => void;
}

export default function BgRemoveImg({ src, bgRemoval, style, onError }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [state, setState] = useState<'loading' | 'canvas-ok' | 'fallback' | 'failed'>('loading');

  useEffect(() => {
    setState('loading');

    if (bgRemoval !== 'green') {
      setState('fallback');
      return;
    }

    const img = new Image();
    // crossOrigin 없이 먼저 시도 — 같은 도메인(GitHub Pages)은 불필요
    img.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) { setState('fallback'); return; }
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) { setState('fallback'); return; }

      try {
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const d = imageData.data;
        for (let i = 0; i < d.length; i += 4) {
          const r = d[i], g = d[i + 1], b = d[i + 2];
          if (g > r * 1.35 && g > b * 1.35 && g > 80) {
            d[i + 3] = 0;
          }
        }
        ctx.putImageData(imageData, 0, 0);
        setState('canvas-ok');
      } catch {
        // canvas가 오염됐거나 보안 에러 → CSS 필터 폴백
        setState('fallback');
      }
    };
    img.onerror = () => {
      setState('failed');
      onError?.();
    };
    img.src = src;
  }, [src, bgRemoval, onError]);

  if (state === 'failed') return null;

  if (bgRemoval === 'green') {
    if (state === 'canvas-ok') {
      return (
        <canvas
          ref={canvasRef}
          style={{ display: 'block', ...style }}
        />
      );
    }
    if (state === 'fallback') {
      // canvas 안 될 때: CSS 필터로 초록 제거 시도
      return (
        <img
          src={src}
          alt=""
          style={{
            // 초록배경을 CSS filter로 줄이는 근사치 처리
            filter: 'saturate(0) brightness(1.1)',
            mixBlendMode: 'multiply',
            ...style,
          }}
        />
      );
    }
    // loading 중엔 숨김
    return <canvas ref={canvasRef} style={{ display: 'none' }} />;
  }

  // black 배경 → screen, white 배경 → multiply
  const blendMode: React.CSSProperties['mixBlendMode'] =
    bgRemoval === 'black' ? 'screen' :
    bgRemoval === 'white' ? 'multiply' : 'normal';

  return (
    <img
      src={src}
      alt=""
      onError={() => { setState('failed'); onError?.(); }}
      style={{ mixBlendMode: blendMode, ...style }}
    />
  );
}

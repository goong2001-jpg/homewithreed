import React, { useEffect, useRef, useState } from 'react';

interface Props {
  src: string;
  bgRemoval: 'green' | 'black' | 'white' | 'none';
  style?: React.CSSProperties;
  onError?: () => void;
}

/**
 * 초록/검정/흰 배경을 자동으로 제거해서 표시해주는 이미지 컴포넌트
 * - green: canvas 픽셀 처리로 초록 배경 제거 (크로마키)
 * - black: mix-blend-mode screen (검정 = 투명)
 * - white: mix-blend-mode multiply (흰색 = 투명)
 * - none: 그냥 표시
 */
export default function BgRemoveImg({ src, bgRemoval, style, onError }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [canvasReady, setCanvasReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (bgRemoval !== 'green') return;
    setCanvasReady(false);

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const d = data.data;
      for (let i = 0; i < d.length; i += 4) {
        const r = d[i], g = d[i + 1], b = d[i + 2];
        // 초록 픽셀 조건: g > r*1.4 && g > b*1.4 && g > 80
        if (g > r * 1.35 && g > b * 1.35 && g > 80) {
          d[i + 3] = 0; // 투명 처리
        }
      }
      ctx.putImageData(data, 0, 0);
      setCanvasReady(true);
    };
    img.onerror = () => { setFailed(true); onError?.(); };
    img.src = src;
  }, [src, bgRemoval, onError]);

  if (failed) return null;

  if (bgRemoval === 'green') {
    return (
      <canvas
        ref={canvasRef}
        style={{
          display: canvasReady ? 'block' : 'none',
          ...style,
        }}
      />
    );
  }

  const blendMode: React.CSSProperties['mixBlendMode'] =
    bgRemoval === 'black' ? 'screen' :
    bgRemoval === 'white' ? 'multiply' : 'normal';

  return (
    <img
      src={src}
      alt=""
      crossOrigin="anonymous"
      onError={() => { setFailed(true); onError?.(); }}
      style={{ mixBlendMode: blendMode, ...style }}
    />
  );
}

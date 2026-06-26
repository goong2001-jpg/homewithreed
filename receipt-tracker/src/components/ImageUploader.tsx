import React, { useRef, useState } from 'react';
import { resizeImage } from '../utils/claudeVision';

interface Props {
  onImage: (dataUrl: string) => void;
}

export default function ImageUploader({ onImage }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  async function handleFile(file: File) {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      const raw = e.target?.result as string;
      const resized = await resizeImage(raw);
      onImage(resized);
    };
    reader.readAsDataURL(file);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      style={{
        border: `2px dashed ${dragging ? '#3498db' : '#ccc'}`,
        borderRadius: 16,
        padding: '48px 20px',
        textAlign: 'center',
        cursor: 'pointer',
        background: dragging ? '#ebf5fb' : '#fafafa',
        transition: 'all 0.2s',
      }}
    >
      <div style={{ fontSize: 48, marginBottom: 12 }}>📷</div>
      <div style={{ fontSize: 16, fontWeight: 600, color: '#333', marginBottom: 6 }}>
        영수증 또는 결제 화면 업로드
      </div>
      <div style={{ fontSize: 13, color: '#888' }}>
        클릭하거나 이미지를 드래그하세요
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
      />
    </div>
  );
}

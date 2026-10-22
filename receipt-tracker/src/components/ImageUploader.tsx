import React, { useRef, useState } from 'react';
import { resizeImage } from '../utils/image';

interface Props {
  onImage: (dataUrl: string) => void;
}

/** 받아주는 확장자 — 아이폰은 HEIC 파일의 file.type 을 빈 문자열로 주기도 해서 이름으로도 본다 */
const IMAGE_EXT = /\.(heic|heif|jpe?g|png|webp)$/i;
const HEIC_EXT = /\.(heic|heif)$/i;

function isImageFile(file: File): boolean {
  return file.type.startsWith('image/') || IMAGE_EXT.test(file.name);
}

export default function ImageUploader({ onImage }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState('');

  async function handleFile(file: File) {
    setError('');
    if (!isImageFile(file)) {
      setError('이미지 파일(JPG·PNG·WEBP·HEIC)만 올릴 수 있어요.');
      return;
    }
    const isHeic = HEIC_EXT.test(file.name) || /hei[cf]/i.test(file.type);

    let raw: string;
    try {
      raw = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target?.result as string);
        reader.onerror = () => reject(reader.error ?? new Error('read failed'));
        reader.readAsDataURL(file);
      });
    } catch {
      setError('파일을 읽지 못했어요. 다른 파일로 다시 시도해주세요.');
      return;
    }

    try {
      onImage(await resizeImage(raw));
    } catch {
      // HEIC 는 대부분의 브라우저가 디코딩하지 못한다 — 사진 앱에서 JPG 로 바꿔 올리게 안내
      setError(isHeic
        ? 'HEIC 사진은 이 브라우저에서 열 수 없어요. 아이폰 [설정 → 카메라 → 포맷 → 높은 호환성]으로 바꾸거나, 사진을 JPG로 저장해서 올려주세요.'
        : '이미지를 열지 못했어요. JPG 또는 PNG 파일로 다시 시도해주세요.');
    }
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
      {error && (
        <div style={{ marginTop: 12, fontSize: 13, color: '#c0392b', lineHeight: 1.5 }}>
          ⚠️ {error}
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*,.heic,.heif"
        style={{ display: 'none' }}
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }}
      />
    </div>
  );
}

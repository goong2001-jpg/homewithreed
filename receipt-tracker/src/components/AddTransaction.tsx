import React, { useState } from 'react';
import { Transaction, ExtractedFields } from '../types';
import { ocrImage } from '../utils/ocrExtract';
import ImageUploader from './ImageUploader';
import TransactionForm from './TransactionForm';

type Step = 'upload' | 'loading' | 'review';

interface Props {
  onSave: (t: Transaction) => void;
  onCancel: () => void;
}

export default function AddTransaction({ onSave, onCancel }: Props) {
  const [step, setStep] = useState<Step>('upload');
  const [extracted, setExtracted] = useState<ExtractedFields>({});
  const [error, setError] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const [progress, setProgress] = useState(0);

  async function handleImage(dataUrl: string) {
    setPreviewUrl(dataUrl);
    setStep('loading');
    setError('');
    setProgress(0);

    try {
      const fields = await ocrImage(dataUrl, setProgress);
      setExtracted(fields);
      setStep('review');
    } catch (e: any) {
      setError(e.message || '글자 인식에 실패했습니다.');
      setExtracted({});
      setStep('review');
    }
  }

  function handleSkip() {
    setExtracted({});
    setStep('review');
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f8f9fa', padding: '0 0 80px' }}>
      <div style={{
        background: '#fff',
        padding: '16px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
        position: 'sticky',
        top: 0,
        zIndex: 10,
      }}>
        <button onClick={onCancel} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', padding: '4px 8px' }}>←</button>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
          {step === 'upload' ? '영수증 업로드' : step === 'loading' ? '영수증 인식 중' : '내역 확인'}
        </h2>
      </div>

      <div style={{ padding: '20px 16px' }}>
        {step === 'upload' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <ImageUploader onImage={handleImage} />
            <button
              onClick={handleSkip}
              style={{
                padding: '12px',
                background: '#fff',
                border: '1.5px solid #e0e0e0',
                borderRadius: 10,
                fontSize: 14,
                color: '#666',
                cursor: 'pointer',
              }}
            >
              직접 입력하기
            </button>
          </div>
        )}

        {step === 'loading' && (
          <div style={{ textAlign: 'center', padding: '50px 20px' }}>
            {previewUrl && (
              <img src={previewUrl} alt="업로드 이미지" style={{ maxWidth: '100%', maxHeight: 200, borderRadius: 12, marginBottom: 24, objectFit: 'contain' }} />
            )}
            <div style={{ fontSize: 36, marginBottom: 16 }}>🔍</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#333', marginBottom: 8 }}>영수증 글자를 읽고 있어요...</div>
            <div style={{ fontSize: 13, color: '#888', marginBottom: 20 }}>처음엔 인식 데이터를 받느라 조금 걸려요</div>
            <div style={{ maxWidth: 240, margin: '0 auto' }}>
              <div style={{ height: 8, background: '#e8e8e8', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${progress}%`, background: '#3498db', borderRadius: 4, transition: 'width 0.3s' }} />
              </div>
              <div style={{ fontSize: 12, color: '#aaa', marginTop: 8 }}>{progress}%</div>
            </div>
          </div>
        )}

        {step === 'review' && (
          <div>
            {previewUrl && (
              <img src={previewUrl} alt="업로드 이미지" style={{ maxWidth: '100%', maxHeight: 160, borderRadius: 12, marginBottom: 16, objectFit: 'contain', display: 'block' }} />
            )}
            {error ? (
              <div style={{ padding: '10px 14px', background: '#fef9e7', borderRadius: 8, color: '#e67e22', fontSize: 13, marginBottom: 16 }}>
                ⚠️ {error} — 직접 입력해주세요.
              </div>
            ) : previewUrl && (
              <div style={{ padding: '10px 14px', background: '#eafaf1', borderRadius: 8, color: '#27ae60', fontSize: 13, marginBottom: 16 }}>
                ✅ 인식 완료! 내용을 확인하고 필요하면 수정해주세요.
              </div>
            )}
            <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
              <TransactionForm
                extracted={extracted}
                onSave={onSave}
                onCancel={onCancel}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
